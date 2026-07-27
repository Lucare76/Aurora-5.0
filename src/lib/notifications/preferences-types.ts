import type { NotificationSourceType, NotificationType } from './types'

// ── DB row types ─────────────────────────────────────────────────────────────

export type NotificationUserSettings = {
  user_id: string
  notifications_enabled: boolean
  show_info: boolean
  show_warning: boolean
  show_critical: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null   // "HH:MM:SS" PostgreSQL time
  quiet_hours_end: string | null
  digest_enabled: boolean
  digest_frequency: 'DAILY' | 'WEEKLY' | null
  digest_time: string | null
  timezone: string | null
  created_at: string
  updated_at: string
}

export type NotificationPreference = {
  id: string
  user_id: string
  notification_type: NotificationType
  is_enabled: boolean
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type NotificationSourceMute = {
  id: string
  user_id: string
  source_type: NotificationSourceType
  source_id: string
  notification_type: NotificationType | null   // null = all types
  muted_until: string | null                   // null = indefinite
  reason: string | null
  created_at: string
  updated_at: string
}

// ── Per-type config shapes ────────────────────────────────────────────────────

export type BalanceNotificationConfig = {
  lookaheadDays: number        // 1–365
  criticalBelow: number        // monetary threshold for CRITICAL
  accountIds: string[] | null  // null = monitor all active accounts
}

export type BudgetNotificationConfig = {
  warningPercentage: number    // 1–100
  criticalPercentage: number   // warningPercentage–500
}

export type RecurrenceNotificationConfig = {
  advanceDays: number              // 0–90 (days ahead to warn)
  overdueEnabled: boolean          // generate overdue_recurrence alerts
  overdueCriticalAfterDays: number // 0–90: days past due → CRITICAL
}

export type GoalNotificationConfig = {
  tolerancePercentagePoints: number  // 0–50: pp behind before alert
  criticalDaysRemaining: number      // 0–90: days left → CRITICAL
  criticalGapPercentagePoints: number // 0–100: gap pp → CRITICAL
}

export type LoanNotificationConfig = {
  advanceDays: number    // 0–90
  overdueEnabled: boolean
}

export type DuplicateNotificationConfig = {
  dateToleranceDays: number           // 0–7
  descriptionMatchRequired: boolean
}

export type AutomationNotificationConfig = {
  includeConflicts: boolean
}

// Union of all config types keyed by NotificationType
export type NotificationTypeConfigMap = {
  negative_projected_balance: BalanceNotificationConfig
  budget_threshold:           BudgetNotificationConfig
  upcoming_recurrence:        RecurrenceNotificationConfig
  overdue_recurrence:         RecurrenceNotificationConfig
  upcoming_loan_payment:      LoanNotificationConfig
  overdue_loan_payment:       LoanNotificationConfig
  loan_due_soon:              LoanNotificationConfig
  goal_behind_schedule:       GoalNotificationConfig
  automation_failure:         AutomationNotificationConfig
  automation_conflict:        AutomationNotificationConfig
  possible_duplicate:         DuplicateNotificationConfig
}

// ── Resolved preferences ─────────────────────────────────────────────────────
// Merged result of defaults + user overrides, ready for the engine.

export type ResolvedUserSettings = {
  notificationsEnabled: boolean
  showInfo: boolean
  showWarning: boolean
  showCritical: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string | null    // "HH:MM"
  quietHoursEnd: string | null
  timezone: string | null
  digestEnabled: boolean
  digestFrequency: 'DAILY' | 'WEEKLY' | null
  digestTime: string | null
}

export type ResolvedTypePreference = {
  isEnabled: boolean
  config: Record<string, unknown>
}

export type ResolvedPreferences = {
  userSettings: ResolvedUserSettings
  typePreferences: Partial<Record<NotificationType, ResolvedTypePreference>>
  sourceMutes: NotificationSourceMute[]
}

// ── Input/output types for API ───────────────────────────────────────────────

export type UpdateUserSettingsInput = Partial<Omit<NotificationUserSettings,
  'user_id' | 'created_at' | 'updated_at'>>

export type UpdatePreferenceInput = {
  is_enabled?: boolean
  config?: Record<string, unknown>
}

export type CreateSourceMuteInput = {
  source_type: NotificationSourceType
  source_id: string
  notification_type?: NotificationType | null
  muted_until?: string | null
  reason?: string | null
}
