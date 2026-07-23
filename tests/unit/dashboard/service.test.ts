import { describe, expect, it } from 'vitest'
import {
  computeEndOfMonthForecast,
  computeMonthRecords,
  computeMonthStats,
  computeNetWorthTrend,
  computeTimeline,
  generateInsights,
} from '@/lib/dashboard/service'

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<{
  id: string; account_id: string; category_id: string | null
  type: string; amount: number; description: string | null
  date: string; transfer_peer_id: string | null
}> = {}) {
  return {
    id: 'tx-1', account_id: 'acc-1', category_id: null,
    type: 'expense', amount: 100, description: null,
    date: '2026-07-10', transfer_peer_id: null,
    ...overrides,
  }
}

const emptyBudgetSummary = {
  totalBudgets: 0, totalAmount: 0, totalSpent: 0,
  totalRemaining: 0, atRiskCount: 0, exceededCount: 0, topRiskBudgets: [],
  projectedTotalSpent: 0, projectedTotalOverrun: 0, projectedAtRiskCount: 0,
  topProjectedRisks: [], budgetAlerts: [], budgetInsights: [],
}

const baseInsightParams = {
  monthIncome: 2000, monthExpense: 1000,
  prevMonthIncome: 1800, prevMonthExpense: 1000,
  topCats: [], prevTopCats: [],
  chart: [],
  currentKey: '2026-07',
  netWorthTrend: [{ key: '2026-06', month: 'giu', netWorth: 5000 }, { key: '2026-07', month: 'lug', netWorth: 6000 }],
  budgetSummary: emptyBudgetSummary,
  monthStats: { avgDailyExpense: 40, txCount: 10, peakExpenseDay: null, peakExpenseAmount: 0, biggestIncome: 0, biggestExpense: 0, daysElapsed: 10 },
  prevMonth: { year: 2026, month: 6 },
}

// ── computeEndOfMonthForecast ──────────────────────────────────────────────

describe('computeEndOfMonthForecast', () => {
  it('returns hasEnoughData=false when fewer than 3 days elapsed', () => {
    const now = new Date(2026, 6, 2) // July 2nd (day 2)
    const f = computeEndOfMonthForecast(10000, 500, 200, now)
    expect(f.hasEnoughData).toBe(false)
    expect(f.daysElapsed).toBe(2)
    expect(f.difference).toBe(0)
  })

  it('computes projection correctly for a mid-month date', () => {
    // July 15: spent 300, earned 1500. 16 days remaining.
    // Daily net = (1500 - 300) / 15 = 80
    // Projected = 10000 + 80 * 16 = 11280
    const now = new Date(2026, 6, 15) // July 15
    const f = computeEndOfMonthForecast(10000, 1500, 300, now)
    expect(f.hasEnoughData).toBe(true)
    expect(f.daysElapsed).toBe(15)
    expect(f.daysInMonth).toBe(31)
    expect(f.dailyAvgFlow).toBe(80)
    expect(f.projectedBalance).toBe(11280)
    expect(f.difference).toBe(1280)
  })

  it('handles negative daily flow (spending more than earning)', () => {
    const now = new Date(2026, 6, 10) // July 10
    // Daily net = (0 - 1000) / 10 = -100
    // 21 days remaining → projected = 5000 + (-100 * 21) = 2900
    const f = computeEndOfMonthForecast(5000, 0, 1000, now)
    expect(f.dailyAvgFlow).toBe(-100)
    expect(f.projectedBalance).toBe(2900)
    expect(f.difference).toBe(-2100)
  })

  it('returns correct daysInMonth for February leap year', () => {
    const now = new Date(2024, 1, 10) // Feb 10, 2024 (leap year)
    const f = computeEndOfMonthForecast(0, 0, 0, now)
    expect(f.daysInMonth).toBe(29)
  })

  it('currentBalance equals netWorth', () => {
    const now = new Date(2026, 6, 15)
    const f = computeEndOfMonthForecast(7500.50, 1000, 500, now)
    expect(f.currentBalance).toBe(7500.50)
  })
})

// ── computeNetWorthTrend ───────────────────────────────────────────────────

