import { z } from 'zod'

import {
  AURORA_BACKUP_FORMAT,
  AURORA_BACKUP_SCHEMA_VERSION,
  BACKUP_LIMITS,
} from './constants'

const uuid = z.string().uuid()
const isoTimestamp = z.string().datetime({ offset: true })
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Invalid date')
const money = z.number().finite()
const shortString = z.string().max(BACKUP_LIMITS.maxStringLength)
const descriptionString = z.string().max(BACKUP_LIMITS.maxDescriptionLength)
const notesString = z.string().max(BACKUP_LIMITS.maxNotesLength)
const nullableString = shortString.nullable().optional()
const maybeTimestamp = isoTimestamp.optional()

const accountType = z.enum(['checking', 'savings', 'cash', 'credit', 'investment', 'other'])
const transactionType = z.enum(['income', 'expense', 'transfer'])
const categoryType = z.enum(['income', 'expense', 'both'])
const recurringFrequency = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])
const loanType = z.enum(['given', 'received'])
const automationMatchMode = z.enum(['ALL', 'ANY'])
const automationApplicationMode = z.enum(['SUGGESTED', 'MANUAL', 'AUTOMATIC', 'BULK'])
const automationApplicationResult = z.enum(['APPLIED', 'SKIPPED', 'CONFLICT', 'FAILED', 'REVERTED'])
const assetPurpose = z.enum(['PERSONAL', 'DEPENDENT_AURORA', 'ADI', 'DEPENDENT'])
const financeScope = z.enum(['PERSONAL', 'DEPENDENT_AURORA', 'ADI'])
const adiEntryType = z.enum(['credit', 'debit'])
const adiCategory = z.enum(['SUPERMERCATO', 'BENZINA', 'ABBIGLIAMENTO_AURORA'])
const leaveEntryType = z.enum(['VACATION', 'PERMIT_104'])
const deadlineCategory = z.enum(['VEHICLE', 'DOCUMENT', 'HEALTH', 'FAMILY', 'SCHOOL', 'SUBSCRIPTION', 'ADMINISTRATIVE', 'OTHER'])
const deadlineStatus = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED'])
const deadlinePriority = z.enum(['LOW', 'NORMAL', 'HIGH'])
const deadlineRecurrence = z.enum(['NONE', 'MONTHLY', 'YEARLY'])

