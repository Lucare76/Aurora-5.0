import {
  BUDGET_CRITICAL_THRESHOLD,
  BUDGET_WARNING_THRESHOLD,
  GOAL_BEHIND_TOLERANCE_PCT,
  GOAL_CRITICAL_DAYS_LIMIT,
  GOAL_CRITICAL_GAP_PCT,
  LOAN_DUE_DAYS_WARNING,
  NEGATIVE_BALANCE_CRITICAL_THRESHOLD,
  PROJECTED_BALANCE_DAYS,
  UPCOMING_DAYS_WARNING,
} from './constants'
import { parseTypeConfig } from './preferences-schema'
import type {
  AutomationNotificationConfig,
  BalanceNotificationConfig,
  BudgetNotificationConfig,
  DuplicateNotificationConfig,
  GoalNotificationConfig,
  LoanNotificationConfig,
  NotificationPreference,
  NotificationSourceMute,
  NotificationTypeConfigMap,
  NotificationUserSettings,
  RecurrenceNotificationConfig,
  ResolvedPreferences,
  ResolvedTypePreference,
  ResolvedUserSettings,
} from './preferences-types'
import type { NotificationType } from './types'

// ── Global settings defaults ─────────────────────────────────────────────────

export const DEFAULT_USER_SETTINGS: ResolvedUserSettings = {
  notificationsEnabled: true,
  showInfo:             true,
  showWarning:          true,
  showCritical:         true,
  quietHoursEnabled:    false,
  quietHoursStart:      null,
  quietHoursEnd:        null,
  timezone:             null,
  digestEnabled:        false,
  digestFrequency:      null,
  digestTime:           null,
}

// ── Per-type config defaults ─────────────────────────────────────────────────

export const DEFAULT_BALANCE_CONFIG: BalanceNotificationConfig = {
  lookaheadDays: PROJECTED_BALANCE_DAYS,
  criticalBelow: NEGATIVE_BALANCE_CRITICAL_THRESHOLD,
  accountIds:    null,
}

export const DEFAULT_BUDGET_CONFIG: BudgetNotificationConfig = {
  warningPercentage:  BUDGET_WARNING_THRESHOLD,
  criticalPercentage: BUDGET_CRITICAL_THRESHOLD,
}

export const DEFAULT_RECURRENCE_CONFIG: RecurrenceNotificationConfig = {
  advanceDays:             UPCOMING_DAYS_WARNING,
  overdueEnabled:          true,
  overdueCriticalAfterDays: 7,
}

export const DEFAULT_GOAL_CONFIG: GoalNotificationConfig = {
  tolerancePercentagePoints:  GOAL_BEHIND_TOLERANCE_PCT,
  criticalDaysRemaining:      GOAL_CRITICAL_DAYS_LIMIT,
  criticalGapPercentagePoints: GOAL_CRITICAL_GAP_PCT,
}

export const DEFAULT_LOAN_CONFIG: LoanNotificationConfig = {
  advanceDays:    LOAN_DUE_DAYS_WARNING,
  overdueEnabled: true,
}

export const DEFAULT_DUPLICATE_CONFIG: DuplicateNotificationConfig = {
  dateToleranceDays:         0,
  descriptionMatchRequired:  false,
}

export const DEFAULT_AUTOMATION_CONFIG: AutomationNotificationConfig = {
  includeConflicts: true,
}

export const DEFAULT_TYPE_CONFIGS: NotificationTypeConfigMap = {
  negative_projected_balance: DEFAULT_BALANCE_CONFIG,
  budget_threshold:           DEFAULT_BUDGET_CONFIG,
  upcoming_recurrence:        DEFAULT_RECURRENCE_CONFIG,
  overdue_recurrence:         DEFAULT_RECURRENCE_CONFIG,
  upcoming_loan_payment:      DEFAULT_LOAN_CONFIG,
  overdue_loan_payment:       DEFAULT_LOAN_CONFIG,
  loan_due_soon:              DEFAULT_LOAN_CONFIG,
  goal_behind_schedule:       DEFAULT_GOAL_CONFIG,
  automation_failure:         DEFAULT_AUTOMATION_CONFIG,
  automation_conflict:        DEFAULT_AUTOMATION_CONFIG,
  possible_duplicate:         DEFAULT_DUPLICATE_CONFIG,
}

// ── Resolution functions ─────────────────────────────────────────────────────

