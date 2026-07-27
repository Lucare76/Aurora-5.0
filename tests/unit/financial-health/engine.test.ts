import { describe, expect, it } from 'vitest'
import { calculateBudgetScore, summarizeBudgets } from '@/lib/financial-health/budgets'
import { calculateDataQuality } from '@/lib/financial-health/data-quality'
import { calculateDeadlineScore, summarizeDeadlines } from '@/lib/financial-health/deadlines'
import { calculateDebtScore, summarizeDebt } from '@/lib/financial-health/debt'
import { buildMonthPeriod, dateKey, previousComparablePeriod, safeRatio, addDays, addMonths, monthKey, formatEuro, clamp, toNumber } from '@/lib/financial-health/helpers'
import { calculateLiquidityScore } from '@/lib/financial-health/liquidity'
import { calculateWeightedHealthScore, scoreLevel } from '@/lib/financial-health/score'
import { calculateCashFlowStability, calculateSavingsScore } from '@/lib/financial-health/savings'
import { buildRecommendations } from '@/lib/financial-health/recommendations'
import { buildTrends } from '@/lib/financial-health/trends'
import { calculateFinancialHealth } from '@/lib/financial-health/engine'
import type { ComponentScore, FinancialHealthInput, HealthComponentKey } from '@/lib/financial-health/types'

const period = { from: '2026-07-01', to: '2026-07-31', key: '2026-07', label: 'lug 2026', days: 31, isCurrentPeriod: true }
const previousPeriod = { from: '2026-06-01', to: '2026-06-30', key: '2026-06', label: 'giu 2026', days: 30, isCurrentPeriod: false }

function baseInput(overrides: Partial<FinancialHealthInput> = {}): FinancialHealthInput {
  const input: FinancialHealthInput = {
    now: '2026-07-15T12:00:00.000Z',
    timezone: 'Europe/Rome',
    accounts: [
      { id: 'acc-1', name: 'Bancoposta', type: 'checking', balance: 2000, currency: 'EUR', is_active: true, is_hidden: false },
      { id: 'acc-2', name: 'Investimento', type: 'investment', balance: 5000, currency: 'EUR', is_active: true, is_hidden: false },
    ],
    categories: [
      { id: 'cat-income', name: 'Stipendio', type: 'income', parent_id: null },
      { id: 'cat-food', name: 'Alimentari', type: 'expense', parent_id: null },
    ],
    transactions: [
      { id: 'tx-1', account_id: 'acc-1', category_id: 'cat-income', type: 'income', amount: 2500, description: 'STIPENDIO', date: '2026-07-01', transfer_peer_id: null },
      { id: 'tx-2', account_id: 'acc-1', category_id: 'cat-food', type: 'expense', amount: 400, description: 'SPESA', date: '2026-07-03', transfer_peer_id: null },
      { id: 'tx-3', account_id: 'acc-1', category_id: 'cat-food', type: 'expense', amount: 150, description: 'SPESA', date: '2026-07-10', transfer_peer_id: null },
      { id: 'tx-4', account_id: 'acc-1', category_id: 'cat-income', type: 'income', amount: 2400, description: 'STIPENDIO', date: '2026-06-01', transfer_peer_id: null },
      { id: 'tx-5', account_id: 'acc-1', category_id: 'cat-food', type: 'expense', amount: 800, description: 'SPESA', date: '2026-06-12', transfer_peer_id: null },
      { id: 'tx-6', account_id: 'acc-1', category_id: null, type: 'expense', amount: 30, description: 'VARIE', date: '2026-05-12', transfer_peer_id: null },
      { id: 'tx-transfer', account_id: 'acc-1', category_id: null, type: 'transfer', amount: 100, description: 'GIROCONTO', date: '2026-07-12', transfer_peer_id: 'acc-2' },
    ],
    projectedLiquidity: {
      currentBalance: 2000,
      minProjectedBalance7d: 1800,
      minProjectedBalance30d: 1500,
      minProjectedBalance90d: 1000,
      minProjectedBalanceDate: '2026-07-20',
      negativeDays7d: 0,
      negativeDays30d: 0,
      negativeDays90d: 0,
      negativeAccounts30d: 0,
      maxOverdraft: 0,
      projectedIncome30d: 0,
      projectedExpenses30d: 0,
      dailySeries: [
        { date: '2026-07-15', label: '15 lug', balance: 7000, income: 0, expenses: 0 },
        { date: '2026-07-16', label: '16 lug', balance: 6950, income: 0, expenses: 50 },
      ],
    },
    recurringItems: [],
    budgets: [{ id: 'budget-1', category_id: 'cat-food', amount: 700, month: 7, year: 2026 }],
    goals: [{ id: 'goal-1', name: 'Vacanze', target_amount: 1000, current_amount: 650, target_date: '2026-12-31', status: 'ACTIVE', archived: false, created_at: '2026-01-01T00:00:00.000Z' }],
    goalContributions: [],
    loans: [],
    loanPayments: [],
    notifications: [],
    period,
    previousPeriod,
    historicalMonthlyMetrics: [
      { key: '2026-05', income: 2200, expenses: 1200, netCashFlow: 1000, savingsRate: 45.45, transactionCount: 10, daysObserved: 8 },
      { key: '2026-06', income: 2400, expenses: 800, netCashFlow: 1600, savingsRate: 66.67, transactionCount: 12, daysObserved: 9 },
      { key: '2026-07', income: 2500, expenses: 550, netCashFlow: 1950, savingsRate: 78, transactionCount: 15, daysObserved: 11 },
    ],
  }
  return { ...input, ...overrides }
}

