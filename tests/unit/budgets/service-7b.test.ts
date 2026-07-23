import { describe, expect, it } from 'vitest'
import {
  buildBudgetAlerts,
  buildBudgetComparison,
  buildBudgetForecast,
  buildBudgetHistoryInsights,
  buildBudgetInsights,
  computeBudgetHistory,
  computeEnrichedBudgetSummary,
  getBudgetStatus,
} from '@/lib/budgets/service'
import type { BudgetEntry, BudgetForecast, BudgetStatus, EnrichedBudgetEntry } from '@/lib/budgets/service'

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<BudgetEntry> = {}): BudgetEntry {
  return {
    budgetId:           'b-1',
    categoryId:         'cat-1',
    categoryName:       'Alimentari',
    categoryIcon:       '🛒',
    parentCategoryName: null,
    year:               2026,
    month:              7,
    amount:             400,
    spent:              200,
    remaining:          200,
    percentage:         50,
    status:             'safe',
    ...overrides,
  }
}

function makeEnrichedEntry(
  entryOverrides: Partial<BudgetEntry> = {},
  forecastOverrides: Partial<BudgetForecast> = {},
): EnrichedBudgetEntry {
  const entry = makeEntry(entryOverrides)
  const forecast: BudgetForecast = {
    hasEnoughData:      true,
    projectedSpent:     300,
    projectedRemaining: 100,
    projectedPercentage: 75,
    projectedStatus:    'warning',
    projectedOverrun:   0,
    daysElapsed:        15,
    daysInMonth:        31,
    dailyAvgSpend:      13.33,
    ...forecastOverrides,
  }
  const comparison = {
    prevMonthSpent:    160,
    currentMonthSpent: entry.spent,
    absoluteDiff:      entry.spent - 160,
    percentageDiff:    25,
    trend: 'up' as const,
  }
  return { ...entry, forecast, comparison, topAlert: null }
}

// ── buildBudgetForecast ────────────────────────────────────────────────────

