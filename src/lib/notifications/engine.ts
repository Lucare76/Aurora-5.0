import type { EngineInput, NotificationCandidate, NotificationSeverity } from './types'
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
 */
export function evaluateNotificationRules(input: EngineInput): NotificationCandidate[] {
  const { accounts, budgets, recurringRules, goals, loans, recentLoanPayments,
    recentAutomationApplications, recentTransactions, now } = input

  const allCandidates: NotificationCandidate[] = [
    ...evaluateBalanceRules(accounts, recurringRules, now),
    ...evaluateBudgetRules(budgets, now),
    ...evaluateRecurrenceRules(recurringRules, now),
    ...evaluateGoalRules(goals, now),
    ...evaluateLoanRules(loans, recentLoanPayments, now),
    ...evaluateAutomationRules(recentAutomationApplications),
    ...evaluateDuplicateRules(recentTransactions, now),
  ]

  // Deduplicate candidates by dedupe_key: keep highest severity
  return deduplicateCandidates(allCandidates)
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
