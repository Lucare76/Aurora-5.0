import { SCORE_THRESHOLDS } from './constants'
import { roundMoney, roundScore, safeRatio } from './helpers'
import type { ComponentScore, HealthLoan, HealthLoanPayment } from './types'

export type DebtHealthSummary = {
  debtOutstanding: number
  monthlyDebtPayments: number
  paymentToIncomeRatio: number | null
  activeLoans: number
  overdueInstallments: number
  overdueAmount: number
  dueWithin30: number
  dueWithin90: number
  dueWithin365: number
}

export function summarizeDebt(params: {
  loans: HealthLoan[]
  loanPayments: HealthLoanPayment[]
  monthlyIncome: number
  today: string
}): DebtHealthSummary {
  const active = params.loans.filter((loan) => !loan.is_settled && loan.remaining > 0)
  const debtOutstanding = roundMoney(active.reduce((sum, loan) => sum + loan.remaining, 0))
  const dueLoans = active.filter((loan) => loan.due_date)
  const overdue = dueLoans.filter((loan) => loan.due_date! < params.today)
  const dueWithin = (days: number) => dueLoans.filter((loan) => {
    const due = new Date(`${loan.due_date}T00:00:00`)
    const today = new Date(`${params.today}T00:00:00`)
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
    return diff >= 0 && diff <= days
  })
  const recentPayments = params.loanPayments.filter((payment) => payment.paid_at.slice(0, 7) === params.today.slice(0, 7))
  const monthlyDebtPayments = roundMoney(recentPayments.reduce((sum, payment) => sum + payment.amount, 0))

  return {
    debtOutstanding,
    monthlyDebtPayments,
    paymentToIncomeRatio: safeRatio(monthlyDebtPayments, params.monthlyIncome),
    activeLoans: active.length,
    overdueInstallments: overdue.length,
    overdueAmount: roundMoney(overdue.reduce((sum, loan) => sum + loan.remaining, 0)),
    dueWithin30: dueWithin(30).length,
    dueWithin90: dueWithin(90).length,
    dueWithin365: dueWithin(365).length,
  }
}

export function calculateDebtScore(summary: DebtHealthSummary, weight: number): ComponentScore {
  if (summary.activeLoans === 0 && summary.debtOutstanding === 0) {
    return {
      component: 'debt',
      score: 100,
      weight,
      contribution: weight,
      availability: 'AVAILABLE',
      status: 'good',
      factors: [{ id: 'debt-none', component: 'debt', impact: 'POSITIVE', severity: 'INFO', title: 'Nessun debito attivo registrato', description: 'Non risultano prestiti aperti nei dati di Aurora.' }],
    }
  }

  let score = 100
  const ratio = summary.paymentToIncomeRatio
  if (ratio == null) score -= 10
  else if (ratio > SCORE_THRESHOLDS.debtElevatedRatio) score -= 45
  else if (ratio > SCORE_THRESHOLDS.debtModerateRatio) score -= 30
  else if (ratio > SCORE_THRESHOLDS.debtGoodRatio) score -= 15
  if (summary.overdueInstallments > 0) score -= 30

  const finalScore = roundScore(score)
  return {
    component: 'debt',
    score: finalScore,
    weight,
    contribution: roundMoney((finalScore / 100) * weight),
    availability: 'AVAILABLE',
    status: finalScore >= 75 ? 'good' : finalScore >= 50 ? 'watch' : 'risk',
    factors: summary.overdueInstallments > 0
      ? [{ id: 'debt-overdue', component: 'debt', impact: 'NEGATIVE', severity: 'CRITICAL', title: 'Prestiti scaduti', description: 'Sono presenti prestiti con scadenza passata da verificare.', metricValue: summary.overdueInstallments, metricUnit: 'prestiti' }]
      : [{ id: 'debt-ratio', component: 'debt', impact: finalScore >= 75 ? 'POSITIVE' : 'NEUTRAL', severity: finalScore >= 75 ? 'INFO' : 'WARNING', title: 'Incidenza rate sulle entrate', description: 'Il rapporto è calcolato sulle entrate registrate, non è un indicatore bancario.', metricValue: ratio, metricUnit: '%' }],
  }
}