describe('buildBudgetForecast', () => {
  it('returns hasEnoughData=false when daysElapsed < 3', () => {
    const now = new Date(2026, 6, 2) // July 2 (2 days elapsed)
    const fc = buildBudgetForecast(50, 400, 2026, 7, now)
    expect(fc.hasEnoughData).toBe(false)
    expect(fc.projectedSpent).toBe(0)
    expect(fc.daysElapsed).toBe(2)
  })

  it('returns hasEnoughData=false when spent=0 even with enough days', () => {
    const now = new Date(2026, 6, 10)
    const fc = buildBudgetForecast(0, 400, 2026, 7, now)
    expect(fc.hasEnoughData).toBe(false)
  })

  it('computes correct projection for current month', () => {
    const now = new Date(2026, 6, 10) // July 10 = 10 days elapsed
    const fc = buildBudgetForecast(100, 400, 2026, 7, now)
    expect(fc.hasEnoughData).toBe(true)
    expect(fc.daysElapsed).toBe(10)
    expect(fc.daysInMonth).toBe(31)
    expect(fc.dailyAvgSpend).toBe(10)
    expect(fc.projectedSpent).toBe(310) // 10 * 31
    expect(fc.projectedRemaining).toBe(90)
    expect(fc.projectedOverrun).toBe(0)
  })

  it('computes overrun when projection exceeds budget', () => {
    const now = new Date(2026, 6, 10)
    const fc = buildBudgetForecast(200, 400, 2026, 7, now) // 20/day → 620/month
    expect(fc.projectedSpent).toBe(620)
    expect(fc.projectedOverrun).toBe(220)
    expect(fc.projectedStatus).toBe('exceeded')
    expect(fc.projectedPercentage).toBe(155)
  })

  it('uses daysInMonth=28 for February non-leap year', () => {
    const now = new Date(2025, 1, 10)
    const fc = buildBudgetForecast(100, 400, 2025, 2, now)
    expect(fc.daysInMonth).toBe(28)
    expect(fc.projectedSpent).toBe(280) // 10/day × 28
  })

  it('uses daysInMonth=29 for February leap year', () => {
    const now = new Date(2024, 1, 10)
    const fc = buildBudgetForecast(100, 400, 2024, 2, now)
    expect(fc.daysInMonth).toBe(29)
    expect(fc.projectedSpent).toBe(290)
  })

  it('uses daysInMonth=30 for April', () => {
    const now = new Date(2026, 3, 10) // April 10
    const fc = buildBudgetForecast(100, 400, 2026, 4, now)
    expect(fc.daysInMonth).toBe(30)
  })

  it('uses daysInMonth=31 for July', () => {
    const now = new Date(2026, 6, 10)
    const fc = buildBudgetForecast(100, 400, 2026, 7, now)
    expect(fc.daysInMonth).toBe(31)
  })

  it('handles past months with daysElapsed = daysInMonth', () => {
    const now = new Date(2026, 6, 15) // current = July 2026
    const fc = buildBudgetForecast(180, 400, 2026, 6, now) // June (past)
    expect(fc.daysElapsed).toBe(30) // June has 30 days
    expect(fc.daysInMonth).toBe(30)
    expect(fc.projectedSpent).toBe(180) // same as spent (full month)
  })

  it('returns hasEnoughData=false for future months', () => {
    const now = new Date(2026, 6, 15) // July 2026
    const fc = buildBudgetForecast(0, 400, 2026, 8, now) // August (future)
    expect(fc.hasEnoughData).toBe(false)
    expect(fc.daysElapsed).toBe(0)
  })

  it('no division by zero when daysElapsed=0 (future)', () => {
    const now = new Date(2026, 6, 15)
    expect(() => buildBudgetForecast(0, 400, 2026, 9, now)).not.toThrow()
    const fc = buildBudgetForecast(0, 400, 2026, 9, now)
    expect(fc.dailyAvgSpend).toBe(0)
  })

  it('projectedPercentage over 100% when projection exceeds budget', () => {
    const now = new Date(2026, 6, 5) // July 5 = 5 days
    const fc = buildBudgetForecast(300, 400, 2026, 7, now) // 60/day → 1860
    expect(fc.projectedPercentage).toBeGreaterThan(100)
    expect(fc.projectedStatus).toBe('exceeded')
  })

  it('first day of month (day 1) has hasEnoughData=false', () => {
    const now = new Date(2026, 6, 1)
    const fc = buildBudgetForecast(50, 400, 2026, 7, now)
    expect(fc.hasEnoughData).toBe(false)
  })

  it('last day of month has correct daysElapsed', () => {
    const now = new Date(2026, 6, 31) // July 31
    const fc = buildBudgetForecast(300, 400, 2026, 7, now)
    expect(fc.daysElapsed).toBe(31)
    expect(fc.daysInMonth).toBe(31)
    expect(fc.projectedSpent).toBe(300) // daysElapsed = daysInMonth → projection = spent
  })
})

// ── buildBudgetComparison ──────────────────────────────────────────────────

describe('buildBudgetComparison', () => {
  it('trend=up when current > prev by >3%', () => {
    const cmp = buildBudgetComparison(200, 150)
    expect(cmp.trend).toBe('up')
    expect(cmp.absoluteDiff).toBe(50)
    expect(cmp.percentageDiff).toBe(33) // ~33%
  })

  it('trend=down when current < prev by >3%', () => {
    const cmp = buildBudgetComparison(100, 200)
    expect(cmp.trend).toBe('down')
    expect(cmp.absoluteDiff).toBe(-100)
    expect(cmp.percentageDiff).toBe(-50)
  })

  it('trend=stable when change < 3% relative', () => {
    const cmp = buildBudgetComparison(102, 100) // +2%
    expect(cmp.trend).toBe('stable')
  })

  it('trend=unavailable when prevSpent=0 and current>0', () => {
    const cmp = buildBudgetComparison(100, 0)
    expect(cmp.trend).toBe('unavailable')
    expect(cmp.percentageDiff).toBe(0)
  })

  it('trend=stable when both are zero', () => {
    const cmp = buildBudgetComparison(0, 0)
    expect(cmp.trend).toBe('stable')
  })

  it('handles current=0 vs nonzero prev', () => {
    const cmp = buildBudgetComparison(0, 200)
    expect(cmp.trend).toBe('down')
    expect(cmp.absoluteDiff).toBe(-200)
  })

  it('no division by zero when prevSpent=0', () => {
    expect(() => buildBudgetComparison(150, 0)).not.toThrow()
  })

  it('parent category comparison works (caller handles rollup)', () => {
    const cmp = buildBudgetComparison(300, 250)
    expect(cmp.trend).toBe('up')
  })
})

