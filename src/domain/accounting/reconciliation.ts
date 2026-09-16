import { roundMoney } from './aggregations'

/**
 * Reconciliation compares a user-typed bank balance against Aurora's balance
 * snapshot. The comparison is cent-based and floating-point safe (both sides
 * are rounded to two decimals before comparing, absorbing IEEE754 noise like
 * 0.1 + 0.2 !== 0.3) — but there is no tolerance band once rounded: reconciled
 * means the rounded difference is exactly 0.00. Even +/-0.01 is a mismatch.
 */
export function calculateReconciliationDifference(bankBalance: number, appBalanceSnapshot: number): number {
  const rounded = roundMoney(bankBalance - appBalanceSnapshot)
  // Normalize -0 to 0: a tiny negative floating-point residue (e.g. from
  // 1000.3 - (1000 + 0.1 + 0.2)) can round to -0, which is === 0 for every
  // comparison here but would render as "-€0,00" if ever displayed raw.
  return rounded === 0 ? 0 : rounded
}

export function isReconciliationBalanced(difference: number): boolean {
  return roundMoney(difference) === 0
}

export function deriveReconciliationStatus(difference: number): 'reconciled' | 'mismatch' {
  return isReconciliationBalanced(difference) ? 'reconciled' : 'mismatch'
}

type ReconciliationRecencyKey = { statement_date: string; created_at: string }

/**
 * "Current" is always the reconciliation with the latest statement_date, tied
 * only by created_at — never insertion order alone. This matters because a
 * user can retroactively add an older bank statement after a newer one is
 * already on file: that retroactive row must never become "current" just
 * because it was inserted most recently.
 *
 * Returns a negative number when `a` is more recent than `b` (so this sorts
 * a descending array with the most recent reconciliation first, matching
 * Array.prototype.sort's comparator contract).
 */
export function compareReconciliationRecency<T extends ReconciliationRecencyKey>(a: T, b: T): number {
  const byStatementDate = b.statement_date.localeCompare(a.statement_date)
  if (byStatementDate !== 0) return byStatementDate
  return b.created_at.localeCompare(a.created_at)
}

export function latestReconciliationByAccount<T extends { account_id: string } & ReconciliationRecencyKey>(
  reconciliations: T[],
): Map<string, T> {
  const latest = new Map<string, T>()
  for (const row of reconciliations) {
    const current = latest.get(row.account_id)
    if (!current || compareReconciliationRecency(row, current) < 0) latest.set(row.account_id, row)
  }
  return latest
}

export function daysSinceStatement(statementDate: string, nowDate: string): number {
  const from = new Date(`${statementDate.slice(0, 10)}T00:00:00Z`).getTime()
  const to = new Date(`${nowDate.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((to - from) / 86400000)
}
