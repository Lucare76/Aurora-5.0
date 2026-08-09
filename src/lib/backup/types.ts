import type {
  AccountType,
  CategoryType,
  LeaveEntryType,
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

// ── Notification preferences — export-only (restore deferred, same as notifications) ──

export type AuroraBackupNotificationUserSettingsV1 = {
  notifications_enabled?: boolean
  show_info?: boolean
  show_warning?: boolean
  show_critical?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
  timezone?: string | null
  digest_enabled?: boolean
  digest_frequency?: 'DAILY' | 'WEEKLY' | null
  digest_time?: string | null
  created_at?: string
  updated_at?: string
}

export type AuroraBackupNotificationPreferenceV1 = {
  id?: string
  notification_type: string
  is_enabled: boolean
  config?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export type AuroraBackupNotificationSourceMuteV1 = {
  id?: string
  source_type: string
  source_id: string
  notification_type?: string | null
  muted_until?: string | null
  reason?: string | null
  created_at?: string
  updated_at?: string
}

// Notifications: export-only (restore is deferred to a future sprint).
// Excluded from BACKUP_COLLECTION_KEYS to preserve backward compatibility with existing backups.
export type AuroraBackupNotificationV1 = {
  id: string
  type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  message: string
  dedupe_key: string
  source_type?: string | null
  source_id?: string | null
  source_url?: string | null
  metadata?: Record<string, unknown>
  is_read?: boolean
  archived_at?: string | null
  resolved_at?: string | null
  first_detected_at?: string
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

export type AuroraBackupFinancialHealthSnapshotV1 = {
  id: string
  user_id?: string
  period_key: string
  period_start: string
  period_end: string
  total_score?: number | null
  level?: string | null
  is_provisional: boolean
  data_quality: string
  observed_weight: number
  metrics: Record<string, unknown>
  component_scores: Record<string, unknown>
  factors: Record<string, unknown>[]
  recommendations: Record<string, unknown>[]
  calculation_version: string
  calculated_at: string
  created_at?: string
  updated_at?: string
}

export type AuroraBackupDashboardPreferencesV1 = {
  visible_widgets: string[]
  widget_order: string[]
  compact_mode: boolean
  default_period: 'current_month' | 'previous_month'
  created_at?: string
  updated_at?: string
}

export type AuroraBackupDataIntegrityIssueV1 = {
  fingerprint: string
  rule_code: string
  status: 'open' | 'acknowledged' | 'ignored' | 'resolved' | 'stale'
  ignored_reason?: string | null
  acknowledged_at?: string | null
  ignored_at?: string | null
  resolved_at?: string | null
  ruleset_version?: string
  updated_at?: string
}

// Financial scenarios: export-only (restore deferred; result_summary is derived)
export type AuroraBackupFinancialScenarioV1 = {
  id: string
  name: string
  description?: string | null
  status: string
  horizon_months: number
  start_date: string
  end_date: string
  currency?: string | null
  actions: Record<string, unknown>[]
  assumptions: Record<string, unknown>
  engine_version: string
  schema_version: number
  action_registry_version: string
  baseline_as_of?: string | null
  last_calculated_at?: string | null
  result_summary?: Record<string, unknown> | null
  is_favorite: boolean
  created_at?: string
  updated_at?: string
}

export type AuroraBackupDependentBeneficiaryV1 = {
  id: string
  user_id?: string
  name: string
  relationship: string
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type AuroraBackupAccountPurposeLinkV1 = {
  id: string
  user_id?: string
  account_id: string
  beneficiary_id?: string | null
  purpose: 'PERSONAL' | 'DEPENDENT_AURORA' | 'ADI' | 'DEPENDENT'
  label?: string | null
  created_at?: string
  updated_at?: string
}

export type AuroraBackupAdiEntryV1 = {
  id: string
  user_id?: string
  transaction_id?: string | null
  entry_type: 'credit' | 'debit'
  adi_category?: 'SUPERMERCATO' | 'BENZINA' | 'ABBIGLIAMENTO_AURORA' | null
  amount: number
  date: string
  reference_period?: string | null
  description: string
  note?: string | null
  funding_source: 'ADI'
  created_at?: string
  updated_at?: string
}

export type AuroraBackupFinanceTransferMetadataV1 = {
  id: string
  user_id?: string
  source_transaction_id: string
  destination_transaction_id: string
  source_scope: 'PERSONAL' | 'DEPENDENT_AURORA' | 'ADI'
  destination_scope: 'PERSONAL' | 'DEPENDENT_AURORA' | 'ADI'
  reason?: string | null
  note?: string | null
  idempotency_key?: string | null
  created_at?: string
  updated_at?: string
}

export type AuroraBackupLeaveSettingsV1 = {
  id: string
  user_id?: string
  vacation_days_per_year: number
  permit_104_hours_per_month: number
  timezone: string
  created_at?: string
  updated_at?: string
}

export type AuroraBackupLeaveEntryV1 = {
  id: string
  user_id?: string
  type: LeaveEntryType
  start_date: string
  end_date: string
  days?: number | null
  hours?: number | null
  start_time?: string | null
  end_time?: string | null
  note?: string | null
  created_at?: string
  updated_at?: string
}

export type AuroraBackupPersonalDeadlineV1 = {
  id: string
  user_id?: string
  title: string
  description?: string | null
  category: 'VEHICLE' | 'DOCUMENT' | 'HEALTH' | 'FAMILY' | 'SCHOOL' | 'SUBSCRIPTION' | 'ADMINISTRATIVE' | 'OTHER'
  due_date: string
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  recurrence: 'NONE' | 'MONTHLY' | 'YEARLY'
  reminder_days_before: number
  completed_at?: string | null
  created_at?: string
  updated_at?: string
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
  // Optional: included from Sprint 13A onwards; absent in earlier backups (restore deferred)
  notifications?: AuroraBackupNotificationV1[]
  // Optional: included from Sprint 13B onwards; absent in earlier backups (restore deferred)
  notificationUserSettings?: AuroraBackupNotificationUserSettingsV1
  notificationPreferences?: AuroraBackupNotificationPreferenceV1[]
  notificationSourceMutes?: AuroraBackupNotificationSourceMuteV1[]
  // Optional: included from Sprint 14A onwards; absent in earlier backups (restore deferred)
  financialHealthSnapshots?: AuroraBackupFinancialHealthSnapshotV1[]
  // Optional: included from Sprint 14B onwards; absent in earlier backups
  dashboardPreferences?: AuroraBackupDashboardPreferencesV1
  // Optional: included from Sprint 15 onwards; derived issue state, safe to regenerate
  dataIntegrityIssues?: AuroraBackupDataIntegrityIssueV1[]
  // Optional: included from Sprint 16 onwards; export-only (restore deferred)
  financialScenarios?: AuroraBackupFinancialScenarioV1[]
  // Optional: included from Sprint 25 onwards
  dependentBeneficiaries?: AuroraBackupDependentBeneficiaryV1[]
  accountPurposeLinks?: AuroraBackupAccountPurposeLinkV1[]
  financeTransferMetadata?: AuroraBackupFinanceTransferMetadataV1[]
  adiEntries?: AuroraBackupAdiEntryV1[]
  // Optional: included from Sprint 33 onwards; private HR module, separate from finance
  leaveSettings?: AuroraBackupLeaveSettingsV1[]
  leaveEntries?: AuroraBackupLeaveEntryV1[]
  // Optional: included from Sprint 34 onwards; private deadlines module, separate from finance
  personalDeadlines?: AuroraBackupPersonalDeadlineV1[]
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