// ── buildBudgetAlerts ─────────────────────────────────────────────────────

describe('buildBudgetAlerts', () => {
  it('emits threshold_50 alert at 50%', () => {
    const entry = { categoryId: 'c1', categoryName: 'Test', spent: 50, amount: 100, percentage: 50 }
    const forecasts = new Map()
    const alerts = buildBudgetAlerts([entry], forecasts)
    expect(alerts.some((a) => a.type === 'threshold_50')).toBe(true)
  })

  it('emits threshold_75 at 75% (not threshold_50)', () => {
    const entry = { categoryId: 'c1', categoryName: 'Test', spent: 75, amount: 100, percentage: 75 }
    const alerts = buildBudgetAlerts([entry], new Map())
    expect(alerts.some((a) => a.type === 'threshold_75')).toBe(true)
    expect(alerts.some((a) => a.type === 'threshold_50')).toBe(false)
  })

  it('emits threshold_90 at 90%', () => {
    const entry = { categoryId: 'c1', categoryName: 'Test', spent: 90, amount: 100, percentage: 90 }
    const alerts = buildBudgetAlerts([entry], new Map())
    expect(alerts.some((a) => a.type === 'threshold_90')).toBe(true)
  })

  it('emits threshold_100 at 100% or more', () => {
    const entry = { categoryId: 'c1', categoryName: 'Test', spent: 110, amount: 100, percentage: 110 }
    const alerts = buildBudgetAlerts([entry], new Map())
    expect(alerts.some((a) => a.type === 'threshold_100')).toBe(true)
  })

  it('emits projected_overrun when forecast shows overrun and not yet exceeded', () => {
    const entry = { categoryId: 'c1', categoryName: 'Test', spent: 50, amount: 100, percentage: 50 }
    const fc: BudgetForecast = {
      hasEnoughData: true, projectedSpent: 130, projectedRemaining: -30,
      projectedPercentage: 130, projectedStatus: 'exceeded', projectedOverrun: 30,
      daysElapsed: 10, daysInMonth: 31, dailyAvgSpend: 5,
    }
    const alerts = buildBudgetAlerts([entry], new Map([['c1', fc]]))
    expect(alerts.some((a) => a.type === 'projected_overrun')).toBe(true)
  })

  it('does NOT emit projected_overrun when already exceeded', () => {
    const entry = { categoryId: 'c1', categoryName: 'Test', spent: 110, amount: 100, percentage: 110 }
    const fc: BudgetForecast = {
      hasEnoughData: true, projectedSpent: 150, projectedRemaining: -50,
      projectedPercentage: 150, projectedStatus: 'exceeded', projectedOverrun: 50,
      daysElapsed: 10, daysInMonth: 31, dailyAvgSpend: 11,
    }
    const alerts = buildBudgetAlerts([entry], new Map([['c1', fc]]))
    expect(alerts.some((a) => a.type === 'projected_overrun')).toBe(false)
  })

  it('no duplicate real threshold per category', () => {
    const entry = { categoryId: 'c1', categoryName: 'Test', spent: 80, amount: 100, percentage: 80 }
    const alerts = buildBudgetAlerts([entry], new Map())
    const realAlerts = alerts.filter((a) => a.type !== 'projected_overrun')
    expect(realAlerts.length).toBe(1)
  })

  it('returns empty array when no entries', () => {
    expect(buildBudgetAlerts([], new Map())).toEqual([])
  })

  it('sorts by priority (1=highest first)', () => {
    const entries = [
      { categoryId: 'c1', categoryName: 'A', spent: 50, amount: 100, percentage: 50 },
      { categoryId: 'c2', categoryName: 'B', spent: 110, amount: 100, percentage: 110 },
    ]
    const alerts = buildBudgetAlerts(entries, new Map())
    expect(alerts[0].priority).toBeLessThanOrEqual(alerts[alerts.length - 1].priority)
  })
})

// ── buildBudgetInsights ───────────────────────────────────────────────────

