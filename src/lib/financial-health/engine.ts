import { adaptTransactionRows } from '@/domain/accounting/transaction-adapter'
import { calculateExpenseTotal, calculateIncomeTotal, calculateNetWorth, filterTransactionsByDateRange } from '@/domain/accounting/aggregations'
import { SCORE_WEIGHTS } from './constants'
import { calculateAlertsScore, summarizeAlerts } from './alerts'
import { calculateBudgetScore, summarizeBudgets } from './budgets'
import { calculateDataQuality } from './data-quality'
import { calculateDeadlineScore, summarizeDeadlines } from './deadlines'
import { calculateDebtScore, summarizeDebt } from './debt'
import { summarizeGoals, calculateGoalsScore } from './goals'
import { calculateLiquidAssets, calculateLiquidityScore } from './liquidity'
import { buildRecommendations } from './recommendations'
import { calculateWeightedHealthScore, contributions, scoreLevel } from './score'
import { calculateCashFlowStability, calculateSavingsRate, calculateSavingsScore } from './savings'
import { buildTrends } from './trends'
import { average, roundMoney } from './helpers'
import type { Account, Transaction } from '@/types/database'
import type { ComponentScore, FinancialHealthInput, FinancialHealthMetrics, HealthComponentKey, HealthFactor } from './types'
import { FINANCIAL_HEALTH_CALCULATION_VERSION } from './constants'

function activeAccounts(input: FinancialHealthInput) {
  return input.accounts.filter((account) => account.is_active && !account.is_hidden)
}

function adaptedTransactions(input: FinancialHealthInput) {
  const transactions = input.transactions.map((transaction) => ({
    ...transaction,
    user_id: 'health-user',
    notes: null,
    recurring_id: transaction.recurring_id ?? null,
    receipt_url: null,
    receipt_data: null,
    created_at: '',
    updated_at: '',
  })) as Transaction[]

  return adaptTransactionRows(transactions, {
    accounts: input.accounts.map((account) => ({
      ...account,
      user_id: 'health-user',
      color: null,
      icon: null,
      is_hidden: Boolean(account.is_hidden),
      sort_order: 0,
      created_at: '',
      updated_at: '',
    })) as Account[],
    peerTransactions: transactions,
  })
}

function monthMetric(input: FinancialHealthInput, from: string, to: string) {
  const txs = filterTransactionsByDateRange(adaptedTransactions(input), from, to)
  const income = calculateIncomeTotal(txs)
  const expenses = calculateExpenseTotal(txs)
  return { income, expenses, margin: roundMoney(income - expenses), savingsRate: calculateSavingsRate(income, expenses) }
}

function trailingSavingsRate(months: Array<{ income: number; expenses: number }>): number | null {
  const income = roundMoney(months.reduce((sum, month) => sum + month.income, 0))
  const expenses = roundMoney(months.reduce((sum, month) => sum + month.expenses, 0))
  return calculateSavingsRate(income, expenses)
}

function expenseCoverageMonths(liquidAssets: number, monthlyMetrics: FinancialHealthInput['historicalMonthlyMetrics']): number | null {
  const expenses = monthlyMetrics.filter((month) => month.expenses > 0).slice(-6).map((month) => month.expenses)
  if (expenses.length === 0) return null
  return roundMoney(liquidAssets / Math.max(average(expenses), 1))
}

function previousMetrics(input: FinancialHealthInput): Partial<Record<keyof FinancialHealthMetrics, number | null>> {
  const prev = monthMetric(input, input.previousPeriod.from, input.previousPeriod.to)
  return {
    monthlyIncome: prev.income,
    monthlyExpenses: prev.expenses,
    monthlyMargin: prev.margin,
    savingsRate: prev.savingsRate,
    currentFinancialPosition: null,
    currentLiquidity: null,
  }
}

