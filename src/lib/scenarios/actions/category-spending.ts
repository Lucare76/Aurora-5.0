import type { ActionModifications, CategorySpendingChangeParams, ProjectionPeriod } from '../types'
import { roundMoney } from '../money'

/**
 * CATEGORY_SPENDING_CHANGE: modifica la spesa mensile in una categoria.
 *
 * changeAmount < 0 = riduzione spesa (risparmio)
 * changeAmount > 0 = aumento spesa
 */
export function applyCategorySpendingChange(
  params: CategorySpendingChangeParams,
  periods: ProjectionPeriod[],
): ActionModifications {
  const mods: ActionModifications = new Map()

  for (const period of periods) {
    if (period.startDate < params.startDate) continue
    if (params.endDate && period.endDate > params.endDate) continue

    const adj = roundMoney(params.changeAmount)
    if (adj === 0) continue

    mods.set(period.key, {
      incomeAdjustment: 0,
      expenseAdjustment: adj,
      loanAdjustment: 0,
      goalAdjustment: 0,
      notes: [
        adj < 0
          ? `Riduzione spesa categoria: −€${Math.abs(adj)}/mese`
          : `Aumento spesa categoria: +€${adj}/mese`,
      ],
    })
  }

  return mods
}
