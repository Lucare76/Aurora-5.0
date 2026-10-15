import { describe, expect, it } from 'vitest'
import { calculateSeasonalPlan } from '@/lib/seasonal-plan/engine'
import { emptyPlan, seasonalPlanSchema } from '@/lib/seasonal-plan/schema'
import type { FinancialCalendarEvent } from '@/lib/financial-calendar/types'
const account = '11111111-1111-4111-8111-111111111111'
const plan = () => ({ ...emptyPlan('2026-10-15', [account]), reviewed: true })
const expense = (
  amount: number,
  date = '2026-10-20',
): FinancialCalendarEvent => ({
  id: date,
  date,
  amount,
  sourceId: 'r',
  sourceType: 'RECURRING',
  eventType: 'EXPECTED_EXPENSE',
  title: 'Affitto',
  description: null,
  direction: 'EXPENSE',
  accountId: account,
  accountName: 'Banca',
  categoryId: null,
  categoryName: null,
  status: 'EXPECTED',
  confidence: 'HIGH',
  href: '',
  metadata: {},
})
const calc = (
  p = plan(),
  openingBalance = 1000,
  automatic: FinancialCalendarEvent[] = [],
) =>
  calculateSeasonalPlan({
    plan: p,
    openingBalance,
    automatic,
    today: '2026-10-15',
  })
describe('seasonal spendable cash', () => {
  it('looks at the winter trough, not just the final annual balance', () => {
    const p = plan()
    p.reserve = 100
    p.months[5] = {
      ...p.months[5],
      amount: 5000,
      kind: 'SALARY',
      confidence: 'CONFIRMED',
    }
    const result = calc(p, 1000, [expense(700, '2026-11-01')])
    expect(result.rows[11].closing).toBe(5300)
    expect(result.spendableConfirmed).toBe(200)
    expect(result.minimumDate).toBe('2026-11-01')
  })
  it('excludes estimated income from the prudent limit but includes all expenses', () => {
    const p = plan()
    p.reserve = 100
    p.months[0] = {
      ...p.months[0],
      amount: 600,
      kind: 'NASPI',
      confidence: 'ESTIMATED',
      day: 16,
    }
    const r = calc(p, 1000, [expense(800)])
    expect(r.spendableConfirmed).toBe(100)
    expect(r.spendableEstimated).toBe(700)
    expect(r.rows[0]).toMatchObject({
      estimatedIncome: 600,
      estimatedExpenses: 800,
      closing: 800,
      closingConservative: 200,
    })
  })
  it('keeps confirmed salary and estimated extra income separate in the same month', () => {
    const p = plan()
    p.months[0] = {
      ...p.months[0],
      amount: 1000,
      kind: 'SALARY',
      confidence: 'CONFIRMED',
      extra: {
        amount: 500,
        day: 30,
        confidence: 'ESTIMATED',
        received: false,
        label: 'NASpI',
      },
    }
    const r = calc(p)
    expect(r.rows[0].confirmedIncome).toBe(1000)
    expect(r.rows[0].estimatedIncome).toBe(500)
  })
  it('never treats future income as money spendable today and includes the opening trough', () => {
    const p = plan()
    p.reserve = 100
    p.months[0] = {
      ...p.months[0],
      amount: 10000,
      kind: 'SALARY',
      confidence: 'CONFIRMED',
    }
    expect(calc(p).spendableConfirmed).toBe(900)
    expect(calc(p, -100).spendableConfirmed).toBe(0)
  })
  it('does not add received income or actual transactions to the current balance again', () => {
    const p = plan()
    p.months[0] = {
      ...p.months[0],
      amount: 1750,
      kind: 'SALARY',
      confidence: 'CONFIRMED',
      received: true,
    }
    const actual = {
      ...expense(400),
      status: 'COMPLETED' as const,
      sourceType: 'EXISTING_TRANSACTION' as const,
    }
    const r = calc(p, 1000, [actual])
    expect(r.rows[0].confirmedIncome).toBe(0)
    expect(r.minimumConfirmed).toBe(1000)
  })
  it('protects against outflows before payday, including same-day timing uncertainty', () => {
    const p = plan()
    p.months[0] = {
      ...p.months[0],
      amount: 500,
      kind: 'SALARY',
      confidence: 'CONFIRMED',
      day: 20,
    }
    const r = calc(p, 1000, [expense(800)])
    expect(r.rows[0].closing).toBe(700)
    expect(r.spendableConfirmed).toBe(200)
    expect(r.minimumConfirmed).toBe(200)
  })
  it('keeps monthly expenses anchored to month end and respects their end date', () => {
    const p = plan()
    p.commitments = [
      {
        id: account,
        title: 'PAC',
        kind: 'PAC',
        amount: 50,
        start_date: '2027-01-31',
        end_date: '2027-03-31',
        confidence: 'CONFIRMED',
      },
    ]
    expect(calc(p).events.map((e) => e.date)).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
    ])
    expect(calc(p).rows[5].confirmedExpenses).toBe(50)
  })
  it('prorates everyday expenses to remaining days and rounds cents exactly', () => {
    const p = plan()
    p.monthly_extra_expenses = 310
    const r = calc(p, 10000)
    expect(r.rows[0].estimatedExpenses).toBe(170)
    expect(r.rows[1].estimatedExpenses).toBe(310)
    expect(
      r.events
        .filter((e) => e.source === 'LIVING')
        .every((e) => e.date >= '2026-10-15'),
    ).toBe(true)
  })
  it('withholds the spending limit when months or accounts need review', () => {
    const p = plan()
    p.months.pop()
    expect(calc(p).spendableConfirmed).toBeNull()
    expect(calc({ ...plan(), reviewed: false }).spendableEstimated).toBeNull()
    expect(
      calculateSeasonalPlan({
        plan: plan(),
        openingBalance: 1000,
        automatic: [],
        today: '2026-10-15',
        unavailableAccounts: true,
      }).spendableConfirmed,
    ).toBeNull()
  })
  it('validates dates, duplicate months, cents and finite values', () => {
    expect(seasonalPlanSchema.safeParse(plan()).success).toBe(true)
    for (const change of [
      { reserve: -1 },
      { reserve: Infinity },
      { reserve: 0.001 },
      { months: [plan().months[0], plan().months[0]] },
      { account_ids: [] },
    ])
      expect(
        seasonalPlanSchema.safeParse({ ...plan(), ...change }).success,
      ).toBe(false)
    const p = plan()
    p.commitments = [
      {
        id: account,
        title: 'Affitto',
        kind: 'FIXED',
        amount: 600,
        start_date: '2027-02-31',
        end_date: '2027-12-31',
        confidence: 'CONFIRMED',
      },
    ]
    expect(seasonalPlanSchema.safeParse(p).success).toBe(false)
  })
})
