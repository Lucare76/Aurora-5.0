import type {
  AccountType,
  CategoryType,
  LoanType,
  RecurringFrequency,
  SavingsGoalStatus,
  TransactionType,
} from '@/types/database'

export type HealthComponentKey = 'liquidity' | 'savings' | 'budgets' | 'debt' | 'deadlines' | 'goals' | 'alerts'
export type ComponentAvailability = 'AVAILABLE' | 'NO_DATA' | 'NOT_APPLICABLE'
export type HealthFactorImpact = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
export type HealthFactorSeverity = 'INFO' | 'WARNING' | 'CRITICAL'
export type DataQualityLevel = 'INSUFFICIENT' | 'LIMITED' | 'GOOD' | 'EXCELLENT'
export type ScoreLevel = 'CRITICAL' | 'NEEDS_ATTENTION' | 'FAIR' | 'GOOD' | 'EXCELLENT'
export type TrendDirection = 'UP' | 'DOWN' | 'STABLE' | 'UNAVAILABLE'
export type TrendInterpretation = 'positive' | 'negative' | 'neutral' | 'unavailable'

export type HealthPeriod = {
  from: string
  to: string
  key: string
  label: string
  days: number
  isCurrentPeriod: boolean
}

export type HealthAccount = {
  id: string
  name: string
  type: AccountType | string
  balance: number
  currency: string
  is_active: boolean
  is_hidden?: boolean
}

export type HealthCategory = {
  id: string
  name: string
  type: CategoryType | string
  parent_id: string | null
}

export type HealthTransaction = {
  id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  description: string | null
  date: string
  transfer_peer_id: string | null
  recurring_id?: string | null
}

export type HealthRecurringItem = {
  id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  description: string
  frequency: RecurringFrequency
  start_date: string
  end_date: string | null
  next_due_date: string
  is_active: boolean
  auto_create: boolean
}

export type HealthBudget = {
  id: string
  category_id: string
  amount: number
  month: number
  year: number
}

export type HealthGoal = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: SavingsGoalStatus
  archived: boolean
  created_at: string
}

export type HealthGoalContribution = {
  id: string
  goal_id: string
  amount: number
  date: string
  created_at: string
}

export type HealthLoan = {
  id: string
  counterpart: string
  type: LoanType
  amount: number
  remaining: number
  due_date: string | null
  is_settled: boolean
}

export type HealthLoanPayment = {
  id: string
  loan_id: string
  amount: number
  paid_at: string
}

export type HealthNotification = {
  id: string
  type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  source_type: string | null
  source_id: string | null
  source_url: string | null
  is_read: boolean
  archived_at: string | null
  resolved_at: string | null
  snoozed_until?: string | null
  created_at: string
}

export type ProjectedLiquidityInput = {
  currentBalance: number
  minProjectedBalance7d: number
  minProjectedBalance30d: number
  minProjectedBalance90d: number
  minProjectedBalanceDate: string | null
  negativeDays7d: number
  negativeDays30d: number
  negativeDays90d: number
  negativeAccounts30d: number
  maxOverdraft: number
  projectedIncome30d: number
  projectedExpenses30d: number
}

export type MonthlyCashFlowMetric = {
  key: string
  income: number
  expenses: number
  netCashFlow: number
  savingsRate: number | null
  transactionCount: number
  daysObserved: number
}

export type FinancialHealthInput = {
  now: string
  timezone: string
  accounts: HealthAccount[]
  categories: HealthCategory[]
  transactions: HealthTransaction[]
  projectedLiquidity: ProjectedLiquidityInput
  recurringItems: HealthRecurringItem[]
  budgets: HealthBudget[]
  goals: HealthGoal[]
  goalContributions: HealthGoalContribution[]
  loans: HealthLoan[]
  loanPayments: HealthLoanPayment[]
  notifications: HealthNotification[]
  period: HealthPeriod
  previousPeriod: HealthPeriod
  historicalMonthlyMetrics: MonthlyCashFlowMetric[]
}

export type HealthFactor = {
  id: string
  component: HealthComponentKey | 'dataQuality' | 'trend'
  impact: HealthFactorImpact
  severity: HealthFactorSeverity
  title: string
  description: string
  metricValue?: number | string | null
  metricUnit?: string | null
  sourceType?: string | null
  sourceId?: string | null
  sourceUrl?: string | null
}

export type HealthRecommendation = {
  id: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  description: string
  actionUrl: string
  sourceType: string | null
  sourceId: string | null
  reasonCode: string
}

export type ComponentScore = {
  component: HealthComponentKey
  score: number | null
  weight: number
  contribution: number
  availability: ComponentAvailability
  status: 'good' | 'watch' | 'risk' | 'neutral'
  factors: HealthFactor[]
}

export type DataQualityResult = {
  level: DataQualityLevel
  isProvisional: boolean
  confidencePercentage: number
  daysCovered: number
  transactionCount: number
  categorizedTransactionPercentage: number
  reasons: string[]
  factors: HealthFactor[]
}

export type FinancialHealthMetrics = {
  currentFinancialPosition: number
  currentLiquidity: number
  projectedLiquidity7d: number
  projectedLiquidity30d: number
  projectedLiquidity90d: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyMargin: number
  savingsRate: number | null
  trailing3MonthSavingsRate: number | null
  trailing6MonthSavingsRate: number | null
  cashFlowStabilityScore: number
  expenseCoverageMonths: number | null
  activeBudgets: number
  exceededBudgets: number
  warningBudgets: number
  totalBudgetLimit: number
  totalBudgetSpent: number
  totalBudgetOverspend: number
  debtOutstanding: number
  monthlyDebtPayments: number
  paymentToIncomeRatio: number | null
  overduePayments: number
  upcomingDeadlines7d: number
  upcomingDeadlines30d: number
  overdueDeadlines: number
  activeGoals: number
  completedGoals: number
  behindGoals: number
  aggregateGoalProgress: number | null
  activeCriticalAlerts: number
  activeWarningAlerts: number
}

export type HealthTrend = {
  metric: keyof FinancialHealthMetrics | 'totalScore'
  direction: TrendDirection
  interpretation: TrendInterpretation
  currentValue: number | null
  previousValue: number | null
  absoluteChange: number | null
  percentageChange: number | null
}

export type WeightedScoreResult = {
  totalScore: number | null
  observedWeight: number
  missingWeight: number
  completenessPercentage: number
  componentScores: Record<HealthComponentKey, ComponentScore>
}

export type FinancialHealthResult = {
  calculationVersion: string
  calculatedAt: string
  period: HealthPeriod
  previousPeriod: HealthPeriod
  isProvisional: boolean
  dataQuality: DataQualityResult
  confidencePercentage: number
  totalScore: number | null
  level: ScoreLevel | 'UNAVAILABLE'
  levelLabel: string
  summary: string
  observedWeight: number
  missingWeight: number
  completenessPercentage: number
  metrics: FinancialHealthMetrics
  componentScores: Record<HealthComponentKey, ComponentScore>
  componentWeights: Record<HealthComponentKey, number>
  contributions: Record<HealthComponentKey, number>
  positiveFactors: HealthFactor[]
  negativeFactors: HealthFactor[]
  neutralFactors: HealthFactor[]
  recommendations: HealthRecommendation[]
  trends: HealthTrend[]
  warnings: string[]
}
