import type { CriterionDefinition, CriterionScore, NormalizedScenario } from './types'

function rawValueFor(scenario: NormalizedScenario, criterion: CriterionDefinition): number | null {
  if (scenario.missingMetrics.includes(criterion.key)) return null
  const value = scenario.metrics[criterion.key]
  return value === null ? null : value
}

// Min-max normalizes one criterion across the compared scenarios into a 0-100
// sub-score, respecting the criterion's preferred direction.
//
// Missing values never get an advantage: they score 0 regardless of direction
// (a missing "lower is better" cost does NOT default to the best score just
// because it reads as 0). A genuine tie (all present values equal) scores
// everyone 100, since none of them under- or out-performs another.
export function computeCriterionScores(
  scenarios: NormalizedScenario[],
  criterion: CriterionDefinition,
): CriterionScore[] {
  const rawValues = scenarios.map((s) => rawValueFor(s, criterion))
  const present = rawValues.filter((v): v is number => v !== null)

  if (present.length === 0) {
    return scenarios.map((s, i) => ({
      criterion: criterion.key,
      rawValue: rawValues[i],
      normalizedScore: 0,
      isMissing: true,
    }))
  }

  const min = Math.min(...present)
  const max = Math.max(...present)
  const range = max - min

  return scenarios.map((s, i) => {
    const rawValue = rawValues[i]
    if (rawValue === null) {
      return { criterion: criterion.key, rawValue: null, normalizedScore: 0, isMissing: true }
    }
    if (range === 0) {
      return { criterion: criterion.key, rawValue, normalizedScore: 100, isMissing: false }
    }
    const ratio = criterion.direction === 'higherIsBetter' ? (rawValue - min) / range : (max - rawValue) / range
    const normalizedScore = Math.round(ratio * 10000) / 100 // 2 decimals, deterministic
    return { criterion: criterion.key, rawValue, normalizedScore, isMissing: false }
  })
}

export function computeAllCriterionScores(
  scenarios: NormalizedScenario[],
  criteria: CriterionDefinition[],
): Map<string, CriterionScore[]> {
  const byScenarioId = new Map<string, CriterionScore[]>()
  for (const s of scenarios) byScenarioId.set(s.id, [])

  for (const criterion of criteria) {
    const scores = computeCriterionScores(scenarios, criterion)
    scores.forEach((score, i) => {
      byScenarioId.get(scenarios[i].id)!.push(score)
    })
  }

  return byScenarioId
}