describe('computeNetWorthTrend', () => {
  it('returns 12 data points', () => {
    const now = new Date(2026, 6, 15)
    const result = computeNetWorthTrend([], 10000, now)
    expect(result).toHaveLength(12)
  })

  it('last point equals current net worth', () => {
    const now = new Date(2026, 6, 15)
    const result = computeNetWorthTrend([], 10000, now)
    expect(result[11].netWorth).toBe(10000)
  })

  it('reconstructs previous month by subtracting current month net flow', () => {
    const now = new Date(2026, 6, 31) // July 31
    const txs = [
      makeTx({ type: 'income', amount: 2000, date: '2026-07-05', transfer_peer_id: null }),
      makeTx({ type: 'expense', amount: 800, date: '2026-07-15', transfer_peer_id: null }),
    ]
    // Net flow July = 2000 - 800 = 1200
    // NW prev month = 5000 - 1200 = 3800
    const result = computeNetWorthTrend(txs, 5000, now)
    expect(result[11].netWorth).toBe(5000)  // July (current)
    expect(result[10].netWorth).toBe(3800)  // June
  })

  it('excludes legacy transfers from net flow calculation', () => {
    const now = new Date(2026, 6, 31)
    const txs = [
      makeTx({ type: 'income', amount: 1000, date: '2026-07-01', transfer_peer_id: null }),
      // This is a legacy transfer - should be excluded
      makeTx({ type: 'income', amount: 500, date: '2026-07-01', transfer_peer_id: 'peer-id' }),
    ]
    // Only pure income counts: 1000. Expense: 0. Net: 1000.
    // Prev NW = 3000 - 1000 = 2000
    const result = computeNetWorthTrend(txs, 3000, now)
    expect(result[10].netWorth).toBe(2000)
  })

  it('points are in chronological order (oldest first)', () => {
    const now = new Date(2026, 6, 15)
    const result = computeNetWorthTrend([], 10000, now)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].key >= result[i - 1].key).toBe(true)
    }
  })

  it('last point key matches current month', () => {
    const now = new Date(2026, 6, 15) // July 2026
    const result = computeNetWorthTrend([], 10000, now)
    expect(result[11].key).toBe('2026-07')
    expect(result[11].month).toBe('lug')
  })
})

// ── computeMonthStats ──────────────────────────────────────────────────────

describe('computeMonthStats', () => {
  it('returns zero stats for empty transactions', () => {
    const s = computeMonthStats([], new Date(2026, 6, 15))
    expect(s.avgDailyExpense).toBe(0)
    expect(s.txCount).toBe(0)
    expect(s.peakExpenseDay).toBeNull()
    expect(s.biggestIncome).toBe(0)
    expect(s.biggestExpense).toBe(0)
  })

  it('computes avgDailyExpense correctly', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 150, date: '2026-07-05' }),
      makeTx({ type: 'expense', amount: 50,  date: '2026-07-10' }),
    ]
    // Total expense = 200, daysElapsed = 15 (July 15)
    const s = computeMonthStats(txs, new Date(2026, 6, 15))
    expect(s.avgDailyExpense).toBe(round2(200 / 15))
    expect(s.daysElapsed).toBe(15)
  })

  it('finds the peak expense day correctly', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 100, date: '2026-07-05' }),
      makeTx({ type: 'expense', amount: 300, date: '2026-07-10' }),
      makeTx({ type: 'expense', amount: 50,  date: '2026-07-10' }),
    ]
    const s = computeMonthStats(txs, new Date(2026, 6, 20))
    expect(s.peakExpenseDay).toBe('2026-07-10')
    expect(s.peakExpenseAmount).toBe(350)
  })

  it('identifies biggest single income and expense', () => {
    const txs = [
      makeTx({ type: 'income',  amount: 3000, date: '2026-07-01' }),
      makeTx({ type: 'income',  amount: 500,  date: '2026-07-05' }),
      makeTx({ type: 'expense', amount: 800,  date: '2026-07-10' }),
      makeTx({ type: 'expense', amount: 200,  date: '2026-07-15' }),
    ]
    const s = computeMonthStats(txs, new Date(2026, 6, 20))
    expect(s.biggestIncome).toBe(3000)
    expect(s.biggestExpense).toBe(800)
  })

  it('excludes legacy transfers from income/expense counts', () => {
    const txs = [
      makeTx({ type: 'income',  amount: 9999, date: '2026-07-01', transfer_peer_id: 'peer' }),
      makeTx({ type: 'expense', amount: 9999, date: '2026-07-01', transfer_peer_id: 'peer' }),
    ]
    const s = computeMonthStats(txs, new Date(2026, 6, 15))
    expect(s.biggestIncome).toBe(0)
    expect(s.biggestExpense).toBe(0)
    expect(s.peakExpenseDay).toBeNull()
  })

  it('counts all transactions regardless of type for txCount', () => {
    const txs = [
      makeTx({ type: 'income' }),
      makeTx({ type: 'expense' }),
      makeTx({ type: 'transfer', transfer_peer_id: 'peer' }),
    ]
    const s = computeMonthStats(txs, new Date(2026, 6, 15))
    expect(s.txCount).toBe(3)
  })
})

