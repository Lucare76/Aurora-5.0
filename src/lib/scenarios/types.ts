import type { RecurringFrequency, Account, RecurringRule, SavingsGoal, GoalContribution, Loan, LoanPayment, Category, Transaction } from '@/types/database'

// ── Action codes ─────────────────────────────────────────────────────────────

export type ScenarioActionCode =
  | 'ONE_TIME_EXPENSE'
  | 'RECURRING_EXPENSE_ADD'
  | 'RECURRING_EXPENSE_UPDATE'
  | 'RECURRING_EXPENSE_REMOVE'
  | 'RECURRING_INCOME_ADD'
  | 'RECURRING_INCOME_REDUCE'
  | 'RECURRING_INCOME_PAUSE'
  | 'MONTHLY_SAVINGS_CHANGE'
  | 'CATEGORY_SPENDING_CHANGE'
  | 'BUDGET_LIMIT_CHANGE'
  | 'GOAL_CONTRIBUTION_CHANGE'
  | 'GOAL_DEADLINE_CHANGE'
  | 'GOAL_ONE_TIME_CONTRIBUTION'
  | 'LOAN_EARLY_PAYOFF'
  | 'NEW_LOAN'
  | 'ACCOUNT_BALANCE_ADJUSTMENT'

// ── Action param shapes ───────────────────────────────────────────────────────

export type OneTimeExpenseParams = {
  amount: number
  date: string          // YYYY-MM-DD
  description: string
  categoryId?: string | null
  linkedNewLoanActionId?: string | null  // links to a NEW_LOAN action
}

export type RecurringExpenseAddParams = {
  amount: number
  frequency: RecurringFrequency
  description: string
  startDate: string
  endDate?: string | null
  categoryId?: string | null
}

export type RecurringExpenseUpdateParams = {
  ruleId: string
  newAmount: number
  startDate: string
  endDate?: string | null   // null = rest of horizon
}

export type RecurringExpenseRemoveParams = {
  ruleId: string
  startDate: string
}

export type RecurringIncomeAddParams = {
  amount: number
  frequency: RecurringFrequency
  description: string
  startDate: string
  endDate?: string | null
}

export type RecurringIncomeReduceParams = {
  ruleId?: string | null   // null = generic reduction (not tied to a rule)
  reductionAmount: number  // monthly amount to reduce
  startDate: string
  endDate?: string | null
}

export type RecurringIncomePauseParams = {
  ruleId?: string | null   // null = pause all income
  startDate: string
  endDate: string          // required — pause is always temporary
}

export type MonthlySavingsChangeParams = {
  changeAmount: number     // positive = more savings/less spending, negative = less
  startDate: string
  endDate?: string | null
}

export type CategorySpendingChangeParams = {
  categoryId: string
  changeAmount: number     // negative = less spending, positive = more
  startDate: string
  endDate?: string | null
}

export type BudgetLimitChangeParams = {
  categoryId: string
  newLimit: number
  // Budget changes are informational only — they do NOT affect cash flow
}

export type GoalContributionChangeParams = {
  goalId: string
  newMonthlyAmount: number
  startDate: string
  endDate?: string | null
}

export type GoalDeadlineChangeParams = {
  goalId: string
  newDeadline: string   // YYYY-MM-DD
}

export type GoalOneTimeContributionParams = {
  goalId: string
  amount: number
  date: string          // YYYY-MM-DD
}

export type LoanEarlyPayoffParams = {
  loanId: string
  payoffDate: string    // YYYY-MM-DD
  penaltyAmount?: number | null
}

export type NewLoanParams = {
  description: string
  principalAmount: number
  downPayment?: number | null
  monthlyPayment: number
  numberOfPayments: number
  firstPaymentDate: string  // YYYY-MM-DD
}

export type AccountBalanceAdjustmentParams = {
  adjustmentAmount: number  // positive = add, negative = subtract
  // Applied to opening balance of scenario (not tied to a date within horizon)
}

