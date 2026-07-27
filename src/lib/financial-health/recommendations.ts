import { SCORE_THRESHOLDS } from './constants'
import type { FinancialHealthMetrics, HealthFactor, HealthRecommendation } from './types'

export function buildRecommendations(params: {
  metrics: FinancialHealthMetrics
  factors: HealthFactor[]
  dataIsInsufficient: boolean
}): HealthRecommendation[] {
  if (params.dataIsInsufficient) {
    return [{
      id: 'classify-first-data',
      priority: 'MEDIUM',
      title: 'Completa i dati di base',
      description: 'Registra qualche movimento e assegna le categorie principali per rendere il punteggio più affidabile.',
      actionUrl: '/transactions',
      sourceType: 'dataQuality',
      sourceId: null,
      reasonCode: 'INSUFFICIENT_DATA',
    }]
  }

  const items: HealthRecommendation[] = []
  const add = (item: HealthRecommendation) => {
    if (!items.some((existing) => existing.reasonCode === item.reasonCode)) items.push(item)
  }

  if (params.metrics.exceededBudgets > 0) {
    add({ id: 'review-exceeded-budgets', priority: 'HIGH', title: 'Controlla i budget superati', description: `${params.metrics.exceededBudgets} budget hanno superato il limite nel periodo.`, actionUrl: '/budgets', sourceType: 'budget', sourceId: null, reasonCode: 'BUDGET_EXCEEDED' })
  }
  if (params.metrics.projectedLiquidity30d < 0) {
    add({ id: 'review-negative-forecast', priority: 'HIGH', title: 'Verifica il saldo previsto', description: 'La proiezione a 30 giorni indica un saldo aggregato negativo.', actionUrl: '/calendar?view=agenda&range=30', sourceType: 'calendar', sourceId: null, reasonCode: 'NEGATIVE_PROJECTED_BALANCE' })
  }
  if ((params.metrics.paymentToIncomeRatio ?? 0) > SCORE_THRESHOLDS.debtModerateRatio) {
    add({ id: 'review-debt-payments', priority: 'MEDIUM', title: 'Verifica il peso delle rate', description: 'Le rate assorbono una quota elevata delle entrate registrate.', actionUrl: '/loans', sourceType: 'loan', sourceId: null, reasonCode: 'DEBT_RATIO_ELEVATED' })
  }
  if (params.metrics.behindGoals > 0) {
    add({ id: 'review-goals-behind', priority: 'MEDIUM', title: 'Controlla gli obiettivi in ritardo', description: 'Alcuni obiettivi sono sotto la traiettoria attesa.', actionUrl: '/goals', sourceType: 'savings_goal', sourceId: null, reasonCode: 'GOALS_BEHIND' })
  }
  if (params.metrics.activeCriticalAlerts > 0) {
    add({ id: 'review-critical-alerts', priority: 'HIGH', title: 'Apri gli avvisi critici', description: 'Sono presenti avvisi critici attivi da verificare.', actionUrl: '/notifications?severity=CRITICAL', sourceType: 'notification', sourceId: null, reasonCode: 'CRITICAL_ALERTS' })
  }

  return items
    .sort((a, b) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[a.priority] - { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.priority]))
    .slice(0, SCORE_THRESHOLDS.maxRecommendations)
}