describe('buildBudgetInsights', () => {
  it('returns empty array for no entries', () => {
    expect(buildBudgetInsights([])).toEqual([])
  })

  it('returns at most maxCount insights', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEnrichedEntry({ categoryId: `c${i}`, categoryName: `Cat${i}`, percentage: 80 }, { projectedOverrun: 50 }),
    )
    expect(buildBudgetInsights(entries, 5).length).toBeLessThanOrEqual(5)
    expect(buildBudgetInsights(entries, 3).length).toBeLessThanOrEqual(3)
  })

  it('generates projected_overrun insight when forecast shows overrun', () => {
    const entry = makeEnrichedEntry({ percentage: 50 }, { hasEnoughData: true, projectedOverrun: 100 })
    const ins = buildBudgetInsights([entry])
    expect(ins.some((i) => i.type === 'projected_overrun')).toBe(true)
  })

  it('generates spending_down insight when comparison trend is down', () => {
    const entry = makeEnrichedEntry({}, {
      hasEnoughData: false,
      projectedOverrun: 0,
    })
    entry.comparison = { ...entry.comparison, trend: 'down', percentageDiff: -30, absoluteDiff: -60 }
    const ins = buildBudgetInsights([entry])
    expect(ins.some((i) => i.type === 'spending_down_vs_last_month')).toBe(true)
  })

  it('generates early_month_high_spend for daysElapsed<10 and percentage>40', () => {
    const entry = makeEnrichedEntry({ percentage: 45 }, {
      hasEnoughData: true, daysElapsed: 5, projectedOverrun: 0,
    })
    const ins = buildBudgetInsights([entry])
    expect(ins.some((i) => i.type === 'early_month_high_spend')).toBe(true)
  })

  it('no contradictory insights for same category', () => {
    const entry = makeEnrichedEntry({ percentage: 80 }, { projectedOverrun: 0 })
    const ins = buildBudgetInsights([entry])
    const types = ins.filter((i) => i.categoryName === entry.categoryName).map((i) => i.type)
    // Should not have both projected_overrun AND consistently_within_budget for same category
    expect(types.includes('projected_overrun') && types.includes('consistently_within_budget')).toBe(false)
  })

  it('default max is 5', () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEnrichedEntry({ categoryId: `c${i}`, categoryName: `Cat${i}`, percentage: 90 }, { projectedOverrun: 50 }),
    )
    expect(buildBudgetInsights(entries).length).toBeLessThanOrEqual(5)
  })
})

// ── computeBudgetHistory ──────────────────────────────────────────────────

describe('computeBudgetHistory', () => {
  const now = new Date(2026, 6, 15) // July 15, 2026

  it('returns exactly 12 points', () => {
    const h = computeBudgetHistory('cat-1', [], [], [], now)
    expect(h).toHaveLength(12)
  })

  it('first point is 12 months ago, last is current month', () => {
    const h = computeBudgetHistory('cat-1', [], [], [], now)
    expect(h[0].year).toBe(2025)
    expect(h[0].month).toBe(8) // August 2025 (July 2026 - 11)
    expect(h[11].year).toBe(2026)
    expect(h[11].month).toBe(7)
  })

  it('months without budget have hadBudget=false and budgetAmount=0', () => {
    const h = computeBudgetHistory('cat-1', [], [], [], now)
    expect(h.every((p) => !p.hadBudget)).toBe(true)
    expect(h.every((p) => p.budgetAmount === 0)).toBe(true)
  })

  it('months with budget have hadBudget=true and correct amount', () => {
    const budgets = [{ year: 2026, month: 7, amount: 400 }]
    const h = computeBudgetHistory('cat-1', [], budgets, [], now)
    const julyPoint = h.find((p) => p.year === 2026 && p.month === 7)!
    expect(julyPoint.hadBudget).toBe(true)
    expect(julyPoint.budgetAmount).toBe(400)
  })

  it('computes spent from transactions within the correct month', () => {
    const txs = [
      { category_id: 'cat-1', amount: '100', date: '2026-07-05' },
      { category_id: 'cat-1', amount: '50',  date: '2026-07-15' },
      { category_id: 'cat-1', amount: '200', date: '2026-06-10' }, // different month
    ]
    const budgets = [{ year: 2026, month: 7, amount: 400 }]
    const h = computeBudgetHistory('cat-1', [], budgets, txs, now)
    const julyPoint = h.find((p) => p.year === 2026 && p.month === 7)!
    expect(julyPoint.spent).toBe(150)
  })

  it('includes child category transactions in parent history', () => {
    const txs = [
      { category_id: 'cat-child', amount: '80', date: '2026-07-10' },
    ]
    const budgets = [{ year: 2026, month: 7, amount: 400 }]
    const h = computeBudgetHistory('cat-1', ['cat-child'], budgets, txs, now)
    const julyPoint = h.find((p) => p.year === 2026 && p.month === 7)!
    expect(julyPoint.spent).toBe(80)
  })

  it('computes correct status for each month', () => {
    const budgets = [{ year: 2026, month: 7, amount: 100 }]
    const txs = [{ category_id: 'cat-1', amount: '110', date: '2026-07-10' }]
    const h = computeBudgetHistory('cat-1', [], budgets, txs, now)
    const julyPoint = h.find((p) => p.year === 2026 && p.month === 7)!
    expect(julyPoint.status).toBe('exceeded')
    expect(julyPoint.percentage).toBe(110)
  })

  it('crosses year boundary correctly (August 2025 in 12-month window)', () => {
    const h = computeBudgetHistory('cat-1', [], [], [], now)
    const aug2025 = h.find((p) => p.year === 2025 && p.month === 8)
    expect(aug2025).toBeDefined()
  })

  it('months with no txs have spent=0', () => {
    const budgets = [{ year: 2026, month: 6, amount: 200 }]
    const h = computeBudgetHistory('cat-1', [], budgets, [], now)
    const junePoint = h.find((p) => p.year === 2026 && p.month === 6)!
    expect(junePoint.spent).toBe(0)
    expect(junePoint.status).toBe('safe')
  })
})

