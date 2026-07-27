import { SCORE_LEVELS } from './constants'
import { clamp, roundMoney } from './helpers'
import type { ComponentScore, HealthComponentKey, ScoreLevel, WeightedScoreResult } from './types'

export function calculateWeightedHealthScore(
  components: Record<HealthComponentKey, ComponentScore>,
): WeightedScoreResult {
  let weighted = 0
  let observedWeight = 0
  let missingWeight = 0

  for (const component of Object.values(components)) {
    if (component.availability === 'AVAILABLE' && component.score !== null) {
      weighted += component.score * component.weight
      observedWeight += component.weight
    } else {
      missingWeight += component.weight
    }
  }

  const totalScore = observedWeight > 0 ? Math.round(clamp(weighted / observedWeight)) : null
  return {
    totalScore,
    observedWeight: roundMoney(observedWeight),
    missingWeight: roundMoney(missingWeight),
    completenessPercentage: Math.round(clamp((observedWeight / Math.max(observedWeight + missingWeight, 1)) * 100)),
    componentScores: components,
  }
}

export function scoreLevel(score: number | null): { level: ScoreLevel | 'UNAVAILABLE'; label: string; summary: string } {
  if (score == null) return { level: 'UNAVAILABLE', label: 'Non disponibile', summary: 'Servono più dati per calcolare la salute finanziaria.' }
  const match = SCORE_LEVELS.find((item) => score >= item.min && score <= item.max) ?? SCORE_LEVELS[0]
  const summary = match.level === 'CRITICAL'
    ? 'Alcuni indicatori richiedono attenzione.'
    : match.level === 'NEEDS_ATTENTION'
      ? 'La situazione è leggibile, con margini da rafforzare.'
      : match.level === 'FAIR'
        ? 'Gli indicatori principali sono discreti.'
        : match.level === 'GOOD'
          ? 'Gli indicatori principali sono positivi.'
          : 'Gli indicatori disponibili sono molto solidi.'
  return { level: match.level, label: match.label, summary }
}

export function contributions(components: Record<HealthComponentKey, ComponentScore>): Record<HealthComponentKey, number> {
  return Object.fromEntries(
    Object.entries(components).map(([key, component]) => [key, roundMoney(component.contribution)]),
  ) as Record<HealthComponentKey, number>
}
