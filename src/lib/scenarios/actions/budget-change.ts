import type { ActionModifications, BudgetLimitChangeParams, ProjectionPeriod } from '../types'

/**
 * BUDGET_LIMIT_CHANGE: modifica informativa del limite di budget.
 * Non influisce sul cash flow — solo sugli indicatori budget simulati.
 * Restituisce sempre una mappa vuota perché non altera flussi monetari.
 */
export function applyBudgetLimitChange(
  _params: BudgetLimitChangeParams,
  _periods: ProjectionPeriod[],
): ActionModifications {
  // Budget limit changes are informational only.
  // The UI will display the simulated budget limit separately.
  return new Map()
}