export function resolveUserSettings(
  row: NotificationUserSettings | null,
): ResolvedUserSettings {
  if (!row) return DEFAULT_USER_SETTINGS
  // Convert PostgreSQL "HH:MM:SS" to "HH:MM"
  const trim = (t: string | null) => t ? t.substring(0, 5) : null
  return {
    notificationsEnabled: row.notifications_enabled,
    showInfo:             row.show_info,
    showWarning:          row.show_warning,
    showCritical:         row.show_critical,
    quietHoursEnabled:    row.quiet_hours_enabled,
    quietHoursStart:      trim(row.quiet_hours_start),
    quietHoursEnd:        trim(row.quiet_hours_end),
    timezone:             row.timezone,
    digestEnabled:        row.digest_enabled,
    digestFrequency:      row.digest_frequency,
    digestTime:           trim(row.digest_time),
  }
}

export function resolveTypePreference(
  type: NotificationType,
  row: NotificationPreference | null,
): ResolvedTypePreference {
  const config = parseTypeConfig(type, row?.config ?? {})
  const defaults = DEFAULT_TYPE_CONFIGS[type] as Record<string, unknown>
  return {
    isEnabled: row?.is_enabled ?? true,
    config:    { ...defaults, ...config },
  }
}

/**
 * Merges DB rows into a ResolvedPreferences object used by the engine.
 * If no rows exist, falls back to defaults.
 */
export function resolvePreferences(
  userSettingsRow: NotificationUserSettings | null,
  preferenceRows: NotificationPreference[],
  sourceMutes: NotificationSourceMute[],
): ResolvedPreferences {
  const userSettings = resolveUserSettings(userSettingsRow)

  const allTypes: NotificationType[] = [
    'negative_projected_balance', 'budget_threshold',
    'upcoming_recurrence', 'overdue_recurrence',
    'upcoming_loan_payment', 'overdue_loan_payment', 'loan_due_soon',
    'goal_behind_schedule', 'automation_failure', 'automation_conflict',
    'possible_duplicate',
  ]

  const rowMap = new Map(preferenceRows.map((r) => [r.notification_type, r]))
  const typePreferences: Partial<Record<NotificationType, ResolvedTypePreference>> = {}

  for (const t of allTypes) {
    typePreferences[t] = resolveTypePreference(t, rowMap.get(t) ?? null)
  }

  // Filter out expired mutes at resolution time
  const now = Date.now()
  const activeMutes = sourceMutes.filter(
    (m) => !m.muted_until || new Date(m.muted_until).getTime() > now,
  )

  return { userSettings, typePreferences, sourceMutes: activeMutes }
}

/**
 * Returns true if a notification candidate is muted by any active source mute.
 */
export function isSourceMuted(
  mutes: NotificationSourceMute[],
  sourceType: string | null,
  sourceId: string | null,
  type: NotificationType,
): boolean {
  if (!sourceType || !sourceId) return false
  const now = Date.now()
  return mutes.some(
    (m) =>
      m.source_type === sourceType &&
      m.source_id === sourceId &&
      (m.notification_type === null || m.notification_type === type) &&
      (!m.muted_until || new Date(m.muted_until).getTime() > now),
  )
}

/**
 * Checks whether the current wall-clock time (in user timezone) falls within quiet hours.
 * Uses the user's timezone from settings, or UTC if not set.
 */
export function isInQuietHours(settings: ResolvedUserSettings, now = new Date()): boolean {
  if (!settings.quietHoursEnabled || !settings.quietHoursStart || !settings.quietHoursEnd) {
    return false
  }
  const tz = settings.timezone ?? 'UTC'
  try {
    // Get current time as "HH:MM" in user's timezone
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const currentTime = formatter.format(now)
    const [startH, startM] = settings.quietHoursStart.split(':').map(Number)
    const [endH, endM] = settings.quietHoursEnd.split(':').map(Number)
    const [curH, curM] = currentTime.split(':').map(Number)

    const start = startH * 60 + startM
    const end   = endH   * 60 + endM
    const cur   = curH   * 60 + curM

    // Handle intervals that cross midnight (e.g. 22:00–07:00)
    if (start <= end) {
      return cur >= start && cur < end
    } else {
      return cur >= start || cur < end
    }
  } catch {
    return false
  }
}

/**
 * Computes "tomorrow at 09:00" in the user's timezone.
 */
export function tomorrowAt9(timezone: string | null = null): Date {
  const tz = timezone ?? 'UTC'
  const now = new Date()
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    const today = formatter.format(now)
    // Build tomorrow date string
    const tomorrow = new Date(new Date(today + 'T00:00:00Z').getTime() + 86_400_000)
    const tomorrowStr = formatter.format(tomorrow)
    return new Date(`${tomorrowStr}T09:00:00`)
  } catch {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow
  }
}
