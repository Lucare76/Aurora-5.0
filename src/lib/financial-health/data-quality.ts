import { DATA_QUALITY_THRESHOLDS } from './constants'
import { daysBetween } from './helpers'
import type { DataQualityResult, FinancialHealthInput, HealthFactor } from './types'

export function calculateDataQuality(input: FinancialHealthInput): DataQualityResult {
  const transactions = input.transactions.filter((tx) => tx.type !== 'transfer' && !tx.transfer_peer_id)
  const transactionCount = transactions.length
  const sortedDates = transactions.map((tx) => tx.date).sort()
  const daysCovered = sortedDates.length > 0 ? daysBetween(sortedDates[0], sortedDates[sortedDates.length - 1]) : 0
  const incomeCount = transactions.filter((tx) => tx.type === 'income').length
  const categorized = transactions.filter((tx) => tx.category_id).length
  const categorizedTransactionPercentage = transactionCount > 0 ? Math.round((categorized / transactionCount) * 100) : 0
  const hasRecurring = input.recurringItems.some((item) => item.is_active)
  const hasBudget = input.budgets.length > 0
  const hasGoals = input.goals.some((goal) => !goal.archived)
  const reasons: string[] = []

  if (transactionCount < DATA_QUALITY_THRESHOLDS.minimumTransactions) reasons.push('Sono presenti pochi movimenti registrati.')
  if (daysCovered < DATA_QUALITY_THRESHOLDS.minimumDays) reasons.push('Il periodo coperto dai dati è ancora breve.')
  if (incomeCount === 0) reasons.push('Non risultano entrate registrate nel periodo analizzato.')
  if (categorizedTransactionPercentage < DATA_QUALITY_THRESHOLDS.categoryCompletenessGood && transactionCount > 0) {
    reasons.push('Una parte dei movimenti non è ancora categorizzata.')
  }

  let level: DataQualityResult['level'] = 'INSUFFICIENT'
  if (
    daysCovered >= DATA_QUALITY_THRESHOLDS.excellentDays &&
    transactionCount >= DATA_QUALITY_THRESHOLDS.excellentTransactions &&
    categorizedTransactionPercentage >= DATA_QUALITY_THRESHOLDS.categoryCompletenessExcellent &&
    hasRecurring
  ) {
    level = 'EXCELLENT'
  } else if (
    daysCovered >= DATA_QUALITY_THRESHOLDS.goodDays &&
    transactionCount >= DATA_QUALITY_THRESHOLDS.goodTransactions &&
    categorizedTransactionPercentage >= DATA_QUALITY_THRESHOLDS.categoryCompletenessGood
  ) {
    level = 'GOOD'
  } else if (daysCovered >= DATA_QUALITY_THRESHOLDS.limitedDays || transactionCount >= DATA_QUALITY_THRESHOLDS.minimumTransactions) {
    level = 'LIMITED'
  }

  const baseConfidence = level === 'EXCELLENT' ? 95 : level === 'GOOD' ? 80 : level === 'LIMITED' ? 55 : 30
  const confidencePercentage = Math.min(100, baseConfidence + (hasBudget ? 3 : 0) + (hasGoals ? 2 : 0))
  const isProvisional = level === 'INSUFFICIENT' || level === 'LIMITED' || input.period.isCurrentPeriod
  const factors: HealthFactor[] = []

  if (isProvisional) {
    factors.push({
      id: 'data-quality-provisional',
      component: 'dataQuality',
      impact: 'NEUTRAL',
      severity: level === 'INSUFFICIENT' ? 'WARNING' : 'INFO',
      title: 'Punteggio provvisorio',
      description: reasons[0] ?? 'Il mese corrente non è ancora chiuso: il punteggio può cambiare.',
      metricValue: transactionCount,
      metricUnit: 'movimenti',
    })
  } else {
    factors.push({
      id: 'data-quality-good',
      component: 'dataQuality',
      impact: 'POSITIVE',
      severity: 'INFO',
      title: 'Dati sufficienti',
      description: 'I dati disponibili coprono un periodo adeguato per una lettura stabile.',
      metricValue: daysCovered,
      metricUnit: 'giorni',
    })
  }

  return { level, isProvisional, confidencePercentage, daysCovered, transactionCount, categorizedTransactionPercentage, reasons, factors }
}