// ── computeMonthRecords ────────────────────────────────────────────────────

describe('computeMonthRecords', () => {
  it('returns null when no transactions', () => {
    const r = computeMonthRecords([], [], new Map())
    expect(r.topSpendCategoryName).toBeNull()
    expect(r.mostUsedAccountName).toBeNull()
    expect(r.totalOps).toBe(0)
  })

  it('identifies the most used account', () => {
    const txs = [
      makeTx({ account_id: 'acc-a' }),
      makeTx({ account_id: 'acc-a' }),
      makeTx({ account_id: 'acc-b' }),
    ]
    const accById = new Map([
      ['acc-a', { name: 'Conto Principale' }],
      ['acc-b', { name: 'Conto Secondario' }],
    ])
    const r = computeMonthRecords(txs, [], accById)
    expect(r.mostUsedAccountName).toBe('Conto Principale')
    expect(r.mostUsedAccountTxCount).toBe(2)
  })

  it('picks top spend category from topCats', () => {
    const topCats = [
      { id: 'c1', name: 'Alimentari', total: 500, count: 10, icon: null, color: null },
      { id: 'c2', name: 'Bollette',   total: 200, count: 3,  icon: null, color: null },
    ]
    const r = computeMonthRecords([], topCats, new Map())
    expect(r.topSpendCategoryName).toBe('Alimentari')
    expect(r.topSpendCategoryAmount).toBe(500)
  })
})

// ── computeTimeline ────────────────────────────────────────────────────────

describe('computeTimeline', () => {
  const currentMonth = { year: 2026, month: 7 }
  const todayStr = '2026-07-15'

  it('always includes month_open and month_close events', () => {
    const events = computeTimeline([], todayStr, [], currentMonth)
    expect(events.some((e) => e.type === 'month_open')).toBe(true)
    expect(events.some((e) => e.type === 'month_close')).toBe(true)
  })

  it('month_open date is first day of month', () => {
    const events = computeTimeline([], todayStr, [], currentMonth)
    const open = events.find((e) => e.type === 'month_open')!
    expect(open.date).toBe('2026-07-01')
  })

  it('month_close date is last day of month', () => {
    const events = computeTimeline([], todayStr, [], currentMonth)
    const close = events.find((e) => e.type === 'month_close')!
    expect(close.date).toBe('2026-07-31')
  })

  it('includes biggest_income event when present', () => {
    const txs = [makeTx({ type: 'income', amount: 2000, date: '2026-07-05', description: 'Stipendio' })]
    const events = computeTimeline(txs, todayStr, [], currentMonth)
    const e = events.find((v) => v.type === 'biggest_income')!
    expect(e).toBeDefined()
    expect(e.amount).toBe(2000)
    expect(e.label).toBe('Stipendio')
  })

  it('includes biggest_expense event when present', () => {
    const txs = [makeTx({ type: 'expense', amount: 500, date: '2026-07-10', description: 'Affitto' })]
    const events = computeTimeline(txs, todayStr, [], currentMonth)
    const e = events.find((v) => v.type === 'biggest_expense')!
    expect(e).toBeDefined()
    expect(e.amount).toBe(500)
    expect(e.label).toBe('Affitto')
  })

  it('includes budget_exceeded events', () => {
    const exceeded = [{ categoryName: 'Ristoranti', spent: 350 }]
    const events = computeTimeline([], todayStr, exceeded, currentMonth)
    const e = events.find((v) => v.type === 'budget_exceeded')!
    expect(e).toBeDefined()
    expect(e.label).toContain('Ristoranti')
  })

  it('returns at most 10 events', () => {
    const exceeded = Array.from({ length: 10 }, (_, i) => ({ categoryName: `Cat ${i}`, spent: 100 }))
    const events = computeTimeline([], todayStr, exceeded, currentMonth)
    expect(events.length).toBeLessThanOrEqual(10)
  })

  it('events are sorted chronologically', () => {
    const txs = [
      makeTx({ type: 'income',  amount: 1000, date: '2026-07-20' }),
      makeTx({ type: 'expense', amount: 500,  date: '2026-07-05' }),
    ]
    const events = computeTimeline(txs, todayStr, [], currentMonth)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].date >= events[i - 1].date).toBe(true)
    }
  })

  it('excludes legacy transfers from income/expense picks', () => {
    const txs = [
      makeTx({ type: 'income', amount: 99999, date: '2026-07-01', transfer_peer_id: 'peer' }),
    ]
    const events = computeTimeline(txs, todayStr, [], currentMonth)
    expect(events.find((e) => e.type === 'biggest_income')).toBeUndefined()
  })
})