export const profileSchema = z.object({
  id: uuid.optional(),
  user_id: uuid.optional(),
  display_name: nullableString,
  avatar_url: nullableString,
  currency: z.string().length(3),
  locale: shortString,
  timezone: shortString,
  onboarding_done: z.boolean(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const accountSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  name: shortString.min(1),
  type: accountType,
  color: nullableString,
  icon: nullableString,
  balance: money,
  currency: z.string().length(3),
  is_active: z.boolean(),
  is_hidden: z.boolean(),
  sort_order: z.number().int(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const categorySchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  name: shortString.min(1),
  type: categoryType,
  color: nullableString,
  icon: nullableString,
  parent_id: uuid.nullable(),
  is_default: z.boolean(),
  sort_order: z.number().int(),
  created_at: maybeTimestamp,
}).passthrough()

export const transactionSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  account_id: uuid,
  category_id: uuid.nullable(),
  type: transactionType,
  amount: money.positive(),
  description: descriptionString.nullable().optional(),
  notes: notesString.nullable().optional(),
  date: dateOnly,
  transfer_peer_id: uuid.nullable(),
  recurring_id: uuid.nullable().optional(),
  receipt_url: nullableString,
  receipt_data: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const budgetSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  category_id: uuid,
  amount: money.positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900).max(3000),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const recurringRuleSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  account_id: uuid,
  category_id: uuid.nullable(),
  type: transactionType,
  amount: money.positive(),
  description: descriptionString.min(1),
  frequency: recurringFrequency,
  start_date: dateOnly,
  end_date: dateOnly.nullable(),
  next_due_date: dateOnly,
  last_run_date: dateOnly.nullable(),
  is_active: z.boolean(),
  auto_create: z.boolean(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const loanSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  counterpart: shortString.min(1),
  type: loanType,
  amount: money.positive(),
  remaining: money.min(0),
  description: descriptionString.nullable().optional(),
  due_date: dateOnly.nullable().optional(),
  is_settled: z.boolean(),
  settled_at: isoTimestamp.nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const loanPaymentSchema = z.object({
  id: uuid,
  loan_id: uuid,
  user_id: uuid.optional(),
  amount: money.positive(),
  paid_at: isoTimestamp,
  notes: notesString.nullable().optional(),
  created_at: maybeTimestamp,
}).passthrough()

export const birthdaySchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  name: shortString.min(1),
  birth_date: dateOnly,
  reminder_days: z.array(z.number().int().min(0).max(365)),
  notes: notesString.nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const birthdayReminderLogSchema = z.object({
  id: uuid,
  birthday_id: uuid,
  user_id: uuid.optional(),
  days_before: z.number().int().min(0).max(365),
  year: z.number().int().min(1900).max(3000),
  sent_at: isoTimestamp.optional(),
}).passthrough()

export const auditLogSchema = z.object({
  id: uuid,
  user_id: uuid.nullable().optional(),
  action: shortString.min(1),
  table_name: shortString.min(1),
  record_id: uuid.nullable().optional(),
  old_data: z.record(z.string(), z.unknown()).nullable().optional(),
  new_data: z.record(z.string(), z.unknown()).nullable().optional(),
  ip_address: nullableString,
  created_at: maybeTimestamp,
}).passthrough()

export const automationRuleSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  name: shortString.min(1).max(120),
  description: descriptionString.nullable().optional(),
  is_active: z.boolean(),
  priority: z.number().int().min(1).max(10000),
  match_mode: automationMatchMode,
  stop_processing: z.boolean(),
  apply_to_new_transactions: z.boolean(),
  archived: z.boolean(),
  conditions: z.array(z.record(z.string(), z.unknown())).max(10),
  actions: z.array(z.record(z.string(), z.unknown())).max(10),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const automationApplicationBatchSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  rule_id: uuid.nullable(),
  mode: z.literal('BULK'),
  status: z.enum(['COMPLETED', 'PARTIAL', 'FAILED', 'REVERTED', 'REVERT_CONFLICT']),
  transaction_count: z.number().int().min(0),
  applied_count: z.number().int().min(0),
  skipped_count: z.number().int().min(0),
  conflict_count: z.number().int().min(0),
  failed_count: z.number().int().min(0),
  created_at: maybeTimestamp,
  reverted_at: isoTimestamp.nullable().optional(),
}).passthrough()

export const automationRuleApplicationSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  rule_id: uuid.nullable(),
  transaction_id: uuid.nullable(),
  application_batch_id: uuid.nullable(),
  application_mode: automationApplicationMode,
  previous_values: z.record(z.string(), z.unknown()),
  applied_values: z.record(z.string(), z.unknown()),
  result: automationApplicationResult,
  error_code: shortString.nullable().optional(),
  applied_at: maybeTimestamp,
  reverted_at: isoTimestamp.nullable().optional(),
}).passthrough()

// Notification preferences schemas — export only, restore deferred. Not in BACKUP_COLLECTION_KEYS.

