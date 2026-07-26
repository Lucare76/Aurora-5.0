import type { Account, Category, Transaction, TransactionType } from '@/types/database'

export type AutomationMatchMode = 'ALL' | 'ANY'
export type AutomationDescriptionOperator = 'CONTAINS' | 'EQUALS' | 'STARTS_WITH' | 'ENDS_WITH' | 'NOT_CONTAINS'
export type AutomationAmountOperator = 'EQUALS' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'BETWEEN'
export type AutomationConditionType = 'description' | 'amount' | 'transaction_type' | 'account' | 'category' | 'date'
export type AutomationActionType = 'set_category' | 'set_account' | 'set_transaction_type' | 'normalize_description' | 'append_note'
export type AutomationApplicationMode = 'SUGGESTED' | 'MANUAL' | 'AUTOMATIC' | 'BULK'
export type AutomationApplicationResult = 'APPLIED' | 'SKIPPED' | 'CONFLICT' | 'FAILED' | 'REVERTED'

export type AutomationCondition =
  | { type: 'description'; operator: AutomationDescriptionOperator; value: string }
  | { type: 'amount'; operator: AutomationAmountOperator; value?: number; min?: number; max?: number }
  | { type: 'transaction_type'; value: TransactionType }
  | { type: 'account'; account_id: string | null; mode?: 'ANY' | 'NONE' | 'SELECTED' }
  | { type: 'category'; category_id: string | null; mode?: 'ANY' | 'NONE' | 'SELECTED' }
  | { type: 'date'; date_from?: string | null; date_to?: string | null; day_of_month?: number | null; day_of_week?: number | null }

export type AutomationAction =
  | { type: 'set_category'; category_id: string | null }
  | { type: 'set_account'; account_id: string }
  | { type: 'set_transaction_type'; transaction_type: Exclude<TransactionType, 'transfer'> }
  | { type: 'normalize_description'; description: string }
  | { type: 'append_note'; note: string }

export type AutomationRule = {
  id: string
  user_id: string
  name: string
  description: string | null
  is_active: boolean
  priority: number
  match_mode: AutomationMatchMode
  stop_processing: boolean
  apply_to_new_transactions: boolean
  archived: boolean
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  created_at: string
  updated_at: string
}

export type AutomationRuleInput = Omit<AutomationRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export type AutomationApplication = {
  id: string
  user_id: string
  rule_id: string | null
  transaction_id: string | null
  application_batch_id: string | null
  application_mode: AutomationApplicationMode
  previous_values: Partial<AutomationTransactionPatch>
  applied_values: Partial<AutomationTransactionPatch>
  result: AutomationApplicationResult
  error_code: string | null
  applied_at: string
  reverted_at: string | null
}

export type AutomationBatch = {
  id: string
  user_id: string
  rule_id: string | null
  mode: 'BULK'
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'REVERTED' | 'REVERT_CONFLICT'
  transaction_count: number
  applied_count: number
  skipped_count: number
  conflict_count: number
  failed_count: number
  created_at: string
  reverted_at: string | null
}

export type AutomationTransaction = Pick<
  Transaction,
  'id' | 'user_id' | 'account_id' | 'category_id' | 'type' | 'amount' | 'description' | 'notes' | 'date' | 'transfer_peer_id' | 'created_at' | 'updated_at'
>

export type AutomationTransactionDraft = Omit<AutomationTransaction, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  id?: string
  user_id?: string
}

export type AutomationTransactionPatch = {
  account_id: string
  category_id: string | null
  type: TransactionType
  description: string | null
  notes: string | null
}

export type AutomationReferences = {
  accounts: Pick<Account, 'id' | 'name' | 'is_active' | 'is_hidden' | 'user_id'>[]
  categories: Pick<Category, 'id' | 'name' | 'type' | 'user_id' | 'parent_id'>[]
}

export type ConditionEvaluation = {
  condition: AutomationCondition
  matched: boolean
  reason: string
}

export type RuleEvaluation = {
  rule: AutomationRule
  matched: boolean
  conditions: ConditionEvaluation[]
  changes: Partial<AutomationTransactionPatch>
  conflicts: string[]
  skippedReason: string | null
}

export type AutomationEvaluationResult = {
  evaluations: RuleEvaluation[]
  suggestedChanges: Partial<AutomationTransactionPatch>
  appliedRules: AutomationRule[]
  conflicts: string[]
}

export type AutomationPreviewRow = {
  transaction: AutomationTransaction
  evaluation: RuleEvaluation
  previousValues: Partial<AutomationTransactionPatch>
  appliedValues: Partial<AutomationTransactionPatch>
}
