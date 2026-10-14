import { describe, expect, it } from 'vitest'
import { addInstallmentEvents, installmentDate, unpaidNumbers, type InstallmentPayment, type InstallmentPlan, type InstallmentSchedule } from '@/lib/installments/schedule'
import { installmentScheduleSchema } from '@/lib/installments/schema'
import { buildFinancialCalendarPeriod, computeCalendarForecast } from '@/lib/financial-calendar/calculations'
import type { CalendarAccountInput, FinancialCalendarEvent } from '@/lib/financial-calendar/types'

const schedule: InstallmentSchedule = { amount: 50, frequency: 'monthly', interval: 1, first_due_date: '2026-01-31', first_installment_number: 2, paused: false }
const plan: InstallmentPlan = { id: 'plan', title: 'Acquisto', total_installments: 4, created_at: '', schedule }
const account: CalendarAccountInput = { id: 'account', name: 'Banca', type: 'checking', balance: 1000, currency: 'EUR', is_active: true, is_hidden: false }
const payment = (number: number): InstallmentPayment => ({ transaction_id: `tx${number}`, plan_id: plan.id, installment_number: number,
  transaction: { account_id: account.id, category_id: null, amount: 50, date: '2026-01-01', description: 'Acquisto', recurring_id: null } })
function events(plans = [plan], payments = [payment(1)], base: FinancialCalendarEvent[] = [], today = '2026-01-01') {
  return addInstallmentEvents({ plans, payments, events: base, accounts: [account], categories: [], from: today, to: '2026-12-31', today })
}

describe('finite installment schedules', () => {
  it('anchors end-of-month dates without February causing permanent drift', () => {
    expect([2, 3, 4].map((n) => installmentDate(schedule, n))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(installmentDate({ ...schedule, first_due_date: '2024-01-31' }, 3)).toBe('2024-02-29')
    expect(installmentDate({ ...schedule, interval: 3 }, 3)).toBe('2026-04-30')
    expect(installmentDate({ ...schedule, frequency: 'weekly', first_due_date: '2026-03-25' }, 3)).toBe('2026-04-01')
  })

  it('keeps a missed installment open even if a later one has been paid', () => {
    expect(unpaidNumbers(plan, [payment(1), payment(3)])).toEqual([2, 4])
    expect(unpaidNumbers({ ...plan, schedule: null }, [payment(3)])).toEqual([4])
    expect(events([plan], [payment(1), payment(3)]).map((e) => e.metadata.installmentNumber)).toEqual([2, 4])
  })

  it('carries overdue unpaid installments into today once and retains the real due date', () => {
    const result = events([plan], [payment(1), payment(3)], [], '2026-03-01')
    expect(result[0]).toMatchObject({ date: '2026-03-01', status: 'OVERDUE', amount: 50, metadata: { dueDate: '2026-01-31' } })
    expect(result).toHaveLength(2)
  })

  it('changes forecasts without changing actual balances, and a real payment replaces the forecast', () => {
    const period = buildFinancialCalendarPeriod('2026-01-01', '2026-04-30')
    const before = computeCalendarForecast({ accounts: [account], events: events(), period, today: '2026-01-01', month: '2026-01', threshold: 0 })
    const paidAccount = { ...account, balance: 950 }
    const actual: FinancialCalendarEvent = { ...events()[0], id: 'actual2', sourceType: 'EXISTING_TRANSACTION', eventType: 'ACTUAL_TRANSACTION', status: 'COMPLETED' }
    const projected = addInstallmentEvents({ plans: [plan], payments: [payment(1), payment(2)], events: [actual], accounts: [paidAccount], categories: [], from: period.from, to: period.to, today: '2026-01-01' })
    const after = computeCalendarForecast({ accounts: [paidAccount], events: projected, period, today: '2026-01-01', month: '2026-01', threshold: 0 })
    expect(before.summary.projectedClosingBalance).toBe(850)
    expect(after.summary.projectedClosingBalance).toBe(850)
    expect(after.summary.projectedExpenses).toBe(100)
    expect(account.balance).toBe(1000)
    expect(paidAccount.balance).toBe(950)
  })

  it('does not project unconfigured, paused, completed, or excluded-account plans', () => {
    expect(events([{ ...plan, schedule: null }])).toEqual([])
    expect(events([{ ...plan, schedule: { ...schedule, paused: true } }])).toEqual([])
    expect(events([plan], [1, 2, 3, 4].map(payment))).toEqual([])
    expect(addInstallmentEvents({ plans: [plan], payments: [payment(1)], events: [], accounts: [], categories: [], from: '2026-01-01', to: '2026-12-31', today: '2026-01-01' })).toEqual([])
  })

  it('replaces a linked recurring rule only inside the finite schedule window', () => {
    const base = events()[0]
    const recurring = (date: string): FinancialCalendarEvent => ({ ...base, id: `recurring-${date}`, sourceType: 'RECURRING', sourceId: 'rule', date })
    const linked = payment(1); linked.transaction!.recurring_id = 'rule'
    const result = events([plan], [linked], [recurring('2026-01-31'), recurring('2026-02-28'), recurring('2026-04-30')])
    expect(result.filter((e) => e.sourceType === 'RECURRING').map((e) => e.date)).toEqual(['2026-04-30'])
    expect(result.filter((e) => e.sourceType === 'INSTALLMENT')).toHaveLength(3)
  })

  it('validates calendar dates, cents, positive amounts, and schedule bounds', () => {
    expect(installmentScheduleSchema.safeParse(schedule).success).toBe(true)
    for (const change of [{ amount: 0 }, { amount: 1.001 }, { first_due_date: '2026-02-31' }, { first_due_date: '31/01/2026' }, { interval: 0 }, { first_installment_number: 361 }]) {
      expect(installmentScheduleSchema.safeParse({ ...schedule, ...change }).success).toBe(false)
    }
  })
})