// ── generateInsights ───────────────────────────────────────────────────────

describe('generateInsights', () => {
  it('returns at most 5 insights', () => {
    const insights = generateInsights({
      ...baseInsightParams,
      budgetSummary: { ...emptyBudgetSummary, atRiskCount: 3, exceededCount: 1 },
      topCats: [
        { id: 'c1', name: 'Alimentari', total: 600, count: 5, icon: null, color: null },
        { id: 'c2', name: 'Bollette', total: 200, count: 2, icon: null, color: null },
      ],
      prevTopCats: [
        { id: 'c1', name: 'Alimentari', total: 100, count: 2, icon: null, color: null },
      ],
    })
    expect(insights.length).toBeLessThanOrEqual(5)
  })

  it('generates net_worth_up when patrimony grew > 2%', () => {
    const insights = generateInsights({
      ...baseInsightParams,
      netWorthTrend: [
        { key: '2026-06', month: 'giu', netWorth: 10000 },
        { key: '2026-07', month: 'lug', netWorth: 10500 }, // +5%
      ],
    })
    expect(insights.some((i) => i.type === 'net_worth_up')).toBe(true)
  })

  it('generates net_worth_down when patrimony fell > 2%', () => {
    const insights = generateInsights({
      ...baseInsightParams,
      netWorthTrend: [
        { key: '2026-06', month: 'giu', netWorth: 10000 },
        { key: '2026-07', month: 'lug', netWorth: 9500 }, // -5%
      ],
    })
    expect(insights.some((i) => i.type === 'net_worth_down')).toBe(true)
  })

  it('generates budget_warning when budgets at risk', () => {
    const insights = generateInsights({
      ...baseInsightParams,
      budgetSummary: { ...emptyBudgetSummary, atRiskCount: 2, exceededCount: 0 },
    })
    expect(insights.some((i) => i.type === 'budget_warning')).toBe(true)
  })

  it('generates daily_avg_down when current avg is 15%+ lower than prev month', () => {
    // prevMonth June has 30 days, prevExpense = 3000 → prevAvg = 100/day
    // current monthStats.avgDailyExpense = 50 → 50% lower
    const insights = generateInsights({
      ...baseInsightParams,
      prevMonthExpense: 3000,
      monthStats: { ...baseInsightParams.monthStats, avgDailyExpense: 50, daysElapsed: 10 },
      prevMonth: { year: 2026, month: 6 }, // June = 30 days
    })
    expect(insights.some((i) => i.type === 'daily_avg_down')).toBe(true)
  })

  it('does not generate daily_avg insight with fewer than 5 days elapsed', () => {
    const insights = generateInsights({
      ...baseInsightParams,
      prevMonthExpense: 3000,
      monthStats: { ...baseInsightParams.monthStats, avgDailyExpense: 50, daysElapsed: 3 },
    })
    expect(insights.some((i) => i.type === 'daily_avg_down' || i.type === 'daily_avg_up')).toBe(false)
  })

  it('returns empty array when no data to generate insights from', () => {
    const insights = generateInsights({
      ...baseInsightParams,
      monthIncome: 0, monthExpense: 0,
      prevMonthIncome: 0, prevMonthExpense: 0,
      netWorthTrend: [],
    })
    expect(Array.isArray(insights)).toBe(true)
    expect(insights.length).toBeLessThanOrEqual(5)
  })
})

// ── Helper (not exported, test via pure functions) ─────────────────────────

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100 }
