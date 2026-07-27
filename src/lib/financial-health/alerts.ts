import { SCORE_THRESHOLDS } from './constants'
import { roundMoney, roundScore } from './helpers'
import type { ComponentScore, HealthNotification } from './types'

const OVERLAPPING_TYPES = new Set(['budget_threshold', 'negative_projected_balance', 'overdue_loan_payment', 'goal_behind_schedule'])

export type AlertHealthSummary = {
  activeAlerts: number
  activeCriticalAlerts: number
  activeWarningAlerts: number
  activeInfoAlerts: number
  relevantAlerts: number
}

export function summarizeAlerts(notifications: HealthNotification[]): AlertHealthSummary {
  const active = notifications.filter((item) => !item.archived_at && !item.resolved_at)
  const relevant = active.filter((item) => !OVERLAPPING_TYPES.has(item.type))
  return {
    activeAlerts: active.length,
    activeCriticalAlerts: active.filter((item) => item.severity === 'CRITICAL').length,
    activeWarningAlerts: active.filter((item) => item.severity === 'WARNING').length,
    activeInfoAlerts: active.filter((item) => item.severity === 'INFO').length,
    relevantAlerts: relevant.length,
  }
}

export function calculateAlertsScore(summary: AlertHealthSummary, weight: number): ComponentScore {
  const penalty = Math.min(SCORE_THRESHOLDS.maxAlertPenalty, summary.activeCriticalAlerts * 18 + summary.activeWarningAlerts * 6)
  const finalScore = roundScore(100 - penalty)
  return {
    component: 'alerts',
    score: finalScore,
    weight,
    contribution: roundMoney((finalScore / 100) * weight),
    availability: 'AVAILABLE',
    status: finalScore >= 75 ? 'good' : finalScore >= 50 ? 'watch' : 'risk',
    factors: summary.activeCriticalAlerts > 0
      ? [{ id: 'alerts-critical', component: 'alerts', impact: 'NEGATIVE', severity: 'WARNING', title: 'Avvisi critici attivi', description: 'Sono presenti avvisi critici attivi. La penalizzazione è limitata per evitare doppio conteggio.', metricValue: summary.activeCriticalAlerts, metricUnit: 'avvisi' }]
      : [{ id: 'alerts-ok', component: 'alerts', impact: 'POSITIVE', severity: 'INFO', title: 'Nessun avviso critico attivo', description: 'Non risultano avvisi critici attivi nei dati caricati.' }],
  }
}