// Discriminated union
export type ActionParamsByCode = {
  ONE_TIME_EXPENSE: OneTimeExpenseParams
  RECURRING_EXPENSE_ADD: RecurringExpenseAddParams
  RECURRING_EXPENSE_UPDATE: RecurringExpenseUpdateParams
  RECURRING_EXPENSE_REMOVE: RecurringExpenseRemoveParams
  RECURRING_INCOME_ADD: RecurringIncomeAddParams
  RECURRING_INCOME_REDUCE: RecurringIncomeReduceParams
  RECURRING_INCOME_PAUSE: RecurringIncomePauseParams
  MONTHLY_SAVINGS_CHANGE: MonthlySavingsChangeParams
  CATEGORY_SPENDING_CHANGE: CategorySpendingChangeParams
  BUDGET_LIMIT_CHANGE: BudgetLimitChangeParams
  GOAL_CONTRIBUTION_CHANGE: GoalContributionChangeParams
  GOAL_DEADLINE_CHANGE: GoalDeadlineChangeParams
  GOAL_ONE_TIME_CONTRIBUTION: GoalOneTimeContributionParams
  LOAN_EARLY_PAYOFF: LoanEarlyPayoffParams
  NEW_LOAN: NewLoanParams
  ACCOUNT_BALANCE_ADJUSTMENT: AccountBalanceAdjustmentParams
}

// ── Scenario action (stored in jsonb) ─────────────────────────────────────────

export type ScenarioAction = {
  id: string                   // client-generated UUID
  code: ScenarioActionCode
  enabled: boolean
  label?: string | null
  params: Record<string, unknown>
}

// ── Assumptions ───────────────────────────────────────────────────────────────

export type ScenarioAssumptions = {
  includeActiveRecurring: boolean
  includeGoalContributions: boolean
  goalContributionSource: 'recent_average' | 'none'
  loanPaymentSource: 'recent_average' | 'none'
  excludedAccountIds: string[]
}

// ── Status ─────────────────────────────────────────────────────────────────────

export type ScenarioStatus = 'draft' | 'ready' | 'outdated' | 'archived'

// ── DB entity ─────────────────────────────────────────────────────────────────

