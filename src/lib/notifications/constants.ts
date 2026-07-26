import type { NotificationType } from './types'

// ── Refresh cooldown ────────────────────────────────────────────────────────
export const REFRESH_COOLDOWN_SECONDS = 60

// ── Detection windows ───────────────────────────────────────────────────────
export const PROJECTED_BALANCE_DAYS    = 30  // how far ahead to project balances
export const DUPLICATE_WINDOW_DAYS     = 14  // look back window for duplicate detection
export const UPCOMING_DAYS_WARNING     = 3   // days before due date → INFO alert
export const LOAN_DUE_DAYS_WARNING     = 7   // days before loan due date → WARNING

// ── Budget thresholds ───────────────────────────────────────────────────────
export const BUDGET_WARNING_THRESHOLD  = 80   // % → WARNING
export const BUDGET_CRITICAL_THRESHOLD = 100  // % → CRITICAL

// ── Goal behind schedule ────────────────────────────────────────────────────
export const GOAL_BEHIND_TOLERANCE_PCT = 10  // pp tolerance before generating alert
export const GOAL_CRITICAL_DAYS_LIMIT  = 30  // days remaining threshold for CRITICAL severity
export const GOAL_CRITICAL_GAP_PCT     = 30  // gap % threshold for CRITICAL severity

// ── Notification type metadata ──────────────────────────────────────────────
// isCondition=true → auto-resolved when condition no longer present
// isCondition=false → EVENT, never auto-resolved by the engine

export const NOTIFICATION_META: Record<NotificationType, { isCondition: boolean; label: string }> = {
  negative_projected_balance: { isCondition: true,  label: 'Saldo previsto negativo' },
  budget_threshold:           { isCondition: true,  label: 'Budget quasi esaurito / superato' },
  overdue_recurrence:         { isCondition: true,  label: 'Ricorrenza scaduta' },
  upcoming_recurrence:        { isCondition: true,  label: 'Ricorrenza imminente' },
  upcoming_loan_payment:      { isCondition: true,  label: 'Pagamento imminente' },
  overdue_loan_payment:       { isCondition: true,  label: 'Pagamento scaduto' },
  loan_due_soon:              { isCondition: true,  label: 'Prestito in scadenza' },
  goal_behind_schedule:       { isCondition: true,  label: 'Obiettivo in ritardo' },
  automation_failure:         { isCondition: false, label: 'Automazione fallita' },
  automation_conflict:        { isCondition: false, label: 'Conflitto automazione' },
  possible_duplicate:         { isCondition: false, label: 'Possibile duplicato' },
}

// ── Severity CRITICAL threshold for projected balance ───────────────────────
export const NEGATIVE_BALANCE_CRITICAL_THRESHOLD = -100  // € below zero → CRITICAL

// ── Max notifications per page ──────────────────────────────────────────────
export const NOTIFICATIONS_PAGE_LIMIT    = 50
export const NOTIFICATIONS_BELL_LIMIT    = 5
export const NOTIFICATIONS_DEFAULT_LIMIT = 20
