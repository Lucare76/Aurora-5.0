import type {
  Account,
  Budget,
  Category,
  FinancialHealthSnapshot,
  GoalContribution,
  Loan,
  LoanPayment,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from '@/types/database'
import type { Notification } from '@/lib/notifications/types'

export type DataIntegritySeverity = 'CRITICAL' | 'WARNING' | 'INFO'
export type DataIntegrityStatus = 'open' | 'acknowledged' | 'ignored' | 'resolved' | 'stale'
export type DataIntegrityCategory =
  | 'transactions'
  | 'transfers'
  | 'balances'
  | 'recurring'
  | 'loans'
  | 'budgets'
  | 'goals'
  | 'categories'
  | 'references'
  | 'financial_health'
  | 'notifications'
  | 'temporal'
  | 'backup'

export type DataIntegrityScanMode = 'quick' | 'full' | 'targeted'
export type DataIntegrityConfidence = 'high' | 'medium' | 'low'
export type DataIntegrityAction =
  | 'open_record'
  | 'acknowledge'
  | 'ignore'
  | 'reopen'
  | 'mark_resolved'
  | 'preview_fix'
  | 'delete_duplicate_via_existing_flow'
  | 'recategorize'
  | 'repair_transfer_with_preview'
  | 'refresh_snapshot'

export type DataIntegrityRuleCode =
  | 'TRANSACTION_EXACT_DUPLICATE'
  | 'TRANSACTION_POSSIBLE_DUPLICATE'
  | 'TRANSACTION_MISSING_CATEGORY'
  | 'TRANSACTION_INVALID_AMOUNT'
  | 'TRANSACTION_ORPHAN_ACCOUNT'
  | 'TRANSACTION_ORPHAN_CATEGORY'
  | 'TRANSACTION_ORPHAN_RECURRING'
  | 'TRANSACTION_FUTURE_ANOMALY'
  | 'TRANSFER_MISSING_COUNTERPART'
  | 'TRANSFER_SAME_ACCOUNT'
  | 'TRANSFER_LEGACY_PEER_ORPHAN'
  | 'TRANSFER_LEGACY_PEER_INCOHERENT'
  | 'TRANSFER_LEGACY_AMOUNT_MISMATCH'
  | 'ACCOUNT_BALANCE_NON_FINITE'
  | 'ACCOUNT_INACTIVE_WITH_FUTURE_TRANSACTIONS'
  | 'RECURRING_ORPHAN_ACCOUNT'
  | 'RECURRING_ORPHAN_CATEGORY'
  | 'RECURRING_INVALID_DATES'
  | 'RECURRING_ACTIVE_WITHOUT_NEXT_DATE'
  | 'RECURRING_DUPLICATE_INSTANCE'
  | 'LOAN_REMAINING_NEGATIVE'
  | 'LOAN_REMAINING_EXCEEDS_AMOUNT'
  | 'LOAN_SETTLED_WITH_REMAINING'
  | 'LOAN_DUPLICATE_PAYMENT'
  | 'BUDGET_ORPHAN_CATEGORY'
  | 'BUDGET_INVALID_AMOUNT'
  | 'BUDGET_INVALID_PERIOD'
  | 'BUDGET_DUPLICATE_SCOPE'
  | 'GOAL_INVALID_TARGET'
  | 'GOAL_CURRENT_NEGATIVE'
  | 'GOAL_COMPLETED_UNDER_TARGET'
  | 'GOAL_REACHED_NOT_COMPLETED'
  | 'GOAL_CONTRIBUTIONS_MISMATCH'
  | 'GOAL_DUPLICATE_CONTRIBUTION'
  | 'CATEGORY_DUPLICATE_NAME'
  | 'CATEGORY_PARENT_MISSING'
  | 'CATEGORY_PARENT_SELF'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'FINANCIAL_HEALTH_SNAPSHOT_DUPLICATE'
  | 'FINANCIAL_HEALTH_SNAPSHOT_SCORE_OUT_OF_RANGE'
  | 'FINANCIAL_HEALTH_SNAPSHOT_VERSION_MISSING'
  | 'FINANCIAL_HEALTH_SNAPSHOT_OUTDATED'
  | 'NOTIFICATION_DUPLICATE_ACTIVE'
  | 'NOTIFICATION_SOURCE_ORPHAN'
  | 'NOTIFICATION_RESOLVED_UNREAD'
  | 'TEMPORAL_CREATED_AFTER_UPDATED'

export type DataIntegrityRuleDefinition = {
  code: DataIntegrityRuleCode
  category: DataIntegrityCategory
  defaultSeverity: DataIntegritySeverity
  title: string
  description: string
  version: string
  allowedActions: DataIntegrityAction[]
}

export type DataIntegrityEvidence = {
  label: string
  value: string | number | boolean | null
  kind?: 'text' | 'money' | 'date' | 'entity' | 'count' | 'percent'
}

export type DataIntegrityIssueDraft = {
  ruleCode: DataIntegrityRuleCode
  severity?: DataIntegritySeverity
  status?: DataIntegrityStatus
  title?: string
  description?: string
  explanation: string
  impact: string
  recommendation: string
  confidence?: DataIntegrityConfidence
  entityType: string
  entityIds: string[]
  evidence: DataIntegrityEvidence[]
  sourcePath?: string
}

export type DataIntegrityIssue = {
  id?: string
  userId: string
  fingerprint: string
  rulesetVersion: string
  ruleCode: DataIntegrityRuleCode
  category: DataIntegrityCategory
  severity: DataIntegritySeverity
  status: DataIntegrityStatus
  title: string
  description: string
  explanation: string
  impact: string
  recommendation: string
  confidence: DataIntegrityConfidence
  entityType: string
  entityIds: string[]
  evidence: DataIntegrityEvidence[]
  allowedActions: DataIntegrityAction[]
  sourcePath?: string
  firstDetectedAt?: string
  lastDetectedAt?: string
}

export type DataIntegrityInput = {
  userId: string
  now: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurringRules: RecurringRule[]
  budgets: Budget[]
  goals: SavingsGoal[]
  goalContributions: GoalContribution[]
  loans: Loan[]
  loanPayments: LoanPayment[]
  notifications: Notification[]
  financialHealthSnapshots: FinancialHealthSnapshot[]
}

export type DataIntegritySummary = {
  total: number
  open: number
  acknowledged: number
  ignored: number
  resolved: number
  stale: number
  critical: number
  warning: number
  info: number
  statusLabel: 'Attenzione urgente' | 'Da controllare' | 'Buono' | 'Nessun dato'
}

export type DataIntegrityScanResult = {
  rulesetVersion: string
  scannedAt: string
  mode: DataIntegrityScanMode
  issues: DataIntegrityIssue[]
  summary: DataIntegritySummary
}

export type DataIntegrityIssueRow = {
  id: string
  user_id: string
  fingerprint: string
  ruleset_version: string
  rule_code: DataIntegrityRuleCode
  category: DataIntegrityCategory
  severity: DataIntegritySeverity
  status: DataIntegrityStatus
  title: string
  description: string
  explanation: string
  impact: string
  recommendation: string
  confidence: DataIntegrityConfidence
  entity_type: string
  entity_ids: string[]
  evidence: DataIntegrityEvidence[]
  allowed_actions: DataIntegrityAction[]
  source_path: string | null
  first_detected_at: string
  last_detected_at: string
  resolved_at: string | null
  ignored_at: string | null
  ignored_reason: string | null
  acknowledged_at: string | null
  last_scan_run_id: string | null
  created_at: string
  updated_at: string
}

export type DataIntegrityScanRunRow = {
  id: string
  user_id: string
  mode: DataIntegrityScanMode
  status: 'running' | 'completed' | 'failed'
  ruleset_version: string
  started_at: string
  completed_at: string | null
  detected_count: number
  critical_count: number
  warning_count: number
  info_count: number
  error_code: string | null
  metadata: Record<string, unknown>
}
