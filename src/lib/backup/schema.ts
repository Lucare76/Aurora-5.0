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
  }).passthrough(),
  integrity: z.object({
    recordCounts: z.record(z.string(), z.number().int().min(0)),
    tableChecksums: z.record(z.string(), z.string()).optional(),
    checksum: z.string().nullable().optional(),
  }).passthrough(),
}).passthrough()
