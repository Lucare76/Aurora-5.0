import type { User } from '@supabase/supabase-js'

export type FinancialAssistantScope = 'PERSONAL' | 'AURORA' | 'ADI'

export type FinancialAssistantIntent =
  | 'personal.financial_summary'
  | 'personal.income_expense_summary'
  | 'personal.spending_by_category'
  | 'personal.emergency_fund_status'
  | 'personal.financial_health_explanation'
  | 'personal.budget_summary'
  | 'personal.goal_summary'
  | 'affordability.generic'
  | 'affordability.car'
  | 'affordability.home'
  | 'affordability.travel'
  | 'decision.compare'
  | 'aurora.savings_summary'
  | 'adi.summary'

export type FinancialAssistantStatus =
  | 'OK'
  | 'NEEDS_INPUT'
  | 'FORBIDDEN'
  | 'DISABLED'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED'
  | 'ERROR'

export type FinancialAssistantPeriod =
  | 'CURRENT_MONTH'
  | 'PREVIOUS_MONTH'
  | 'LAST_3_MONTHS'
  | 'LAST_6_MONTHS'
  | 'LAST_12_MONTHS'
  | 'ALL_TIME'

export type AssistantCitation = {
  id: string
  label: string
  table: string
  fields: string[]
  rowCount: number
  filteredBy: string[]
}

export type AssistantEvidence = {
  metric: string
  value: number | string | boolean | null
  unit?: 'EUR' | 'COUNT' | 'PERCENT' | 'MONTHS' | 'TEXT'
  citationIds: string[]
}

export type AssistantInsight = {
  title: string
  detail: string
  severity: 'info' | 'success' | 'warning' | 'danger'
  evidenceIds: string[]
}

export type MissingInput = {
  field: string
  label: string
  reason: string
}

export type AssistantResult = {
  status: FinancialAssistantStatus
  readOnly: true
  intent: FinancialAssistantIntent | null
  scope: FinancialAssistantScope | null
  answer: string
  summary: string[]
  insights: AssistantInsight[]
  evidence: AssistantEvidence[]
  citations: AssistantCitation[]
  missingInputs: MissingInput[]
  navigation?: { label: string; href: string }
  warnings: string[]
  generatedAt: string
}

export type AssistantQuery = {
  intent: FinancialAssistantIntent
  scope?: FinancialAssistantScope
  message?: string
  period?: FinancialAssistantPeriod
  parameters?: Record<string, unknown>
}

export type AssistantRuntime = {
  user: User
  email: string | null
  now: Date
}

export type AssistantContext = {
  runtime: AssistantRuntime
  scope: FinancialAssistantScope
  period: ResolvedPeriod
  accounts: AssistantAccount[]
  transactions: AssistantTransaction[]
  categories: AssistantCategory[]
  budgets: AssistantBudget[]
  goals: AssistantGoal[]
  recurring: AssistantRecurring[]
  loans: AssistantLoan[]
  adiEntries: AssistantAdiEntry[]
  citations: AssistantCitation[]
}

export type ResolvedPeriod = {
  key: FinancialAssistantPeriod
  from: string | null
  to: string | null
  label: string
}

export type AssistantTool = {
  intent: FinancialAssistantIntent
  label: string
  description: string
  scope: FinancialAssistantScope
  readOnly: true
  execute: (params: {
    query: AssistantQuery
    context: AssistantContext
  }) => Promise<AssistantResult> | AssistantResult
}

export type AssistantAccount = {
  id: string
  name: string
  type?: string
  balance: number
  currency: string
  is_active: boolean
}

export type AssistantTransaction = {
  id: string
  account_id?: string
  destination_account_id?: string | null
  transfer_peer_id?: string | null
  category_id?: string | null
  amount: number
  type: 'income' | 'expense' | 'transfer'
  description: string | null
  date: string
}

export type AssistantCategory = {
  id: string
  name: string
  type: 'income' | 'expense'
  parent_id: string | null
  color: string | null
  icon: string | null
}

export type AssistantBudget = {
  id: string
  category_id: string
  amount: number
  month: number | null
  year: number | null
}

export type AssistantGoal = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  status: string | null
  target_date: string | null
}

export type AssistantRecurring = {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  frequency: string
  next_date: string | null
  is_active: boolean
}

export type AssistantLoan = {
  id: string
  person_name: string
  amount: number
  remaining: number
  type: string
  is_settled: boolean
}

export type AssistantAdiEntry = {
  id: string
  entry_type: 'credit' | 'debit'
  adi_category: 'SUPERMERCATO' | 'BENZINA' | 'ABBIGLIAMENTO_AURORA' | null
  amount: number
  date: string
  reference_period: string | null
}
