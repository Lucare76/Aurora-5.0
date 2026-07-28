import type { AccountType, CategoryType, TransactionType } from '@/types/database'
import type { ReportTypeCode } from './constants'

export type { ReportTypeCode }
export type ReportType = ReportTypeCode

export type ReportRange =
  | 'current-month'
  | 'previous-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'current-year'
  | 'previous-year'
  | 'last-12-months'
  | 'custom'

export type ReportTransactionTypeFilter = 'all' | 'income' | 'expense' | 'both'
export type ReportTrend = 'UP' | 'DOWN' | 'STABLE' | 'NOT_AVAILABLE'
export type ReportInsightSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER'
export type ReportInsightType =
  | 'INCOME_INCREASED'
  | 'INCOME_DECREASED'
  | 'EXPENSES_INCREASED'
  | 'EXPENSES_DECREASED'
  | 'CASH_FLOW_IMPROVED'
  | 'CASH_FLOW_WORSENED'
  | 'SAVINGS_RATE_IMPROVED'
  | 'SAVINGS_RATE_NEGATIVE'
  | 'CATEGORY_SPIKE'
  | 'CATEGORY_REDUCTION'
  | 'FIXED_COSTS_HIGH'
  | 'NET_WORTH_INCREASED'
  | 'NET_WORTH_DECREASED'
  | 'POSITIVE_STREAK'
  | 'NEGATIVE_STREAK'
  | 'INSUFFICIENT_DATA'

export type ReportFilters = {
  range: ReportRange
  from: string
  to: string
  account: string | null
  category: string | null
  type: ReportTransactionTypeFilter
  includeTransfers: boolean
  includeArchivedAccounts: boolean
}

export type ReportPeriod = {
  from: string
  to: string
  label: string
  days: number
}

export type ReportComparisonMetric = {
  currentValue: number | null
  previousValue: number | null
  absoluteChange: number | null
  percentageChange: number | null
  trend: ReportTrend
  interpretation: 'positive' | 'negative' | 'neutral' | 'unavailable'
}

export type ReportSummary = {
  totalIncome: number
  totalExpenses: number
  netCashFlow: number
  savingsRate: number | null
  averageMonthlyIncome: number
  averageMonthlyExpenses: number
  averageMonthlyCashFlow: number
  highestExpense: number
  highestIncome: number
  transactionCount: number
  activeAccountsCount: number
  netWorthStart: number
  netWorthEnd: number
  netWorthChange: number
  netWorthChangePercentage: number | null
  internalTransfersAmount: number
}

export type ReportComparison = {
  totalIncome: ReportComparisonMetric
  totalExpenses: ReportComparisonMetric
  netCashFlow: ReportComparisonMetric
  savingsRate: ReportComparisonMetric
  netWorthEnd: ReportComparisonMetric
}

export type ReportMonthlyPoint = {
  key: string
  month: string
  from: string
  to: string
  income: number
  expenses: number
  cashFlow: number
  savingsRate: number | null
  transactionCount: number
  cumulativeCashFlow: number
  netWorth: number | null
}

export type ReportCategoryRow = {
  categoryId: string
  categoryName: string
  parentCategory: string | null
  color: string | null
  icon: string | null
  amount: number
  percentage: number
  transactionCount: number
  averageTransaction: number
  previousAmount: number
  changeAmount: number
  changePercentage: number | null
  rank: number
  children: ReportCategoryRow[]
}

export type ReportAccountRow = {
  accountId: string
  accountName: string
  type: AccountType
  currency: string
  color: string | null
  isActive: boolean
  isHidden: boolean
  startingBalance: number
  income: number
  expenses: number
  transfers: number
  endingBalance: number
  change: number
  transactionCount: number
}

export type ReportFixedVariable = {
  fixedExpenses: number
  variableExpenses: number
  unclassifiedExpenses: number
  fixedExpensePercentage: number | null
  variableExpensePercentage: number | null
  recurringTransactionsCount: number
  activeRecurringRulesCount: number
  averageFixedMonthlyExpense: number
  classificationNote: string
}

export type ReportNetWorth = {
  start: number
  end: number
  change: number
  changePercentage: number | null
  highestNetWorth: number
  lowestNetWorth: number
  monthlySeries: Array<{ key: string; month: string; netWorth: number | null }>
}

export type ReportRecords = {
  bestIncomeMonth: ReportMonthlyPoint | null
  highestExpenseMonth: ReportMonthlyPoint | null
  bestCashFlowMonth: ReportMonthlyPoint | null
  worstCashFlowMonth: ReportMonthlyPoint | null
  topExpenseCategory: ReportCategoryRow | null
  biggestCategoryIncrease: ReportCategoryRow | null
  biggestCategoryReduction: ReportCategoryRow | null
  highestTransaction: {
    id: string
    date: string
    description: string | null
    amount: number
    type: TransactionType
  } | null
  highestExpenseDay: { date: string; amount: number } | null
  positiveCashFlowStreak: number
  negativeCashFlowStreak: number
}

export type ReportInsight = {
  type: ReportInsightType
  severity: ReportInsightSeverity
  title: string
  message: string
  metadata?: Record<string, number | string | null>
}

export type ReportDetailTableView = 'monthly' | 'categories' | 'accounts'

export type ReportMetadata = {
  generatedAt: string
  queryCount: number
  truncated: boolean
  dataCompleteness: 'complete' | 'partial'
  warnings: string[]
}

export type ReportPayload = {
  filters: ReportFilters
  period: ReportPeriod
  previousPeriod: ReportPeriod
  summary: ReportSummary
  comparison: ReportComparison
  monthlySeries: ReportMonthlyPoint[]
  expenseCategories: ReportCategoryRow[]
  incomeCategories: ReportCategoryRow[]
  fixedVariable: ReportFixedVariable
  netWorth: ReportNetWorth
  records: ReportRecords
  insights: ReportInsight[]
  accounts: ReportAccountRow[]
  metadata: ReportMetadata
}

export class ReportInputError extends Error {
  constructor(
    public code:
      | 'INVALID_RANGE'
      | 'INVALID_DATE'
      | 'RANGE_TOO_LARGE'
      | 'INVALID_ACCOUNT'
      | 'INVALID_CATEGORY'
      | 'REPORT_FAILED',
    message: string,
  ) {
    super(message)
  }
}

export type ReportAccountInput = {
  id: string
  name: string
  type: AccountType
  balance: number | string
  currency: string
  color: string | null
  is_active: boolean
  is_hidden: boolean
}

export type ReportCategoryInput = {
  id: string
  name: string
  type: CategoryType
  color: string | null
  icon: string | null
  parent_id: string | null
}

export type ReportTransactionInput = {
  id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number | string
  description: string | null
  date: string
  transfer_peer_id: string | null
  recurring_id: string | null
}