export function calculateFinancialHealth(input: FinancialHealthInput) {
  const dataQuality = calculateDataQuality(input)
  const liquidAssets = calculateLiquidAssets(input)
  const current = monthMetric(input, input.period.from, input.period.to)
  const observedMonths = input.historicalMonthlyMetrics.filter((month) => month.transactionCount > 0)
  const trailing3MonthSavingsRate = trailingSavingsRate(observedMonths.slice(-3))
  const trailing6MonthSavingsRate = trailingSavingsRate(observedMonths.slice(-6))
  const stability = calculateCashFlowStability(observedMonths.slice(-6))
  const coverageMonths = expenseCoverageMonths(liquidAssets, observedMonths)
  const today = input.now.slice(0, 10)
  const budgetSummary = summarizeBudgets({
    budgets: input.budgets,
    categories: input.categories,
    transactions: input.transactions,
    year: Number(input.period.key.slice(0, 4)),
    month: Number(input.period.key.slice(5, 7)),
  })
  const debtSummary = summarizeDebt({ loans: input.loans, loanPayments: input.loanPayments, monthlyIncome: current.income, today })
  const deadlineSummary = summarizeDeadlines({ recurringItems: input.recurringItems, loans: input.loans, today })
  const goalSummary = summarizeGoals(input.goals, today)
  const alertSummary = summarizeAlerts(input.notifications)
  const currentFinancialPosition = roundMoney(calculateNetWorth(activeAccounts(input) as any) - debtSummary.debtOutstanding)

  const metrics: FinancialHealthMetrics = {
    currentFinancialPosition,
    currentLiquidity: liquidAssets,
    projectedLiquidity7d: input.projectedLiquidity.minProjectedBalance7d,
    projectedLiquidity30d: input.projectedLiquidity.minProjectedBalance30d,
    projectedLiquidity90d: input.projectedLiquidity.minProjectedBalance90d,
    monthlyIncome: current.income,
    monthlyExpenses: current.expenses,
    monthlyMargin: current.margin,
    savingsRate: current.savingsRate,
    trailing3MonthSavingsRate,
    trailing6MonthSavingsRate,
    cashFlowStabilityScore: stability.stabilityScore,
    expenseCoverageMonths: coverageMonths,
    activeBudgets: budgetSummary.activeBudgets,
    exceededBudgets: budgetSummary.exceededBudgets,
    warningBudgets: budgetSummary.warningBudgets,
    totalBudgetLimit: budgetSummary.totalLimit,
    totalBudgetSpent: budgetSummary.totalSpent,
    totalBudgetOverspend: budgetSummary.totalOverspend,
    debtOutstanding: debtSummary.debtOutstanding,
    monthlyDebtPayments: debtSummary.monthlyDebtPayments,
    paymentToIncomeRatio: debtSummary.paymentToIncomeRatio,
    overduePayments: debtSummary.overdueInstallments,
    upcomingDeadlines7d: deadlineSummary.upcoming7d,
    upcomingDeadlines30d: deadlineSummary.upcoming30d,
    overdueDeadlines: deadlineSummary.overdueCount,
    activeGoals: goalSummary.activeGoals,
    completedGoals: goalSummary.completedGoals,
    behindGoals: goalSummary.behindGoals,
    aggregateGoalProgress: goalSummary.aggregateProgress,
    activeCriticalAlerts: alertSummary.activeCriticalAlerts,
    activeWarningAlerts: alertSummary.activeWarningAlerts,
  }

  const components: Record<HealthComponentKey, ComponentScore> = {
    liquidity: calculateLiquidityScore({
      currentBalance: liquidAssets,
      minProjectedBalance7d: input.projectedLiquidity.minProjectedBalance7d,
      minProjectedBalance30d: input.projectedLiquidity.minProjectedBalance30d,
      minProjectedBalance90d: input.projectedLiquidity.minProjectedBalance90d,
      negativeDays: input.projectedLiquidity.negativeDays90d,
      expenseCoverageMonths: coverageMonths,
      weight: SCORE_WEIGHTS.liquidity,
    }),
    savings: calculateSavingsScore({
      currentSavingsRate: current.savingsRate,
      trailing3MonthSavingsRate,
      positiveCashFlowMonths: stability.positiveMonths,
      totalObservedMonths: observedMonths.length,
      weight: SCORE_WEIGHTS.savings,
    }),
    budgets: calculateBudgetScore(budgetSummary, SCORE_WEIGHTS.budgets),
    debt: calculateDebtScore(debtSummary, SCORE_WEIGHTS.debt),
    deadlines: calculateDeadlineScore(deadlineSummary, SCORE_WEIGHTS.deadlines),
    goals: calculateGoalsScore(goalSummary, SCORE_WEIGHTS.goals),
    alerts: calculateAlertsScore(alertSummary, SCORE_WEIGHTS.alerts),
  }

  const weighted = calculateWeightedHealthScore(components)
  const level = scoreLevel(weighted.totalScore)
  const allFactors = [...dataQuality.factors, ...Object.values(components).flatMap((component) => component.factors)]
  const recommendations = buildRecommendations({
    metrics,
    factors: allFactors,
    dataIsInsufficient: dataQuality.level === 'INSUFFICIENT',
  })
  const trends = buildTrends({ metrics, previousMetrics: previousMetrics(input), totalScore: weighted.totalScore })

  return {
    calculationVersion: FINANCIAL_HEALTH_CALCULATION_VERSION,
    calculatedAt: input.now,
    period: input.period,
    previousPeriod: input.previousPeriod,
    isProvisional: dataQuality.isProvisional,
    dataQuality,
    confidencePercentage: dataQuality.confidencePercentage,
    totalScore: weighted.totalScore,
    level: level.level,
    levelLabel: level.label,
    summary: dataQuality.isProvisional ? `${level.summary} Il risultato è provvisorio perché i dati sono limitati o il periodo è ancora aperto.` : level.summary,
    observedWeight: weighted.observedWeight,
    missingWeight: weighted.missingWeight,
    completenessPercentage: weighted.completenessPercentage,
    metrics,
    componentScores: weighted.componentScores,
    componentWeights: SCORE_WEIGHTS,
    contributions: contributions(weighted.componentScores),
    positiveFactors: allFactors.filter((factor) => factor.impact === 'POSITIVE'),
    negativeFactors: allFactors.filter((factor) => factor.impact === 'NEGATIVE'),
    neutralFactors: allFactors.filter((factor) => factor.impact === 'NEUTRAL'),
    recommendations,
    trends,
    warnings: dataQuality.reasons,
  }
}
