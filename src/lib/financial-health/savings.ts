import { SCORE_THRESHOLDS } from './constants'
import { average, clamp, roundMoney, roundScore, safeRatio } from './helpers'
import type { ComponentScore, HealthFactor, MonthlyCashFlowMetric } from './types'

export function calculateSavingsRate(income: number, expenses: number): number | null {
  return safeRatio(income - expenses, income)
}

export function calculateCashFlowStability(months: MonthlyCashFlowMetric[]): {
  stabilityScore: number
  positiveMonths: number
  negativeMonths: number
  variability: number
  explanation: string
} {
  const observed = months.filter((month) => month.transactionCount > 0)
  if (observed.length < 2) {
    return { stabilityScore: 50, positiveMonths: observed.filter((m) => m.netCashFlow >= 0).length, negativeMonths: observed.filter((m) => m.netCashFlow < 0).length, variability: 0, explanation: 'Dati limitati per misurare la stabilità.' }
  }
  const flows = observed.map((month) => month.netCashFlow)
  const avg = average(flows)
  const mad = average(flows.map((flow) => Math.abs(flow - avg)))
  const variability = avg === 0 ? mad : Math.abs(mad / avg)
  const positiveMonths = observed.filter((month) => month.netCashFlow >= 0).length
  const negativeMonths = observed.length - positiveMonths
  const score = roundScore(100 - clamp(variability * 35, 0, 45) - negativeMonths * 8)
  return { stabilityScore: score, positiveMonths, negativeMonths, variability: roundMoney(variability), explanation: negativeMonths > 0 ? 'Alcuni mesi hanno margine negativo.' : 'I mesi osservati hanno margine positivo.' }
}

export function calculateSavingsScore(input: {
  currentSavingsRate: number | null
  trailing3MonthSavingsRate: number | null
  positiveCashFlowMonths: number
  totalObservedMonths: number
  weight: number
}): ComponentScore {
  const factors: HealthFactor[] = []
  const rate = input.trailing3MonthSavingsRate ?? input.currentSavingsRate
  let score = 50

  if (rate == null) {
    factors.push({
      id: 'savings-no-income',
      component: 'savings',
      impact: 'NEUTRAL',
      severity: 'INFO',
      title: 'Entrate non sufficienti',
      description: 'Non ci sono entrate sufficienti per calcolare un tasso di risparmio stabile.',
    })
  } else if (rate >= SCORE_THRESHOLDS.savingsExcellent) {
    score = 95
    factors.push({ id: 'savings-rate-strong', component: 'savings', impact: 'POSITIVE', severity: 'INFO', title: 'Buona capacità di risparmio', description: 'Il margine registrato è sopra la soglia interna elevata.', metricValue: rate, metricUnit: '%' })
  } else if (rate >= SCORE_THRESHOLDS.savingsGood) {
    score = 80
    factors.push({ id: 'savings-rate-good', component: 'savings', impact: 'POSITIVE', severity: 'INFO', title: 'Margine positivo', description: 'Le entrate superano le uscite con un margine utile.', metricValue: rate, metricUnit: '%' })
  } else if (rate >= SCORE_THRESHOLDS.savingsPositive) {
    score = 60
    factors.push({ id: 'savings-rate-limited', component: 'savings', impact: 'NEUTRAL', severity: 'INFO', title: 'Margine mensile ridotto', description: 'Il tasso di risparmio è positivo ma contenuto.', metricValue: rate, metricUnit: '%' })
  } else {
    score = 25
    factors.push({ id: 'savings-rate-negative', component: 'savings', impact: 'NEGATIVE', severity: 'WARNING', title: 'Margine negativo', description: 'Nel periodo osservato le uscite superano le entrate.', metricValue: rate, metricUnit: '%' })
  }

  if (input.totalObservedMonths > 0) {
    const positiveRatio = input.positiveCashFlowMonths / input.totalObservedMonths
    score += positiveRatio >= 0.8 ? 5 : positiveRatio < 0.5 ? -10 : 0
  }

  const finalScore = roundScore(score)
  return {
    component: 'savings',
    score: finalScore,
    weight: input.weight,
    contribution: roundMoney((finalScore / 100) * input.weight),
    availability: 'AVAILABLE',
    status: finalScore >= 75 ? 'good' : finalScore >= 50 ? 'watch' : 'risk',
    factors,
  }
}
