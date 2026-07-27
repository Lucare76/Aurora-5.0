import type { ActionModifications, LoanEarlyPayoffParams, ProjectionPeriod } from '../types'
import type { Loan, LoanPayment } from '@/types/database'
import { roundMoney, averageMoney } from '../money'
import { CONTRIBUTION_LOOKBACK_MONTHS } from '../constants'

/**
 * LOAN_EARLY_PAYOFF: simula il saldo anticipato di un prestito.
 *
 * - Nel mese del saldo: spesa pari a loan.remaining + eventuale penale.
 * - Nei mesi successivi: elimina la rata stimata (risparmio mensile).
 */
export function applyLoanEarlyPayoff(
  params: LoanEarlyPayoffParams,
  periods: ProjectionPeriod[],
  loans: Loan[],
  loanPayments: LoanPayment[],
): ActionModifications {
  const mods: ActionModifications = new Map()
  const loan = loans.find((l) => l.id === params.loanId)
  if (!loan) return mods

  // Estimate monthly payment from recent payment history (paid_at field)
  const recentPayments = loanPayments
    .filter((p) => p.loan_id === params.loanId)
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
    .slice(0, CONTRIBUTION_LOOKBACK_MONTHS)

  const monthlyEstimate = recentPayments.length > 0
    ? averageMoney(recentPayments.map((p) => p.amount))
    : 0

  const payoffCost = roundMoney(loan.remaining + (params.penaltyAmount ?? 0))

  for (const period of periods) {
    // Month of payoff: lump-sum cost (remaining balance + penalty)
    if (period.startDate <= params.payoffDate && params.payoffDate <= period.endDate) {
      mods.set(period.key, {
        incomeAdjustment: 0,
        expenseAdjustment: payoffCost,
        loanAdjustment: monthlyEstimate > 0 ? -monthlyEstimate : 0,
        goalAdjustment: 0,
        notes: [
          `Saldo anticipato "${loan.counterpart}": €${payoffCost}`,
          ...(params.penaltyAmount ? [`Penale inclusa: €${params.penaltyAmount}`] : []),
          ...(monthlyEstimate > 0 ? [`Rata eliminata: −€${monthlyEstimate}/mese`] : []),
        ],
      })
      continue
    }

    // After payoff: remove the monthly loan payment
    if (period.startDate > params.payoffDate && monthlyEstimate > 0) {
      mods.set(period.key, {
        incomeAdjustment: 0,
        expenseAdjustment: 0,
        loanAdjustment: -monthlyEstimate,
        goalAdjustment: 0,
        notes: [`Rata eliminata dopo saldo: −€${monthlyEstimate}/mese`],
      })
    }
  }

  return mods
}