// ── buildBudgetHistoryInsights ────────────────────────────────────────────

describe('buildBudgetHistoryInsights', () => {
  it('returns empty for no history', () => {
    expect(buildBudgetHistoryInsights([])).toEqual([])
  })

  it('returns empty for history with no budgets', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      year: 2026, month: i + 1, budgetAmount: 0, spent: 0, remaining: 0,
      percentage: 0, status: 'safe' as const, hadBudget: false,
    }))
    expect(buildBudgetHistoryInsights(history)).toEqual([])
  })

  it('generates repeated_overrun when exceeded >= 2 of last 6 months', () => {
    // months 11 and 12 (indices 10-11) are exceeded → within last 6 of 12
    const history = Array.from({ length: 12 }, (_, i) => ({
      year: 2026, month: i + 1, budgetAmount: 100, spent: i >= 10 ? 120 : 80,
      remaining: i >= 10 ? -20 : 20, percentage: i >= 10 ? 120 : 80,
      status: (i >= 10 ? 'exceeded' : 'safe') as BudgetStatus, hadBudget: true,
    }))
    const ins = buildBudgetHistoryInsights(history)
    expect(ins.some((i) => i.type === 'repeated_overrun')).toBe(true)
  })

  it('generates consistently_within_budget for 3+ consecutive safe months', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      year: 2026, month: i + 1, budgetAmount: 100, spent: 50,
      remaining: 50, percentage: 50, status: 'safe' as const, hadBudget: true,
    }))
    const ins = buildBudgetHistoryInsights(history)
    expect(ins.some((i) => i.type === 'consistently_within_budget')).toBe(true)
  })

  it('generates best_month and worst_month for >=3 months with budget', () => {
    const history = [
      { year: 2026, month: 1, budgetAmount: 100, spent: 50, remaining: 50, percentage: 50, status: 'safe' as const, hadBudget: true },
      { year: 2026, month: 2, budgetAmount: 100, spent: 80, remaining: 20, percentage: 80, status: 'warning' as const, hadBudget: true },
      { year: 2026, month: 3, budgetAmount: 100, spent: 120, remaining: -20, percentage: 120, status: 'exceeded' as const, hadBudget: true },
    ]
    const ins = buildBudgetHistoryInsights(history)
    expect(ins.some((i) => i.type === 'best_month_in_period')).toBe(true)
    expect(ins.some((i) => i.type === 'worst_month_in_period')).toBe(true)
  })

  it('max 5 insights', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      year: 2026, month: i + 1, budgetAmount: 100, spent: i % 2 === 0 ? 120 : 50,
      remaining: i % 2 === 0 ? -20 : 50, percentage: i % 2 === 0 ? 120 : 50,
      status: (i % 2 === 0 ? 'exceeded' : 'safe') as BudgetStatus, hadBudget: true,
    }))
    expect(buildBudgetHistoryInsights(history, 5).length).toBeLessThanOrEqual(5)
  })
})

