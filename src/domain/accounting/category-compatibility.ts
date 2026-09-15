import type { CategoryType, TransactionType } from '@/types/database'

/**
 * Single source of truth for whether a category may legitimately be assigned to
 * a transaction of a given type. Was previously re-implemented ad hoc in
 * separate places (the manual transaction form's category tree, the
 * bank-statement import review list) and never checked at all in
 * auto-categorization/automation — which is exactly how a category typed
 * 'income' ended up on an 'expense' transaction (the real "Disoccupazione"
 * case). Every caller that needs this check must go through this function
 * instead of re-deriving the rule locally.
 *
 * Rules:
 * - income transaction: 'income' or 'both' category is valid, 'expense' is not.
 * - expense transaction: 'expense' or 'both' category is valid, 'income' is not.
 * - transfer transaction: never compatible with a normal category. Transfers
 *   don't carry a category in this app's existing model (the transaction form
 *   already clears category_id when type is 'transfer'); this just codifies
 *   that invariant so import/automation can rely on it too, per "salvo
 *   comportamento esplicitamente previsto dal progetto" — no such exception
 *   exists today.
 */
export function isCategoryCompatibleWithTransactionType(
  transactionType: TransactionType,
  categoryType: CategoryType,
): boolean {
  if (transactionType === 'transfer') return false
  if (categoryType === 'both') return true
  return transactionType === categoryType
}
