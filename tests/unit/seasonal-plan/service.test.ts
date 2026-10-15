import { describe, expect, it } from 'vitest'
import {
  balanceSignature,
  reviewSavedPlan,
  forecastPlan,
  romeToday,
} from '@/lib/seasonal-plan/service'
import { emptyPlan } from '@/lib/seasonal-plan/schema'
import type { SeasonalContext } from '@/lib/seasonal-plan/service'
const id = '11111111-1111-4111-8111-111111111111'
const account = {
  id,
  name: 'Banca',
  type: 'checking' as const,
  balance: 1000,
  currency: 'EUR',
  is_active: true,
  is_hidden: false,
}
const rule = {
  id: 'r',
  account_id: id,
  category_id: null,
  type: 'expense' as const,
  amount: 50,
  description: 'Rata',
  frequency: 'monthly' as const,
  start_date: '2026-10-20',
  end_date: null,
  next_due_date: '2026-10-20',
  last_run_date: null,
  is_active: true,
  auto_create: true,
}
const context = (): SeasonalContext => ({
  today: '2026-10-15',
  accounts: [account],
  rules: [rule],
  installments: { plans: [], payments: [] },
  posted: [],
})
describe('seasonal integrations', () => {
  it('requires review when balances change and detects even an unchanged balance with a new update timestamp', () => {
    const c = context(),
      p = { ...emptyPlan(c.today, [id]), reviewed: true }
    const signature = balanceSignature(p, c)
    expect(reviewSavedPlan(p, signature, c).needsReview).toBe(false)
    c.accounts[0] = { ...c.accounts[0], balance: 2000 }
    const stale = reviewSavedPlan(p, signature, c)
    expect(stale.needsReview).toBe(true)
    expect(forecastPlan(stale.plan, c).forecast.spendableConfirmed).toBeNull()
    c.accounts[0] = {
      ...c.accounts[0],
      balance: 1000,
      updated_at: '2026-10-15T10:00:00Z',
    }
    expect(reviewSavedPlan(p, signature, c).needsReview).toBe(true)
  })

  it('uses Rome midnight rather than UTC midnight', () => {
    expect(romeToday(new Date('2026-10-14T22:30:00Z'))).toBe('2026-10-15')
  })
  it('does not duplicate an actual recurring expense already in the balance', () => {
    const c = context()
    c.rules[0] = { ...rule, end_date: '2026-10-20' }
    c.posted = [{ recurring_id: 'r', date: '2026-10-20' }]
    const p = { ...emptyPlan(c.today, [id]), reviewed: true }
    expect(forecastPlan(p, c).forecast.events).toEqual([])
    expect(forecastPlan(p, c).forecast.openingBalance).toBe(1000)
  })
  it('replaces installment-related recurrence only within a finite plan and skips paid numbers', () => {
    const c = context()
    c.installments = {
      plans: [
        {
          id: 'p',
          title: 'Acquisto',
          total_installments: 3,
          created_at: '',
          schedule: {
            amount: 50,
            frequency: 'monthly',
            interval: 1,
            first_due_date: '2026-10-20',
            first_installment_number: 1,
            paused: false,
          },
        },
      ],
      payments: [
        {
          transaction_id: 't',
          plan_id: 'p',
          installment_number: 1,
          transaction: {
            account_id: id,
            category_id: null,
            amount: 50,
            date: '2026-10-15',
            description: 'Acquisto',
            recurring_id: 'r',
          },
        },
      ],
    }
    const r = forecastPlan(emptyPlan(c.today, [id]), c).forecast
    expect(r.events.filter((e) => e.source === 'INSTALLMENT')).toHaveLength(2)
    expect(r.rows[0].estimatedExpenses).toBe(0)
    expect(r.rows[1].estimatedExpenses).toBe(50)
    expect(r.rows[3].estimatedExpenses).toBe(50)
    expect(r.events.filter((e) => e.date === '2026-11-20')).toHaveLength(1)
  })
  it('replaces recurring income with the explicitly planned monthly amount', () => {
    const c = context()
    c.rules = [{ ...rule, type: 'income', amount: 1750 }]
    const p = emptyPlan(c.today, [id])
    p.months[0] = { ...p.months[0], kind: 'NASPI', amount: 1000 }
    const r = forecastPlan(p, c).forecast
    expect(r.rows[0].estimatedIncome).toBe(1000)
    expect(r.rows[1].estimatedIncome).toBe(0)
  })
  it('withholds spending limits if a selected account disappears or a card debt is omitted', () => {
    const c = context()
    const p = { ...emptyPlan(c.today, [id]), reviewed: true }
    c.accounts = []
    expect(forecastPlan(p, c).forecast.spendableConfirmed).toBeNull()
    c.accounts = [
      account,
      { ...account, id: 'card', type: 'credit', balance: -500 },
    ]
    expect(forecastPlan(p, c).forecast.spendableConfirmed).toBeNull()
  })
})
