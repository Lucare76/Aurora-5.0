import type { ActionModifications, OneTimeExpenseParams, ProjectionPeriod } from '../types'
import { dateInPeriod } from '../dates'
import { roundMoney } from '../money'

export function applyOneTimeExpense(
  params: OneTimeExpenseParams,
  periods: ProjectionPeriod[],
  actionId: string,
): ActionModifications {
  const mods: ActionModifications = new Map()

  for (const period of periods) {
    if (!dateInPeriod(params.date, period)) continue

    mods.set(period.key, {
      incomeAdjustment: 0,
      expenseAdjustment: roundMoney(params.amount),
      loanAdjustment: 0,
      goalAdjustment: 0,
      notes: [`Acquisto: ${params.description} (€${params.amount})`],
    })
    break  // one-time: only fires in one period
  }

  return mods
}
