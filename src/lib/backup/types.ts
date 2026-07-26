import type {
  AccountType,
  CategoryType,
  LoanType,
  RecurringFrequency,
  TransactionType,
} from '@/types/database'
import type { AutomationAction, AutomationCondition } from '@/lib/automation/types'

import type { BACKUP_COLLECTION_KEYS } from './constants'

export type BackupIssueSeverity = 'error' | 'warning' | 'info'
export type BackupValidationPath = Array<string | number>

export type BackupValidationIssue = {
  code: string
  severity: BackupIssueSeverity
  path: BackupValidationPath
  message: string
  details?: Record<string, string | number | boolean | null>
}

export type AuroraBackupRecordCounts = Record<(typeof BACKUP_COLLECTION_KEYS)[number], number>

export type AuroraBackupMetadataV1 = {
  source: string
  locale: string
  timezone: string
  notes?: string | null
}

export type AuroraBackupExportedByV1 = {
  userId?: string | null
  displayName?: string | null
  emailHash?: string | null
}

export type AuroraBackupIntegrityV1 = {
  recordCounts: Partial<AuroraBackupRecordCounts>
  tableChecksums?: Partial<Record<keyof AuroraBackupRecordCounts, string>>
  checksum?: string | null
}

export type AuroraBackupProfileV1 = {
  id?: string
  user_id?: string
  display_name?: string | null
  avatar_url?: string | null
  currency: string
  locale: string
  timezone: string
  onboarding_done: boolean
  created_at?: string
  updated_at?: string
}

export type AuroraBackupAccountV1 = {
  id: string
  user_id?: string
  name: string
  type: AccountType
  color?: string | null
  icon?: string | null
  balance: number
  currency: string
  is_active: boolean
  is_hidden: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type AuroraBackupCategoryV1 = {
  id: string
  user_id?: string
  name: string
  type: CategoryType
  color?: string | null
  icon?: string | null
  parent_id: string | null
  is_default: boolean
  sort_order: number
  created_at?: string
}

export type AuroraBackupTransactionV1 = {
  id: string
  user_id?: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  description?: string | null
  notes?: string | null
  date: string
  transfer_peer_id: string | null
  recurring_id?: string | null
  receipt_url?: string | null
  receipt_data?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export type AuroraBackupBudgetV1 = {
  id: string
  user_id?: string
  category_id: string
  amount: number
  month: number
  year: number
  created_at?: string
  updated_at?: string
}

export type AuroraBackupRecurringRuleV1 = {
  id: string
  user_id?: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  description: string
  frequency: RecurringFrequency
  start_date: string
  end_date: string | null
  next_due_date: string
  last_run_date: string | null
  is_active: boolean
  auto_create: boolean
  created_at?: string
  updated_at?: string
}

export type AuroraBackupLoanV1 = {
  id: string
  user_id?: string
  counterpart: string
  type: LoanType
  amount: number
  remaining: number
  description?: string | null
  due_date?: string | null
  is_settled: boolean
  settled_at?: string | null
  created_at?: string
  updated_at?: string
}

export type AuroraBackupLoanPaymentV1 = {
  id: string
  loan_id: string
  user_id?: string
  amount: number
  paid_at: string
  notes?: string | null
  created_at?: string
}

export type AuroraBackupBirthdayV1 = {
  id: string
  user_id?: string
  name: string
  birth_date: string
  reminder_days: number[]
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type AuroraBackupBirthdayReminderLogV1 = {
  id: string
  birthday_id: string
  user_id?: string
  days_before: number
  year: number
  sent_at?: string
}

export type AuroraBackupAuditLogV1 = {
  id: string
  user_id?: string | null
  action: string
  table_name: string
  record_id?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  ip_address?: string | null
  created_at?: string
}

export type AuroraBackupAutomationRuleV1 = {
  id: string
  user_id?: string
  name: string
  description?: string | null
  is_active: boolean
  priority: number
  match_mode: 'ALL' | 'ANY'
  stop_processing: boolean
  apply_to_new_transactions: boolean
  archived: boolean
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  created_at?: string
  updated_at?: string
}

export type AuroraBackupAutomationApplicationBatchV1 = {
  id: string
  user_id?: string
  rule_id: string | null
  mode: 'BULK'
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'REVERTED' | 'REVERT_CONFLICT'
  transaction_count: number
  applied_count: number
  skipped_count: number
  conflict_count: number
  failed_count: number
  created_at?: string
  reverted_at?: string | null
}

export type AuroraBackupAutomationRuleApplicationV1 = {
  id: string
  user_id?: string
  rule_id: string | null
  transaction_id: string | null
  application_batch_id: string | null
  application_mode: 'SUGGESTED' | 'MANUAL' | 'AUTOMATIC' | 'BULK'
  previous_values: Record<string, unknown>
  applied_values: Record<string, unknown>
  result: 'APPLIED' | 'SKIPPED' | 'CONFLICT' | 'FAILED' | 'REVERTED'
  error_code?: string | null
  applied_at?: string
  reverted_at?: string | null
}

export type AuroraBackupDataV1 = {
  profile: AuroraBackupProfileV1
  accounts: AuroraBackupAccountV1[]
  categories: AuroraBackupCategoryV1[]
  transactions: AuroraBackupTransactionV1[]
  budgets: AuroraBackupBudgetV1[]
  recurringRules: AuroraBackupRecurringRuleV1[]
  loans: AuroraBackupLoanV1[]
  loanPayments: AuroraBackupLoanPaymentV1[]
  birthdays: AuroraBackupBirthdayV1[]
  birthdayReminderLog: AuroraBackupBirthdayReminderLogV1[]
  auditLogs: AuroraBackupAuditLogV1[]
  automationRules: AuroraBackupAutomationRuleV1[]
  automationApplicationBatches: AuroraBackupAutomationApplicationBatchV1[]
  automationRuleApplications: AuroraBackupAutomationRuleApplicationV1[]
}

export type AuroraBackupV1 = {
  format: 'aurora-backup'
  schemaVersion: 1
  appVersion: string
  createdAt: string
  exportedBy?: AuroraBackupExportedByV1
  defaultCurrency: string
  metadata: AuroraBackupMetadataV1
  data: AuroraBackupDataV1
  integrity: AuroraBackupIntegrityV1
}

export type BackupInspectionSummary = {
  schemaVersion: number | null
  recordCounts: Partial<AuroraBackupRecordCounts>
  errorCount: number
  warningCount: number
  infoCount: number
}

export type BackupInspectionResult = {
  valid: boolean
  backup: AuroraBackupV1 | null
  normalizedBackup: AuroraBackupV1 | null
  issues: BackupValidationIssue[]
  recordCounts: Partial<AuroraBackupRecordCounts>
  checksum: string | null
  summary: BackupInspectionSummary
}
