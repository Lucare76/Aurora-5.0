import type { AccountType, RecurringFrequency, TransactionType } from '@/types/database'

export type CalendarView = 'month' | 'agenda'
export type CalendarSourceType = 'RECURRING' | 'LOAN' | 'BUDGET' | 'SAVINGS_GOAL' | 'EXISTING_TRANSACTION'
export type CalendarEventType =
  | 'EXPECTED_INCOME'
  | 'EXPECTED_EXPENSE'
  | 'LOAN_INSTALLMENT'
  | 'BUDGET_DEADLINE'
  | 'GOAL_DEADLINE'
  | 'RECURRING_TRANSACTION'
  | 'ACTUAL_TRANSACTION'
export type CalendarDirection = 'INCOME' | 'EXPENSE' | 'NEUTRAL'
export type CalendarEventStatus = 'EXPECTED' | 'COMPLETED' | 'OVERDUE' | 'INFORMATIONAL'
export type CalendarConfidence = 'CONFIRMED' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_APPLICABLE'
export type CriticalDayType =
  | 'NEGATIVE_BALANCE'
  | 'BELOW_THRESHOLD'
  | 'LARGE_EXPENSE'
  | 'MULTIPLE_EXPENSES'
  | 'OVERDUE_INSTALLMENT'
  | 'GOAL_AT_RISK'
  | 'UNASSIGNED_ACCOUNT'
export type CriticalSeverity = 'INFO' | 'WARNING' | 'DANGER'
export type ForecastConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type CalendarInsightType =
  | 'BALANCE_STAYS_POSITIVE'
  | 'NEGATIVE_BALANCE_EXPECTED'
  | 'BELOW_THRESHOLD_EXPECTED'
  | 'LOWEST_BALANCE_DATE'
  | 'HIGH_EXPENSE_DAY'
  | 'MULTIPLE_DUE_ITEMS'
  | 'INCOME_COVERS_EXPENSES'
  | 'EXPENSES_EXCEED_INCOME'
  | 'LOAN_INSTALLMENT_DUE'
  | 'GOAL_DEADLINE_AT_RISK'
  | 'FORECAST_LOW_CONFIDENCE'
  | 'UNASSIGNED_EVENTS'
  | 'NO_UPCOMING_EVENTS'

export type FinancialCalendarFilters = {
  view: CalendarView
  month: string
  from: string
  to: string
  range: number
  account: string | null
  category: string | null
  sourceType: CalendarSourceType | 'ALL'
  direction: CalendarDirection | 'ALL'
  status: CalendarEventStatus | 'ALL'
  includeActual: boolean
  includeExpected: boolean
  includeInformational: boolean
  threshold: number
}

export type FinancialCalendarPeriod = {
  from: string
  to: string
  label: string
  days: number
}

export type FinancialCalendarEvent = {
  id: string
  sourceId: string
  sourceType: CalendarSourceType
  eventType: CalendarEventType
  title: string
  description: string | null
  date: string
  amount: number | null
  direction: CalendarDirection
  accountId: string | null
  accountName: string | null
  categoryId: string | null
  categoryName: string | null
  status: CalendarEventStatus
  confidence: CalendarConfidence
  href: string
  metadata: Record<string, string | number | boolean | null>
}

export type CalendarAccountBalance = {
  accountId: string
  accountName: string
  type: AccountType
  currentBalance: number
  projectedClosingBalance: number
  minimumProjectedBalance: number
}

export type CalendarDay = {
  date: string
  day: number
  inCurrentMonth: boolean
  isToday: boolean
  openingBalance: number
  income: number
  expenses: number
  closingBalance: number
  eventCount: number
  events: FinancialCalendarEvent[]
  warnings: CriticalDay[]
}

export type DailyForecastPoint = {
  date: string
  label: string
  totalProjectedBalance: number
  projectedIncome: number
  projectedExpenses: number
  threshold: number
  accountBalances: Record<string, number>
}

export type ForecastSummary = {
  openingBalance: number
  projectedClosingBalance: number
  projectedIncome: number
  projectedExpenses: number
  projectedNetCashFlow: number
  minimumProjectedBalance: number
  minimumProjectedBalanceDate: string | null
  maximumProjectedBalance: number
  maximumProjectedBalanceDate: string | null
  daysBelowZero: number
  daysBelowThreshold: number
  firstCriticalDate: string | null
  missingToStayAboveThreshold: number
}

export type CalendarSummary = ForecastSummary & {
  eventCount: number
  expectedEventCount: number
  actualEventCount: number
  loanDueCount: number
  goalDueCount: number
  budgetDueCount: number
  activeAccountsCount: number
}

export type CriticalDay = {
  date: string
  type: CriticalDayType
  severity: CriticalSeverity
  message: string
  amount: number | null
}

export type AgendaGroup = {
  key: 'today' | 'tomorrow' | 'this-week' | 'next-week' | 'later'
  label: string
  days: CalendarDay[]
}

export type ForecastConfidence = {
  forecastConfidence: ForecastConfidenceLevel
  confidenceReasons: string[]
  completenessPercentage: number
  unassignedEventsCount: number
  missingAmountEventsCount: number
  missingAccountEventsCount: number
}

export type CalendarInsight = {
  type: CalendarInsightType
  severity: CriticalSeverity
  title: string
  message: string
  metadata?: Record<string, string | number | null>
}

export type FinancialCalendarPayload = {
  filters: FinancialCalendarFilters
  period: FinancialCalendarPeriod
  currentBalances: CalendarAccountBalance[]
  summary: CalendarSummary
  forecast: ForecastSummary
  dailySeries: DailyForecastPoint[]
  calendarDays: CalendarDay[]
  agendaGroups: AgendaGroup[]
  criticalDays: CriticalDay[]
  events: FinancialCalendarEvent[]
  insights: CalendarInsight[]
  confidence: ForecastConfidence
  metadata: {
    generatedAt: string
    timezone: string
    queryCount: number
    eventCount: number
    forecastHorizonDays: number
    completeness: number
    warnings: string[]
    truncated: boolean
  }
}

export type CalendarAccountInput = {
  id: string
  name: string
  type: AccountType
  balance: number | string
  currency: string
  is_active: boolean
  is_hidden: boolean
}

export type CalendarCategoryInput = {
  id: string
  name: string
  type: string
  icon: string | null
  parent_id: string | null
}

export type CalendarRecurringInput = {
  id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number | string
  description: string
  frequency: RecurringFrequency
  start_date: string
  end_date: string | null
  next_due_date: string
  last_run_date: string | null
  is_active: boolean
  auto_create: boolean
}

export type CalendarLoanInput = {
  id: string
  counterpart: string
  type: 'given' | 'received'
  amount: number | string
  remaining: number | string
  description: string | null
  due_date: string | null
  is_settled: boolean
}

export type CalendarGoalInput = {
  id: string
  name: string
  target_amount: number | string
  current_amount: number | string
  target_date: string | null
  status: string
  archived: boolean
}

export type CalendarBudgetInput = {
  id: string
  category_id: string
  amount: number | string
  month: number
  year: number
}

export type CalendarTransactionInput = {
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

export class FinancialCalendarInputError extends Error {
  constructor(
    public code:
      | 'INVALID_MONTH'
      | 'INVALID_DATE'
      | 'INVALID_RANGE'
      | 'RANGE_TOO_LARGE'
      | 'INVALID_ACCOUNT'
      | 'INVALID_CATEGORY'
      | 'INVALID_THRESHOLD'
      | 'CALENDAR_FAILED',
    message: string,
  ) {
    super(message)
  }
}
