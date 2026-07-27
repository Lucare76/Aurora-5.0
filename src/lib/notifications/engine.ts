import type { EngineInput, NotificationCandidate, NotificationSeverity } from './types'
import type {
  AutomationNotificationConfig,
  BalanceNotificationConfig,
  BudgetNotificationConfig,
  DuplicateNotificationConfig,
  GoalNotificationConfig,
  LoanNotificationConfig,
  RecurrenceNotificationConfig,
} from './preferences-types'
import { isSourceMuted } from './preferences-defaults'
import {
  evaluateAutomationRules,
  evaluateBalanceRules,
  evaluateBudgetRules,
  evaluateDuplicateRules,
  evaluateGoalRules,
  evaluateLoanRules,
  evaluateRecurrenceRules,
} from './rules'

/**
 * Pure rule engine. Receives pre-loaded data, returns notification candidates.
 * No DB queries. Idempotent: running multiple times on the same input gives the same result.
 * Preferences (Sprint 13B) are optional: defaults apply when absent.
 */
export function evaluateNotificationRules(input: EngineInput): NotificationCandidate[] {
  const { accounts, budgets, recurringRules, goals, loans, recentLoanPayments,
    recentAutomationApplications, recentTransactions, now, preferences } = input

  const prefs = preferences
  const typePrefs = prefs?.typePreferences
  const mutes     = prefs?.sourceMutes ?? []
  const settings  = prefs?.userSettings

  // Global kill switch
  if (settings && !settings.notificationsEnabled) return []

  // Helper: check if a type is enabled
  const isEnabled = (type: string) => typePrefs?.[type as keyof typeof typePrefs]?.isEnabled !== false

  // Helper: extract config for a type (already merged with defaults in preferences-defaults.ts)
  const cfg = <T>(type: string) =>
    (typePrefs?.[type as keyof typeof typePrefs]?.config ?? {}) as Partial<T>

  const allCandidates: NotificationCandidate[] = [
    ...(isEnabled('negative_projected_balance')
      ? evaluateBalanceRules(accounts, recurringRules, now, cfg<BalanceNotificationConfig>('negative_projected_balance'))
      : []),
    ...(isEnabled('budget_threshold')
      ? evaluateBudgetRules(budgets, now, cfg<BudgetNotificationConfig>('budget_threshold'))
      : []),
    ...(isEnabled('upcoming_recurrence') || isEnabled('overdue_recurrence')
      ? evaluateRecurrenceRules(
          recurringRules, now,
          // Use upcoming_recurrence config (same config for both recurrence types)
          cfg<RecurrenceNotificationConfig>('upcoming_recurrence'),
        )
      : []),
    ...(isEnabled('goal_behind_schedule')
      ? evaluateGoalRules(goals, now, cfg<GoalNotificationConfig>('goal_behind_schedule'))
      : []),
    ...(isEnabled('upcoming_loan_payment') || isEnabled('overdue_loan_payment') || isEnabled('loan_due_soon')
      ? evaluateLoanRules(loans, recentLoanPayments, now, cfg<LoanNotificationConfig>('upcoming_loan_payment'))
      : []),
    ...(isEnabled('automation_failure') || isEnabled('automation_conflict')
      ? evaluateAutomationRules(recentAutomationApplications, cfg<AutomationNotificationConfig>('automation_failure'))
      : []),
    ...(isEnabled('possible_duplicate')
      ? evaluateDuplicateRules(recentTransactions, now, cfg<DuplicateNotificationConfig>('possible_duplicate'))
      : []),
  ]

  // Filter individually disabled types (if recurrences: filter overdue if disabled, etc.)
  const filtered = allCandidates.filter((c) => {
    // Per-type enabled check
    if (!isEnabled(c.type)) return false

    // Severity filter from user settings
    if (settings) {
      if (c.severity === 'INFO'     && !settings.showInfo)     return false
      if (c.severity === 'WARNING'  && !settings.showWarning)  return false
      if (c.severity === 'CRITICAL' && !settings.showCritical) return false
    }

    // Source mute check
    if (isSourceMuted(mutes, c.sourceType, c.sourceId, c.type)) return false

    return true
  })

  // Deduplicate candidates by dedupe_key: keep highest severity
  return deduplicateCandidates(filtered)
}

/**
 * When the same dedupe key appears multiple times (e.g. from different rules),
 * keep the entry with the highest severity.
 */
export function deduplicateCandidates(candidates: NotificationCandidate[]): NotificationCandidate[] {
  const map = new Map<string, NotificationCandidate>()
  for (const c of candidates) {
    const existing = map.get(c.dedupeKey)
    if (!existing || compareSeverity(c.severity, existing.severity) > 0) {
      map.set(c.dedupeKey, c)
    }
  }
  return Array.from(map.values())
}

/** Returns positive if a > b, negative if a < b, 0 if equal */
export function compareSeverity(a: NotificationSeverity, b: NotificationSeverity): number {
  const rank: Record<NotificationSeverity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 }
  return rank[a] - rank[b]
}

/** Build a stable dedupe key from parts, joining with colon */
export function buildDedupeKey(...parts: (string | number)[]): string {
  return parts.map(String).join(':')
}