export const notificationUserSettingsSchema = z.object({
  notifications_enabled: z.boolean().optional(),
  show_info: z.boolean().optional(),
  show_warning: z.boolean().optional(),
  show_critical: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: shortString.nullable().optional(),
  quiet_hours_end: shortString.nullable().optional(),
  timezone: shortString.nullable().optional(),
  digest_enabled: z.boolean().optional(),
  digest_frequency: z.enum(['DAILY', 'WEEKLY']).nullable().optional(),
  digest_time: shortString.nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const notificationPreferenceSchema = z.object({
  id: uuid.optional(),
  notification_type: shortString.min(1),
  is_enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const notificationSourceMuteSchema = z.object({
  id: uuid.optional(),
  source_type: shortString.min(1),
  source_id: shortString.min(1),
  notification_type: shortString.nullable().optional(),
  muted_until: isoTimestamp.nullable().optional(),
  reason: shortString.nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

// Notification schema — export only, restore deferred. Not in BACKUP_COLLECTION_KEYS.
const notificationSeverity = z.enum(['INFO', 'WARNING', 'CRITICAL'])

export const notificationSchema = z.object({
  id: uuid,
  type: shortString.min(1),
  severity: notificationSeverity,
  title: shortString.min(1),
  message: notesString,
  dedupe_key: shortString.min(1),
  source_type: shortString.nullable().optional(),
  source_id: uuid.nullable().optional(),
  source_url: shortString.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  is_read: z.boolean().optional(),
  archived_at: isoTimestamp.nullable().optional(),
  resolved_at: isoTimestamp.nullable().optional(),
  first_detected_at: maybeTimestamp,
  created_at: maybeTimestamp,
}).passthrough()

// Financial health snapshots — export only, restore deferred. Not in BACKUP_COLLECTION_KEYS.
export const financialHealthSnapshotSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  period_key: z.string().regex(/^\d{4}-\d{2}$/),
  period_start: dateOnly,
  period_end: dateOnly,
  total_score: money.min(0).max(100).nullable().optional(),
  level: shortString.nullable().optional(),
  is_provisional: z.boolean(),
  data_quality: z.enum(['INSUFFICIENT', 'LIMITED', 'GOOD', 'EXCELLENT']),
  observed_weight: money.min(0),
  metrics: z.record(z.string(), z.unknown()),
  component_scores: z.record(z.string(), z.unknown()),
  factors: z.array(z.record(z.string(), z.unknown())),
  recommendations: z.array(z.record(z.string(), z.unknown())),
  calculation_version: shortString.min(1),
  calculated_at: isoTimestamp,
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const dashboardPreferencesSchema = z.object({
  visible_widgets: z.array(shortString),
  widget_order: z.array(shortString),
  compact_mode: z.boolean(),
  default_period: z.enum(['current_month', 'previous_month']),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const dataIntegrityIssueSchema = z.object({
  fingerprint: shortString.min(1),
  rule_code: shortString.min(1),
  status: z.enum(['open', 'acknowledged', 'ignored', 'resolved', 'stale']),
  ignored_reason: notesString.nullable().optional(),
  acknowledged_at: isoTimestamp.nullable().optional(),
  ignored_at: isoTimestamp.nullable().optional(),
  resolved_at: isoTimestamp.nullable().optional(),
  ruleset_version: shortString.optional(),
  updated_at: maybeTimestamp,
}).passthrough()

export const dependentBeneficiarySchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  name: shortString.min(1),
  relationship: shortString.min(1),
  notes: notesString.nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const accountPurposeLinkSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  account_id: uuid,
  beneficiary_id: uuid.nullable().optional(),
  purpose: assetPurpose,
  label: shortString.nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const adiEntrySchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  transaction_id: uuid.nullable().optional(),
  entry_type: adiEntryType,
  adi_category: adiCategory.nullable().optional(),
  amount: money.positive(),
  date: dateOnly,
  reference_period: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  description: descriptionString.min(1),
  note: notesString.nullable().optional(),
  funding_source: z.literal('ADI'),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const financeTransferMetadataSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  source_transaction_id: uuid,
  destination_transaction_id: uuid,
  source_scope: financeScope,
  destination_scope: financeScope,
  reason: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  idempotency_key: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough()

export const leaveSettingsBackupSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  vacation_days_per_year: money.min(0).max(365),
  permit_104_hours_per_month: money.min(0).max(744),
  timezone: shortString.min(1),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

export const leaveEntryBackupSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  type: leaveEntryType,
  start_date: dateOnly,
  end_date: dateOnly,
  days: money.min(0).max(366).nullable().optional(),
  hours: money.min(0).max(24).nullable().optional(),
  start_time: shortString.nullable().optional(),
  end_time: shortString.nullable().optional(),
  note: notesString.nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough().superRefine((value, ctx) => {
  if (value.end_date < value.start_date) {
    ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'Invalid leave date range' })
  }
  if (value.type === 'VACATION' && value.days == null) {
    ctx.addIssue({ code: 'custom', path: ['days'], message: 'Vacation entries require days' })
  }
  if (value.type === 'PERMIT_104' && value.hours == null) {
    ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Permit entries require hours' })
  }
})

export const personalDeadlineBackupSchema = z.object({
  id: uuid,
  user_id: uuid.optional(),
  title: shortString.min(1).max(160),
  description: notesString.nullable().optional(),
  category: deadlineCategory,
  due_date: dateOnly,
  status: deadlineStatus,
  priority: deadlinePriority,
  recurrence: deadlineRecurrence,
  reminder_days_before: z.number().int().min(0).max(365),
  completed_at: isoTimestamp.nullable().optional(),
  created_at: maybeTimestamp,
  updated_at: maybeTimestamp,
}).passthrough()

const collection = <T extends z.ZodType>(schema: T) =>
  z.array(schema).max(BACKUP_LIMITS.maxRecordsPerCollection)

export const auroraBackupV1Schema = z.object({
  format: z.literal(AURORA_BACKUP_FORMAT),
  schemaVersion: z.literal(AURORA_BACKUP_SCHEMA_VERSION),
  appVersion: shortString.min(1),
  createdAt: isoTimestamp,
  exportedBy: z.object({
    userId: uuid.nullable().optional(),
    displayName: nullableString,
    emailHash: nullableString,
  }).passthrough().optional(),
  defaultCurrency: z.string().length(3),
  metadata: z.object({
    source: shortString.min(1),
    locale: shortString.min(1),
    timezone: shortString.min(1),
    notes: notesString.nullable().optional(),
  }).passthrough(),
  data: z.object({
    profile: profileSchema,
    accounts: collection(accountSchema),
    categories: collection(categorySchema),
    transactions: collection(transactionSchema),
    budgets: collection(budgetSchema),
    recurringRules: collection(recurringRuleSchema),
    loans: collection(loanSchema),
    loanPayments: collection(loanPaymentSchema),
    birthdays: collection(birthdaySchema),
    birthdayReminderLog: collection(birthdayReminderLogSchema),
    auditLogs: collection(auditLogSchema),
    automationRules: collection(automationRuleSchema).default([]),
    automationApplicationBatches: collection(automationApplicationBatchSchema).default([]),
    automationRuleApplications: collection(automationRuleApplicationSchema).default([]),
    notifications: collection(notificationSchema).optional(),
    notificationUserSettings: notificationUserSettingsSchema.optional(),
    notificationPreferences: collection(notificationPreferenceSchema).optional(),
    notificationSourceMutes: collection(notificationSourceMuteSchema).optional(),
    financialHealthSnapshots: collection(financialHealthSnapshotSchema).optional(),
    dashboardPreferences: dashboardPreferencesSchema.optional(),
    dataIntegrityIssues: collection(dataIntegrityIssueSchema).optional(),
    dependentBeneficiaries: collection(dependentBeneficiarySchema).optional(),
    accountPurposeLinks: collection(accountPurposeLinkSchema).optional(),
    financeTransferMetadata: collection(financeTransferMetadataSchema).optional(),
    adiEntries: collection(adiEntrySchema).optional(),
    leaveSettings: collection(leaveSettingsBackupSchema).optional(),
    leaveEntries: collection(leaveEntryBackupSchema).optional(),
    personalDeadlines: collection(personalDeadlineBackupSchema).optional(),
  }).passthrough(),
  integrity: z.object({
    recordCounts: z.record(z.string(), z.number().int().min(0)),
    tableChecksums: z.record(z.string(), z.string()).optional(),
    checksum: z.string().nullable().optional(),
  }).passthrough(),
}).passthrough()
