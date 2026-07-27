import type { ScenarioProjectionResult, ScenarioReliability, ScenarioReliabilityLevel, FinancialScenario } from './types'
import { roundMoney } from './money'

// ── Reliability ───────────────────────────────────────────────────────────────

export function assessReliability(
  scenario: FinancialScenario,
  hasRecentTransactions: boolean,
  hasActiveRecurring: boolean,
  dataCompletenessScore: number,
): ScenarioReliability {
  const warnings: string[] = []
  const reasons: string[] = []

  if (scenario.horizon_months > 24) {
    warnings.push('Orizzonte superiore a 24 mesi: l\'incertezza aumenta significativamente.')
  }
  if (!hasRecentTransactions) {
    warnings.push('Nessuna transazione recente disponibile per calibrare le stime.')
  }
  if (!hasActiveRecurring) {
    warnings.push('Nessuna regola ricorrente attiva: le entrate/uscite periodiche non sono stimate.')
  }
  if (scenario.actions.length === 0) {
    reasons.push('Nessuna azione configurata — scenario equivalente alla baseline.')
  }

  let level: ScenarioReliabilityLevel
  if (warnings.length === 0 && scenario.horizon_months <= 12) {
    level = 'high'
    reasons.push('Orizzonte breve e dati recenti disponibili.')
  } else if (warnings.length <= 1 || scenario.horizon_months <= 24) {
    level = 'medium'
    reasons.push('Attendibilità media: alcuni dati di riferimento potrebbero essere incompleti.')
  } else {
    level = 'limited'
    reasons.push('Attendibilità limitata: dati insufficienti o orizzonte troppo lungo.')
  }

  return {
    level,
    reasons,
    warnings,
    dataCompleteness: Math.round(Math.max(0, Math.min(100, dataCompletenessScore))),
  }
}

// ── Text summary ──────────────────────────────────────────────────────────────

export function buildResultSummary(
  projection: ScenarioProjectionResult,
  reliability: ScenarioReliability,
): string {
  const delta = projection.totalDelta
  const absDelta = Math.abs(delta)
  const fmtEur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

  const lines: string[] = []

  if (delta > 0) {
    lines.push(`Lo scenario migliora il saldo finale di ${fmtEur(absDelta)}.`)
  } else if (delta < 0) {
    lines.push(`Lo scenario riduce il saldo finale di ${fmtEur(absDelta)}.`)
  } else {
    lines.push('Lo scenario non modifica il saldo finale rispetto alla baseline.')
  }

  if (projection.scenarioNegativeMonths > 0) {
    lines.push(`Attenzione: ${projection.scenarioNegativeMonths} ${projection.scenarioNegativeMonths === 1 ? 'mese' : 'mesi'} con saldo negativo.`)
  } else if (projection.baselineNegativeMonths > 0 && projection.scenarioNegativeMonths === 0) {
    lines.push('Lo scenario elimina i periodi con saldo negativo.')
  }

  if (reliability.level === 'limited') {
    lines.push('Attendibilità limitata: interpretare con cautela.')
  }

  return lines.join(' ')
}

// ── Data completeness heuristic ───────────────────────────────────────────────

export function computeDataCompleteness(
  hasRecentTransactions: boolean,
  hasActiveRecurring: boolean,
  hasLoanData: boolean,
  hasGoalData: boolean,
  horizonMonths: number,
): number {
  let score = 40 // base
  if (hasRecentTransactions) score += 25
  if (hasActiveRecurring) score += 20
  if (hasLoanData) score += 8
  if (hasGoalData) score += 7
  // Penalise long horizons
  score -= roundMoney(Math.max(0, (horizonMonths - 12) / 48) * 20)
  return score
}
