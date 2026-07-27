import { z } from 'zod'
import type { NotificationType } from './types'

// ── Per-type config schemas ───────────────────────────────────────────────────

export const balanceConfigSchema = z.object({
  lookaheadDays: z.number().int().min(1).max(365).default(30),
  criticalBelow: z.number().finite().default(-100),
  accountIds: z.array(z.string().uuid()).nullable().default(null),
})

export const budgetConfigSchema = z.object({
  warningPercentage: z.number().int().min(1).max(100).default(80),
  criticalPercentage: z.number().int().min(1).max(500).default(100),
}).refine(
  (d) => d.criticalPercentage >= d.warningPercentage,
  { message: 'criticalPercentage must be >= warningPercentage', path: ['criticalPercentage'] },
)

export const recurrenceConfigSchema = z.object({
  advanceDays: z.number().int().min(0).max(90).default(3),
  overdueEnabled: z.boolean().default(true),
  overdueCriticalAfterDays: z.number().int().min(0).max(90).default(7),
})

export const goalConfigSchema = z.object({
  tolerancePercentagePoints: z.number().int().min(0).max(50).default(10),
  criticalDaysRemaining: z.number().int().min(0).max(90).default(30),
  criticalGapPercentagePoints: z.number().int().min(0).max(100).default(30),
})

export const loanConfigSchema = z.object({
  advanceDays: z.number().int().min(0).max(90).default(7),
  overdueEnabled: z.boolean().default(true),
})

export const duplicateConfigSchema = z.object({
  dateToleranceDays: z.number().int().min(0).max(7).default(0),
  descriptionMatchRequired: z.boolean().default(false),
})

export const automationConfigSchema = z.object({
  includeConflicts: z.boolean().default(true),
})

// Map each type to its Zod schema
export const TYPE_CONFIG_SCHEMAS: Record<NotificationType, z.ZodTypeAny> = {
  negative_projected_balance: balanceConfigSchema,
  budget_threshold:           budgetConfigSchema,
  upcoming_recurrence:        recurrenceConfigSchema,
  overdue_recurrence:         recurrenceConfigSchema,
  upcoming_loan_payment:      loanConfigSchema,
  overdue_loan_payment:       loanConfigSchema,
  loan_due_soon:              loanConfigSchema,
  goal_behind_schedule:       goalConfigSchema,
  automation_failure:         automationConfigSchema,
  automation_conflict:        automationConfigSchema,
  possible_duplicate:         duplicateConfigSchema,
}

// ── Global settings schema ────────────────────────────────────────────────────

const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Format HH:MM required')
  .nullable()

const ianaTimezone = z.string().min(1).max(100).nullable()

export const userSettingsSchema = z.object({
  notifications_enabled: z.boolean().optional(),
  show_info:             z.boolean().optional(),
  show_warning:          z.boolean().optional(),
  show_critical:         z.boolean().optional(),
  quiet_hours_enabled:   z.boolean().optional(),
  quiet_hours_start:     timeString.optional(),
  quiet_hours_end:       timeString.optional(),
  digest_enabled:        z.boolean().optional(),
  digest_frequency:      z.enum(['DAILY', 'WEEKLY']).nullable().optional(),
  digest_time:           timeString.optional(),
  timezone:              ianaTimezone.optional(),
})

// ── Source mute schema ────────────────────────────────────────────────────────

const SOURCE_TYPES = [
  'account', 'budget', 'recurring_rule', 'savings_goal',
  'loan', 'automation', 'transaction',
] as const

const NOTIFICATION_TYPES = [
  'negative_projected_balance', 'budget_threshold',
  'overdue_recurrence', 'upcoming_recurrence',
  'upcoming_loan_payment', 'overdue_loan_payment', 'loan_due_soon',
  'goal_behind_schedule', 'automation_failure', 'automation_conflict',
  'possible_duplicate',
] as const

export const createMuteSchema = z.object({
  source_type:       z.enum(SOURCE_TYPES),
  source_id:         z.string().uuid(),
  notification_type: z.enum(NOTIFICATION_TYPES).nullable().optional(),
  muted_until:       z.string().datetime({ offset: true }).nullable().optional(),
  reason:            z.string().max(200).nullable().optional(),
})

// ── Snooze schema ─────────────────────────────────────────────────────────────

export const snoozeSchema = z.object({
  snoozed_until: z.string().datetime({ offset: true }),
})

// ── Config validator ──────────────────────────────────────────────────────────

/**
 * Validates and fills defaults for a per-type config.
 * Returns parsed config on success, default config on failure.
 */
export function parseTypeConfig(type: NotificationType, raw: unknown): Record<string, unknown> {
  const schema = TYPE_CONFIG_SCHEMAS[type]
  if (!schema) return {}
  const result = schema.safeParse(raw ?? {})
  if (result.success) return result.data as Record<string, unknown>
  // Fall back to schema defaults on parse failure
  const defaults = schema.safeParse({})
  return defaults.success ? (defaults.data as Record<string, unknown>) : {}
}