describe('financial-health engine', () => {
  it('marks zero or tiny datasets as provisional with insufficient quality', () => {
    const input = baseInput({ transactions: [] })
    const quality = calculateDataQuality(input)
    expect(quality.level).toBe('INSUFFICIENT')
    expect(quality.isProvisional).toBe(true)
  })

  it('does not count transfers as income or expenses', () => {
    const result = calculateFinancialHealth(baseInput())
    expect(result.metrics.monthlyIncome).toBe(2500)
    expect(result.metrics.monthlyExpenses).toBe(550)
  })

  it('calculates a deterministic score and explicit component weights', () => {
    const result = calculateFinancialHealth(baseInput())
    expect(result.totalScore).toBeGreaterThan(70)
    expect(result.componentWeights.liquidity).toBe(25)
    expect(result.componentScores.goals.availability).toBe('AVAILABLE')
  })

  it('renormalizes when goals are not applicable', () => {
    const result = calculateFinancialHealth(baseInput({ goals: [] }))
    expect(result.componentScores.goals.availability).toBe('NOT_APPLICABLE')
    expect(result.missingWeight).toBeGreaterThan(0)
    expect(result.totalScore).not.toBeNull()
  })

  it('does not penalize missing budgets as zero score', () => {
    const result = calculateFinancialHealth(baseInput({ budgets: [] }))
    expect(result.componentScores.budgets.availability).toBe('NOT_APPLICABLE')
    expect(result.componentScores.budgets.score).toBeNull()
  })

  it('penalizes projected negative liquidity and clamps the score', () => {
    const score = calculateLiquidityScore({
      currentBalance: 100,
      minProjectedBalance7d: -500,
      minProjectedBalance30d: -700,
      minProjectedBalance90d: -900,
      negativeDays: 20,
      expenseCoverageMonths: 0.2,
      weight: 25,
    })
    expect(score.score).toBeGreaterThanOrEqual(0)
    expect(score.score).toBeLessThan(50)
  })

  it('flags exceeded budgets', () => {
    const component = calculateBudgetScore({
      activeBudgets: 1,
      warningBudgets: 0,
      exceededBudgets: 1,
      totalLimit: 100,
      totalSpent: 150,
      aggregateUsagePercentage: 150,
      totalOverspend: 50,
      atRiskCategories: [],
    }, 15)
    expect(component.status).toBe('watch')
    expect(component.factors[0].id).toBe('budgets-exceeded')
  })

  it('returns debt as positive when no loans are registered', () => {
    const result = calculateFinancialHealth(baseInput({ loans: [] }))
    expect(result.componentScores.debt.score).toBe(100)
  })

  it('detects overdue loans as debt and deadline risk', () => {
    const result = calculateFinancialHealth(baseInput({
      loans: [{ id: 'loan-1', counterpart: 'Mario', type: 'received', amount: 1000, remaining: 600, due_date: '2026-07-01', is_settled: false }],
    }))
    expect(result.metrics.overduePayments).toBe(1)
    expect(result.metrics.overdueDeadlines).toBe(1)
    expect(result.negativeFactors.some((factor) => factor.id === 'debt-overdue')).toBe(true)
  })

  it('detects goals behind expected trajectory', () => {
    const result = calculateFinancialHealth(baseInput({
      goals: [{ id: 'goal-1', name: 'Casa', target_amount: 1000, current_amount: 100, target_date: '2026-08-01', status: 'ACTIVE', archived: false, created_at: '2026-01-01T00:00:00.000Z' }],
    }))
    expect(result.metrics.behindGoals).toBe(1)
  })

  it('limits deterministic recommendations to five and avoids regulated advice', () => {
    const recommendations = buildRecommendations({
      dataIsInsufficient: false,
      factors: [],
      metrics: {
        ...calculateFinancialHealth(baseInput()).metrics,
        exceededBudgets: 2,
        projectedLiquidity30d: -50,
        paymentToIncomeRatio: 45,
        behindGoals: 2,
        activeCriticalAlerts: 1,
      },
    })
    expect(recommendations).toHaveLength(5)
    expect(recommendations.map((item) => item.description).join(' ')).not.toMatch(/invest|prestito consigliato/i)
  })

  it('builds trends with metric-specific interpretation', () => {
    const trends = buildTrends({
      metrics: calculateFinancialHealth(baseInput()).metrics,
      previousMetrics: { monthlyExpenses: 400, monthlyIncome: 2000 },
      totalScore: 80,
      previousScore: 70,
    })
    expect(trends.find((trend) => trend.metric === 'monthlyIncome')?.interpretation).toBe('positive')
    expect(trends.find((trend) => trend.metric === 'monthlyExpenses')?.interpretation).toBe('negative')
  })

  it('handles active critical alerts with limited double-counting penalty', () => {
    const result = calculateFinancialHealth(baseInput({
      notifications: [
        { id: 'n1', type: 'budget_threshold', severity: 'CRITICAL', source_type: 'budget', source_id: 'budget-1', source_url: null, is_read: false, archived_at: null, resolved_at: null, created_at: '2026-07-10T00:00:00.000Z' },
        { id: 'n2', type: 'automation_failure', severity: 'CRITICAL', source_type: 'automation', source_id: 'rule-1', source_url: null, is_read: false, archived_at: null, resolved_at: null, created_at: '2026-07-10T00:00:00.000Z' },
      ],
    }))
    expect(result.metrics.activeCriticalAlerts).toBe(2)
    expect(result.componentScores.alerts.score).toBeGreaterThan(50)
  })

  it('returns a provisional warning for insufficient data instead of throwing', () => {
    const result = calculateFinancialHealth(baseInput({ transactions: [], historicalMonthlyMetrics: [] }))
    expect(result.totalScore).not.toBeNull()
    expect(result.isProvisional).toBe(true)
    expect(result.recommendations[0].reasonCode).toBe('INSUFFICIENT_DATA')
  })

  it('exposes dashboard-ready data without client-side recalculation', () => {
    const result = calculateFinancialHealth(baseInput({
      notifications: [
        { id: 'alert-1', type: 'budget_threshold', severity: 'WARNING', source_type: 'budget', source_id: 'budget-1', source_url: '/budgets', is_read: false, archived_at: null, resolved_at: null, created_at: '2026-07-10T00:00:00.000Z' },
      ],
      budgets: [{ id: 'budget-1', category_id: 'cat-food', amount: 600, month: 7, year: 2026 }],
      loans: [{ id: 'loan-1', counterpart: 'Mario', type: 'received', amount: 500, remaining: 250, due_date: '2026-07-20', is_settled: false }],
      recurringItems: [{ id: 'rec-1', account_id: 'acc-1', category_id: 'cat-food', type: 'expense', amount: 40, description: 'ABBONAMENTO', frequency: 'monthly', start_date: '2026-01-01', end_date: null, next_due_date: '2026-07-18', is_active: true, auto_create: true }],
    }))

    expect(result.dashboard.projectedLiquiditySeries).toHaveLength(2)
    expect(result.dashboard.monthlyCashFlowSeries.at(-1)?.key).toBe('2026-07')
    expect(result.dashboard.budgetFocus[0]).toMatchObject({ categoryName: 'Alimentari', status: 'warning' })
    expect(result.dashboard.deadlineFocus.map((item) => item.type)).toContain('recurring')
    expect(result.dashboard.loanFocus[0]).toMatchObject({ counterpart: 'Mario' })
    expect(result.dashboard.goalFocus[0]).toMatchObject({ name: 'Vacanze' })
    expect(result.dashboard.alertFocus[0]).toMatchObject({ severity: 'WARNING' })
  })

  it('returns null total score only when every component is unavailable', () => {
    const unavailable = (component: HealthComponentKey): ComponentScore => ({
      component,
      score: null,
      weight: 10,
      contribution: 0,
      availability: 'NOT_APPLICABLE',
      status: 'neutral',
      factors: [],
    })
    const result = calculateWeightedHealthScore({
      liquidity: unavailable('liquidity'),
      savings: unavailable('savings'),
      budgets: unavailable('budgets'),
      debt: unavailable('debt'),
      deadlines: unavailable('deadlines'),
      goals: unavailable('goals'),
      alerts: unavailable('alerts'),
    })
    expect(result.totalScore).toBeNull()
    expect(result.completenessPercentage).toBe(0)
  })

  it('covers date and ratio helpers used by period parsing', () => {
    const date = new Date(2026, 6, 15)
    expect(dateKey(date)).toBe('2026-07-15')
    expect(monthKey(date)).toBe('2026-07')
    expect(dateKey(addDays(date, 1))).toBe('2026-07-16')
    expect(monthKey(addMonths(date, 1))).toBe('2026-08')
    expect(buildMonthPeriod(date).from).toBe('2026-07-01')
    expect(previousComparablePeriod({ from: '2026-07-01', to: '2026-07-31' }).to).toBe('2026-06-30')
    expect(safeRatio(10, 0)).toBeNull()
    expect(safeRatio(25, 100)).toBe(25)
    expect(clamp(Number.NaN)).toBe(0)
    expect(toNumber('not-a-number')).toBe(0)
    expect(formatEuro(1234.56)).toContain('1234,56')
  })

  it('recognizes excellent data quality with long categorized history', () => {
    const transactions = Array.from({ length: 100 }, (_, index) => ({
      id: `tx-long-${index}`,
      account_id: 'acc-1',
      category_id: index % 10 === 0 ? null : 'cat-food',
      type: index % 5 === 0 ? 'income' as const : 'expense' as const,
      amount: index % 5 === 0 ? 1000 : 20,
      description: 'ROW',
      date: dateKey(new Date(2026, 0, 1 + index * 3)),
      transfer_peer_id: null,
    }))
    const quality = calculateDataQuality(baseInput({
      transactions,
      recurringItems: [{ id: 'r1', account_id: 'acc-1', category_id: 'cat-food', type: 'expense', amount: 20, description: 'ABBONAMENTO', frequency: 'monthly', start_date: '2026-01-01', end_date: null, next_due_date: '2026-07-20', is_active: true, auto_create: true }],
      period: { ...period, isCurrentPeriod: false },
    }))
    expect(quality.level).toBe('EXCELLENT')
    expect(quality.confidencePercentage).toBeGreaterThanOrEqual(95)
  })

  it('scores savings edge cases for zero income, negative margin and strong margin', () => {
    expect(calculateSavingsScore({ currentSavingsRate: null, trailing3MonthSavingsRate: null, positiveCashFlowMonths: 0, totalObservedMonths: 0, weight: 20 }).score).toBe(50)
    expect(calculateSavingsScore({ currentSavingsRate: -10, trailing3MonthSavingsRate: null, positiveCashFlowMonths: 0, totalObservedMonths: 3, weight: 20 }).score).toBeLessThan(30)
    expect(calculateSavingsScore({ currentSavingsRate: 25, trailing3MonthSavingsRate: 30, positiveCashFlowMonths: 3, totalObservedMonths: 3, weight: 20 }).score).toBe(100)
  })

  it('scores cash-flow stability for insufficient, volatile and stable months', () => {
    expect(calculateCashFlowStability([]).stabilityScore).toBe(50)
    expect(calculateCashFlowStability([
      { key: '2026-01', income: 1000, expenses: 500, netCashFlow: 500, savingsRate: 50, transactionCount: 2, daysObserved: 1 },
      { key: '2026-02', income: 1000, expenses: 1800, netCashFlow: -800, savingsRate: -80, transactionCount: 2, daysObserved: 1 },
      { key: '2026-03', income: 1000, expenses: 200, netCashFlow: 800, savingsRate: 80, transactionCount: 2, daysObserved: 1 },
    ]).negativeMonths).toBe(1)
  })

  it('summarizes future and overdue deadlines without penalizing future count alone', () => {
    const summary = summarizeDeadlines({
      today: '2026-07-15',
      recurringItems: [
        { id: 'r1', account_id: 'acc-1', category_id: null, type: 'expense', amount: 50, description: 'A', frequency: 'monthly', start_date: '2026-01-01', end_date: null, next_due_date: '2026-07-16', is_active: true, auto_create: true },
        { id: 'r2', account_id: 'acc-1', category_id: null, type: 'income', amount: 50, description: 'B', frequency: 'monthly', start_date: '2026-01-01', end_date: null, next_due_date: '2026-08-01', is_active: true, auto_create: true },
      ],
      loans: [{ id: 'l1', counterpart: 'Mario', type: 'received', amount: 100, remaining: 80, due_date: '2026-07-10', is_settled: false }],
    })
    expect(summary.upcoming7d).toBe(1)
    expect(summary.overdueCount).toBe(1)
    expect(calculateDeadlineScore({ ...summary, overdueCount: 0, totalTrackedDeadlines: 5 }, 10).score).toBeGreaterThan(80)
  })

  it('treats no tracked deadlines as a positive available component', () => {
    const component = calculateDeadlineScore({
      upcoming7d: 0,
      upcoming30d: 0,
      upcomingAmount30d: 0,
      overdueCount: 0,
      overdueAmount: 0,
      totalTrackedDeadlines: 0,
    }, 10)
    expect(component.score).toBe(100)
    expect(component.availability).toBe('AVAILABLE')
  })

  it('scores debt ratio thresholds and no-income cases', () => {
    const noIncome = summarizeDebt({
      today: '2026-07-15',
      monthlyIncome: 0,
      loans: [{ id: 'l1', counterpart: 'Mario', type: 'received', amount: 1000, remaining: 1000, due_date: '2026-12-31', is_settled: false }],
      loanPayments: [{ id: 'p1', loan_id: 'l1', amount: 300, paid_at: '2026-07-10T00:00:00.000Z' }],
    })
    expect(noIncome.paymentToIncomeRatio).toBeNull()
    expect(calculateDebtScore({ ...noIncome, paymentToIncomeRatio: 45 }, 15).score).toBeLessThan(60)
    expect(calculateDebtScore({ ...noIncome, paymentToIncomeRatio: 20, overdueInstallments: 0 }, 15).score).toBeGreaterThan(70)
  })

  it('scores budget regular and warning states distinctly', () => {
    const regular = calculateBudgetScore({
      activeBudgets: 1,
      warningBudgets: 0,
      exceededBudgets: 0,
      totalLimit: 100,
      totalSpent: 40,
      aggregateUsagePercentage: 40,
      totalOverspend: 0,
      atRiskCategories: [],
    }, 15)
    const warning = calculateBudgetScore({
      activeBudgets: 1,
      warningBudgets: 1,
      exceededBudgets: 0,
      totalLimit: 100,
      totalSpent: 85,
      aggregateUsagePercentage: 85,
      totalOverspend: 0,
      atRiskCategories: [],
    }, 15)
    expect(regular.factors[0].id).toBe('budgets-ok')
    expect(warning.score).toBeLessThan(regular.score!)
  })

  it('rolls up subcategory spending into a parent budget', () => {
    const summary = summarizeBudgets({
      year: 2026,
      month: 7,
      budgets: [{ id: 'b-parent', category_id: 'cat-home', amount: 100, month: 7, year: 2026 }],
      categories: [
        { id: 'cat-home', name: 'Casa', type: 'expense', parent_id: null },
        { id: 'cat-rent', name: 'Affitto', type: 'expense', parent_id: 'cat-home' },
      ],
      transactions: [
        { id: 'tx-rent', account_id: 'acc-1', category_id: 'cat-rent', type: 'expense', amount: 80, description: 'AFFITTO', date: '2026-07-05', transfer_peer_id: null },
      ],
    })
    expect(summary.totalSpent).toBe(80)
    expect(summary.warningBudgets).toBe(1)
  })

  it('maps score levels and unavailable score to neutral summaries', () => {
    expect(scoreLevel(null).level).toBe('UNAVAILABLE')
    expect(scoreLevel(35).label).toBe('Critica')
    expect(scoreLevel(55).label).toBe('Da migliorare')
    expect(scoreLevel(70).label).toBe('Discreta')
    expect(scoreLevel(80).label).toBe('Buona')
    expect(scoreLevel(95).label).toBe('Ottima')
  })
})
