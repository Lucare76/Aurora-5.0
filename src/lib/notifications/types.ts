import type { Account, AutomationRuleApplication, Loan, LoanPayment, RecurringRule, SavingsGoal, Transaction } from '@/types/database'
import type { BudgetEntry } from '@/lib/budgets/service'

// ── Core enums ─────────────────────────────────────────────────────────────

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type NotificationType =
  | 'negative_projected_balance'
  | 'budget_threshold'
  | 'overdue_recurrence'
  | 'upcoming_recurrence'
  | 'upcoming_loan_payment'
  | 'overdue_loan_payment'
  | 'loan_due_soon'
  | 'goal_behind_schedule'
  | 'automation_failure'
  | 'automation_conflict'
  | 'possible_duplicate'

export type NotificationSourceType =
  | 'account'
  | 'budget'
  | 'recurring_rule'
  | 'savings_goal'
  | 'loan'
  | 'automation'
  | 'transaction'
  // Legacy values handled by data-integrity engine's sourceExists()
  | 'category'
  | 'goal'
  | 'recurring'

// ── DB row ──────────────────────────────────────────────────────────────────

export type Notification = {
  id: string
  user_id: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  dedupe_key: string
  source_type: NotificationSourceType | null
  source_id: string | null
  source_url: string | null
  metadata: Record<string, unknown>
  is_read: boolean
  archived_at: string | null
  resolved_at: string | null
  snoozed_until: string | null    // Sprint 13B
  last_snoozed_at: string | null  // Sprint 13B
  first_detected_at: string
  last_detected_at: string
  read_at: string | null
  created_at: string
  updated_at: string
}

// ── Engine ──────────────────────────────────────────────────────────────────

// Output of the pure rule engine — no DB operations
export type NotificationCandidate = {
  dedupeKey: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  sourceType: NotificationSourceType | null
  sourceId: string | null
  sourceUrl: string | null
  metadata: Record<string, unknown>
  isCondition: boolean  // true = auto-resolves when condition clears
}

// Input to the pure rule engine — all data pre-loaded by the service layer
export type EngineInput = {
  userId: string
  now: Date
  accounts: Account[]
  budgets: BudgetEntry[]
  recurringRules: RecurringRule[]
  goals: SavingsGoal[]
  loans: Loan[]
  recentLoanPayments: LoanPayment[]
  recentAutomationApplications: Pick<AutomationRuleApplication,
    'id' | 'rule_id' | 'transaction_id' | 'application_batch_id' |
    'result' | 'error_code' | 'applied_at' | 'applied_values'>[]
  recentTransactions: Pick<Transaction,
    'id' | 'account_id' | 'type' | 'amount' | 'description' | 'date' | 'transfer_peer_id'>[]
  // Sprint 13B: optional preferences — defaults apply when absent
  preferences?: import('./preferences-types').ResolvedPreferences
}

// ── Service results ─────────────────────────────────────────────────────────

export type UpsertResult = {
  created: number
  updated: number
  reopened: number
}

export type RefreshResult = {
  candidatesGenerated: number
  upsertResult: UpsertResult
  conditionNotificationsResolved: number
  durationMs: number
}

// ── API list params ─────────────────────────────────────────────────────────

export type NotificationStatusFilter = 'unread' | 'read' | 'archived' | 'resolved' | 'snoozed' | 'all'

export type NotificationListParams = {
  status: NotificationStatusFilter
  severity?: NotificationSeverity
  type?: NotificationType
  sourceType?: NotificationSourceType
  page: number
  limit: number
}

export type NotificationListResult = {
  data: Notification[]
  total: number
  unreadCount: number
  page: number
  limit: number
}
