import type { ActionModifications, MonthlySavingsChangeParams, ProjectionPeriod } from '../types'
import { roundMoney } from '../money'

/**
 * MONTHLY_SAVINGS_CHANGE: modifica la quota mensile di risparmio.
 * Un changeAmount negativo = più risparmio (meno spesa disponibile).
 * Un changeAmount positivo = meno risparmio (più spesa disponibile).
 *
 * In termini di cash flow: ridurre la spesa mensile di 200 € corrisponde
 * a un expenseAdjustment di -200 (meno uscite).
 */
export function applyMonthlySavingsChange(
  params: MonthlySavingsChangeParams,
  periods: ProjectionPeriod[],
): ActionModifications {
  const mods: ActionModifications = new Map()

  for (const period of periods) {
    if (period.startDate < params.startDate) continue
    if (params.endDate && period.endDate > params.endDate) continue

    // changeAmount > 0 = riduzione spesa (risparmio). Modelliamo come expense negativo.
    // changeAmount < 0 = aumento spesa (meno risparmio). Expense positivo.
    const expAdj = -roundMoney(params.changeAmount)

    mods.set(period.key, {
      incomeAdjustment: 0,
      expenseAdjustment: expAdj,
      loanAdjustment: 0,
      goalAdjustment: 0,
      notes: [
        params.changeAmount > 0
          ? `Risparmio mensile +€${params.changeAmount}`
          : `Riduzione risparmio €${Math.abs(params.changeAmount)}`,
      ],
    })
  }

  return mods
}
