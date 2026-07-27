import type { ActionModifications, AccountBalanceAdjustmentParams, ProjectionPeriod } from '../types'
import { roundMoney } from '../money'

/**
 * ACCOUNT_BALANCE_ADJUSTMENT: rettifica una-tantum del saldo iniziale.
 *
 * Non è legata a una data specifica — viene applicata al primo periodo
 * della proiezione come incomeAdjustment (positivo) o expenseAdjustment
 * (per importo negativo). Il carry-forward propaga l'effetto nei mesi
 * successivi automaticamente.
 */
export function applyAccountBalanceAdjustment(
  params: AccountBalanceAdjustmentParams,
  periods: ProjectionPeriod[],
): ActionModifications {
  const mods: ActionModifications = new Map()
  if (periods.length === 0) return mods

  const firstPeriod = periods[0]
  const adj = roundMoney(params.adjustmentAmount)

  mods.set(firstPeriod.key, {
    incomeAdjustment: adj > 0 ? adj : 0,
    expenseAdjustment: adj < 0 ? -adj : 0,
    loanAdjustment: 0,
    goalAdjustment: 0,
    notes: [`Rettifica saldo iniziale: ${adj >= 0 ? '+' : ''}€${adj}`],
  })

  return mods
}