export type FinancialScenario = {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ScenarioStatus
  horizon_months: number
  start_date: string           // YYYY-MM-DD
  end_date: string             // YYYY-MM-DD
  currency: string | null
  actions: ScenarioAction[]
  assumptions: ScenarioAssumptions
  engine_version: string
  schema_version: number
  action_registry_version: string
  baseline_as_of: string | null
  last_calculated_at: string | null
  result_summary: ScenarioResultSummary | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

// ── Projection periods ────────────────────────────────────────────────────────

export type ProjectionPeriod = {
  year: number
  month: number                // 0-indexed (0 = January)
  key: string                  // "YYYY-MM"
  label: string                // "gen 2027"
  startDate: string            // YYYY-MM-DD
  endDate: string              // YYYY-MM-DD
}

// ── Cash-flow modification applied by an action ───────────────────────────────

export type CashFlowModification = {
  incomeAdjustment: number     // additional income (positive) or reduction (negative)
  expenseAdjustment: number    // additional expense (positive) or reduction (negative)
  loanAdjustment: number       // additional loan payment (positive)
  goalAdjustment: number       // additional goal contribution (positive) or reduction (negative)
  notes: string[]
}

// Action modifications by period key "YYYY-MM"
export type ActionModifications = Map<string, CashFlowModification>

// ── Monthly projection data ───────────────────────────────────────────────────

export type MonthlyProjectionPoint = {
  period: ProjectionPeriod
  // Baseline values
  baselineOpeningBalance: number
  baselineIncome: number
  baselineExpenses: number
  baselineLoanPayments: number
  baselineGoalContributions: number
  baselineClosingBalance: number
  // Scenario values
  scenarioOpeningBalance: number
  scenarioIncome: number
  scenarioExpenses: number
  scenarioLoanPayments: number
  scenarioGoalContributions: number
  scenarioClosingBalance: number
  // Delta this period
  delta: number
  appliedActionIds: string[]
}

// ── Projection result ─────────────────────────────────────────────────────────

export type ScenarioProjectionResult = {
  months: MonthlyProjectionPoint[]
  // Baseline aggregates
  baselineFinalBalance: number
  baselineMinBalance: number
  baselineTotalIncome: number
  baselineTotalExpenses: number
  baselineNegativeMonths: number
  baselineFirstNegativeMonth: string | null
  // Scenario aggregates
  scenarioFinalBalance: number
  scenarioMinBalance: number
  scenarioTotalIncome: number
  scenarioTotalExpenses: number
  scenarioNegativeMonths: number
  scenarioFirstNegativeMonth: string | null
  // Aggregated delta
  totalDelta: number
  initialBalanceAdjustment: number
}

// ── Comparison ────────────────────────────────────────────────────────────────

export type ComparisonDirection = 'positive' | 'negative' | 'neutral'

export type ComparisonMetric = {
  key: string
  label: string
  baseline: number
  scenario: number
  delta: number
  deltaPercent: number | null
  direction: ComparisonDirection
  unit: 'currency' | 'integer' | 'percent'
  explanation: string
}

export type ScenarioComparison = {
  metrics: ComparisonMetric[]
  finalBalance: ComparisonMetric
  minimumBalance: ComparisonMetric
  averageCashFlow: ComparisonMetric
  totalIncome: ComparisonMetric
  totalExpenses: ComparisonMetric
  negativeMonths: ComparisonMetric
  financialHealthScore: ComparisonMetric | null
  summary: string
}

// ── Financial health simulation ───────────────────────────────────────────────

export type SimulatedFinancialHealth = {
  baseline: number | null
  scenario: number | null
  delta: number | null
  baselineLevel: string | null
  scenarioLevel: string | null
  componentsImpacted: string[]
  note: string
  isSimulated: true
}

// ── Reliability ───────────────────────────────────────────────────────────────

export type ScenarioReliabilityLevel = 'high' | 'medium' | 'limited'

export type ScenarioReliability = {
  level: ScenarioReliabilityLevel
  reasons: string[]
  warnings: string[]
  dataCompleteness: number   // 0-100, informational
}

// ── Result summary (persisted in DB) ─────────────────────────────────────────

export type ScenarioResultSummary = {
  version: number
  finalBalance: { baseline: number; scenario: number; delta: number }
  minimumBalance: { baseline: number; scenario: number }
  negativeMonths: { baseline: number; scenario: number }
  cashFlowAvg: { baseline: number; scenario: number }
  financialHealth: SimulatedFinancialHealth | null
  reliability: ScenarioReliability
  summary: string
  horizon: { months: number; startDate: string; endDate: string }
  calculatedAt: string
}

// ── Engine I/O ────────────────────────────────────────────────────────────────

export type ScenarioEngineInput = {
  scenario: FinancialScenario
  accounts: Account[]
  recurringRules: RecurringRule[]
  goals: SavingsGoal[]
  goalContributions: GoalContribution[]
  loans: Loan[]
  loanPayments: LoanPayment[]
  categories: Category[]
  recentTransactions: Pick<Transaction, 'id' | 'account_id' | 'type' | 'amount' | 'description' | 'date' | 'transfer_peer_id' | 'category_id'>[]
  now: Date
  timezone: string
  userCurrency: string
  baselineFinancialHealthScore?: number | null   // from latest snapshot, optional
}

export type ScenarioEngineResult = {
  scenario: FinancialScenario
  projection: ScenarioProjectionResult
  comparison: ScenarioComparison
  financialHealth: SimulatedFinancialHealth | null
  reliability: ScenarioReliability
  resultSummary: ScenarioResultSummary
  calculatedAt: string
  engineVersion: string
  errors: string[]
  warnings: string[]
}

// ── Validation ────────────────────────────────────────────────────────────────

export type ScenarioValidationIssue = {
  code: string
  severity: 'error' | 'warning'
  actionId?: string
  field?: string
  message: string
}

export type ScenarioValidationResult = {
  valid: boolean
  issues: ScenarioValidationIssue[]
}

// ── Registry ──────────────────────────────────────────────────────────────────

export type ActionCategory = 'expense' | 'income' | 'savings' | 'budget' | 'goal' | 'loan' | 'account'

export type ActionRegistryEntry = {
  code: ScenarioActionCode
  version: string
  label: string
  description: string
  category: ActionCategory
  icon: string
  affectsCashFlow: boolean
  cashFlowSign: 'reduces' | 'increases' | 'both' | 'none'
}

// ── Templates ─────────────────────────────────────────────────────────────────

export type ScenarioTemplate = {
  id: string
  label: string
  description: string
  icon: string
  defaultHorizonMonths: number
  seedActions: Array<Omit<ScenarioAction, 'id'>>
  tags: string[]
}
