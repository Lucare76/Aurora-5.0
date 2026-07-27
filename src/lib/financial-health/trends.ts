import { SCORE_THRESHOLDS } from './constants'
import { roundMoney } from './helpers'
import type { FinancialHealthMetrics, HealthTrend, TrendInterpretation } from './types'

const POSITIVE_WHEN_UP = new Set<keyof FinancialHealthMetrics | 'totalScore'>([
  'currentFinancialPosition',
  'currentLiquidity',
  'projectedLiquidity7d',
  'projectedLiquidity30d',
  'projectedLiquidity90d',
  'monthlyIncome',
  'monthlyMargin',
  'savingsRate',
  'trailing3MonthSavingsRate',
  'trailing6MonthSavingsRate',
  'cashFlowStabilityScore',
  'expenseCoverageMonths',
  'aggregateGoalProgress',
  'totalScore',
])

const POSITIVE_WHEN_DOWN = new Set<keyof FinancialHealthMetrics>([
  'monthlyExpenses',
  'exceededBudgets',
  'warningBudgets',
  'totalBudgetOverspend',
  'debtOutstanding',
  'monthlyDebtPayments',
  'paymentToIncomeRatio',
  'overduePayments',
  'upcomingDeadlines7d',
  'overdueDeadlines',
  'behindGoals',
  'activeCriticalAlerts',
  'activeWarningAlerts',
])

function trendFor(currentValue: number | null, previousValue: number | null, positiveWhen: 'up' | 'down'): Pick<HealthTrend, 'direction' | 'interpretation' | 'absoluteChange' | 'percentageChange'> {
  if (currentValue == null || previousValue == null) {
    return { direction: 'UNAVAILABLE', interpretation: 'unavailable', absoluteChange: null, percentageChange: null }
  }
  const absoluteChange = roundMoney(currentValue - previousValue)
  const percentageChange = previousValue === 0 ? null : roundMoney((absoluteChange / Math.abs(previousValue)) * 100)
  const tolerance = SCORE_THRESHOLDS.stableTrendTolerancePct
  const direction = percentageChange == null
    ? absoluteChange === 0 ? 'STABLE' : 'UNAVAILABLE'
    : Math.abs(percentageChange) < tolerance ? 'STABLE' : absoluteChange > 0 ? 'UP' : 'DOWN'
  let interpretation: TrendInterpretation = 'neutral'
  if (direction === 'UNAVAILABLE') interpretation = 'unavailable'
  else if (direction === 'STABLE') interpretation = 'neutral'
  else interpretation = positiveWhen === 'up' ? (direction === 'UP' ? 'positive' : 'negative') : (direction === 'DOWN' ? 'positive' : 'negative')
  return { direction, interpretation, absoluteChange, percentageChange }
}

export function buildTrends(params: {
  metrics: FinancialHealthMetrics
  previousMetrics: Partial<Record<keyof FinancialHealthMetrics, number | null>>
  totalScore: number | null
  previousScore?: number | null
}): HealthTrend[] {
  const keys: Array<keyof FinancialHealthMetrics | 'totalScore'> = [
    'currentFinancialPosition',
    'currentLiquidity',
    'monthlyIncome',
    'monthlyExpenses',
    'monthlyMargin',
    'savingsRate',
    'totalBudgetOverspend',
    'debtOutstanding',
    'paymentToIncomeRatio',
    'totalScore',
  ]

  return keys.map((metric) => {
    const currentValue = metric === 'totalScore' ? params.totalScore : (params.metrics[metric] as number | null)
    const previousValue = metric === 'totalScore' ? (params.previousScore ?? null) : (params.previousMetrics[metric] ?? null)
    const positiveWhen = POSITIVE_WHEN_UP.has(metric) ? 'up' : POSITIVE_WHEN_DOWN.has(metric as keyof FinancialHealthMetrics) ? 'down' : 'up'
    return { metric, currentValue, previousValue, ...trendFor(currentValue, previousValue, positiveWhen) }
  })
}