// ── computeEnrichedBudgetSummary ──────────────────────────────────────────

describe('computeEnrichedBudgetSummary', () => {
  it('sets projectedTotalSpent from entries with hasEnoughData', () => {
    const e1 = makeEnrichedEntry({ categoryId: 'c1', categoryName: 'A' }, { hasEnoughData: true, projectedSpent: 300, projectedOverrun: 0 })
    const e2 = makeEnrichedEntry({ categoryId: 'c2', categoryName: 'B' }, { hasEnoughData: true, projectedSpent: 200, projectedOverrun: 0 })
    const base = { totalBudgets: 2, totalAmount: 800, totalSpent: 500, totalRemaining: 300, atRiskCount: 0, exceededCount: 0, topRiskBudgets: [] }
    const result = computeEnrichedBudgetSummary(base, [e1, e2], [], [])
    expect(result.projectedTotalSpent).toBe(500)
  })

  it('excludes entries without hasEnoughData from projections', () => {
    const e1 = makeEnrichedEntry({}, { hasEnoughData: false, projectedSpent: 999 })
    const base = { totalBudgets: 1, totalAmount: 400, totalSpent: 50, totalRemaining: 350, atRiskCount: 0, exceededCount: 0, topRiskBudgets: [] }
    const result = computeEnrichedBudgetSummary(base, [e1], [], [])
    expect(result.projectedTotalSpent).toBe(0)
  })

  it('topProjectedRisks limited to 3 entries sorted by overrun desc', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEnrichedEntry(
        { categoryId: `c${i}`, categoryName: `Cat${i}`, amount: 100 },
        { hasEnoughData: true, projectedOverrun: (i + 1) * 10, projectedSpent: 100 + (i + 1) * 10 },
      ),
    )
    const base = { totalBudgets: 5, totalAmount: 500, totalSpent: 250, totalRemaining: 250, atRiskCount: 0, exceededCount: 0, topRiskBudgets: [] }
    const result = computeEnrichedBudgetSummary(base, entries, [], [])
    expect(result.topProjectedRisks).toHaveLength(3)
    // Sorted by projectedOverrun descending
    expect(result.topProjectedRisks[0].projectedOverrun).toBeGreaterThanOrEqual(result.topProjectedRisks[1].projectedOverrun)
  })

  it('preserves all base BudgetSummary fields', () => {
    const base = { totalBudgets: 2, totalAmount: 300, totalSpent: 100, totalRemaining: 200, atRiskCount: 1, exceededCount: 0, topRiskBudgets: [] }
    const result = computeEnrichedBudgetSummary(base, [], [], [])
    expect(result.totalBudgets).toBe(2)
    expect(result.totalAmount).toBe(300)
    expect(result.atRiskCount).toBe(1)
  })

  it('budgetAlerts and budgetInsights are passed through', () => {
    const base = { totalBudgets: 0, totalAmount: 0, totalSpent: 0, totalRemaining: 0, atRiskCount: 0, exceededCount: 0, topRiskBudgets: [] }
    const alert = { type: 'threshold_75' as const, categoryName: 'Test', threshold: 75, currentPercentage: 75, message: 'msg', priority: 3 }
    const insight = { type: 'projected_overrun' as const, categoryName: 'Test', message: 'msg', priority: 1 }
    const result = computeEnrichedBudgetSummary(base, [], [alert], [insight])
    expect(result.budgetAlerts).toContainEqual(alert)
    expect(result.budgetInsights).toContainEqual(insight)
  })
})

// ── getBudgetStatus edge cases ────────────────────────────────────────────

describe('getBudgetStatus — edge cases', () => {
  it('returns safe at 0%', () => expect(getBudgetStatus(0)).toBe('safe'))
  it('returns warning at exactly 75%', () => expect(getBudgetStatus(75)).toBe('warning'))
  it('returns critical at exactly 90%', () => expect(getBudgetStatus(90)).toBe('critical'))
  it('returns exceeded at exactly 100%', () => expect(getBudgetStatus(100)).toBe('exceeded'))
  it('returns exceeded at 150%', () => expect(getBudgetStatus(150)).toBe('exceeded'))
  it('returns exceeded at 200%', () => expect(getBudgetStatus(200)).toBe('exceeded'))
})
