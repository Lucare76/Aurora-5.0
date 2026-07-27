import type { ActionModifications, NewLoanParams, ProjectionPeriod } from '../types'
import { roundMoney } from '../money'

/**
 * NEW_LOAN: simula l'accensione di un nuovo prestito.
 *
 * - Nel mese di firstPaymentDate: aggiunge come entrata il netto erogato
 *   (principalAmount − downPayment).
 * - Da firstPaymentDate per numberOfPayments mesi: rata mensile come loanAdjustment.
 */
export function applyNewLoan(
  params: NewLoanParams,
  periods: ProjectionPeriod[],
): ActionModifications {
  const mods: ActionModifications = new Map()

  const netDisbursement = roundMoney(params.principalAmount - (params.downPayment ?? 0))
  const firstPayment = params.firstPaymentDate

  let paymentMonthsRemaining = params.numberOfPayments
  let started = false

  for (const period of periods) {
    const isFirstPaymentMonth =
      period.startDate <= firstPayment && firstPayment <= period.endDate
    if (isFirstPaymentMonth) started = true

    const isRepaymentActive = started && paymentMonthsRemaining > 0
    if (!isRepaymentActive) continue

    const notes: string[] = []
    let incomeAdj = 0

    if (isFirstPaymentMonth && netDisbursement > 0) {
      incomeAdj = netDisbursement
      notes.push(`Erogazione prestito "${params.description}": +€${netDisbursement}`)
    }

    notes.push(`Rata "${params.description}": €${params.monthlyPayment}/mese`)
    paymentMonthsRemaining--

    mods.set(period.key, {
      incomeAdjustment: incomeAdj,
      expenseAdjustment: 0,
      loanAdjustment: params.monthlyPayment,
      goalAdjustment: 0,
      notes,
    })
  }

  return mods
}
