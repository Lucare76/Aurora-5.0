import { roundMoney } from './aggregations'

/**
 * Reconciliation is a control layer on top of accounts.balance, not a second
 * source of truth: the difference must be compared cent-based (never with a
 * raw floating point equality) and the app never auto-corrects the balance —
 * see supabase/migrations/00039_bank_reconciliation_and_neutral_transactions.sql.
 */
export const RECONCILIATION_CENT_TOLERANCE = 0.01

export function calculateReconciliationDifference(bankBalance: number, appBalanceSnapshot: number): number {
  return roundMoney(bankBalance - appBalanceSnapshot)
}

export function isReconciliationBalanced(difference: number): boolean {
  return Math.abs(roundMoney(difference)) <= RECONCILIATION_CENT_TOLERANCE
}

export function deriveReconciliationStatus(difference: number): 'reconciled' | 'mismatch' {
  return isReconciliationBalanced(difference) ? 'reconciled' : 'mismatch'
}

export function latestReconciliationByAccount<T extends { account_id: string; created_at: string }>(
  reconciliations: T[],
): Map<string, T> {
  const latest = new Map<string, T>()
  for (const row of reconciliations) {
    const current = latest.get(row.account_id)
    if (!current || row.created_at > current.created_at) latest.set(row.account_id, row)
  }
  return latest
}

export function daysSinceStatement(statementDate: string, nowDate: string): number {
  const from = new Date(`${statementDate.slice(0, 10)}T00:00:00Z`).getTime()
  const to = new Date(`${nowDate.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((to - from) / 86400000)
}
