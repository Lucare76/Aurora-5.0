import { CLASSIFICATION_RANK, NEGLIGIBLE_DIFFERENCE_RATIO, SCORE_TIE_EPSILON } from './constants'
import type {
  CriterionDefinition,
  CriterionWinner,
  NormalizedScenario,
  RankedScenario,
  ScenarioScore,
} from './types'

// Deterministic ordering: score descending, ties broken by the more
// sustainable affordability classification, then by scenario id.
export function rankScenarios(scores: ScenarioScore[], scenarios: NormalizedScenario[]): RankedScenario[] {
  const scenarioById = new Map(scenarios.map((s) => [s.id, s]))

  const sorted = [...scores].sort((a, b) => {
    const diff = b.finalScore - a.finalScore
    if (Math.abs(diff) > SCORE_TIE_EPSILON) return diff

    const classA = CLASSIFICATION_RANK[scenarioById.get(a.scenarioId)!.metrics.affordabilityClassification]
    const classB = CLASSIFICATION_RANK[scenarioById.get(b.scenarioId)!.metrics.affordabilityClassification]
    if (classA !== classB) return classA - classB

    return a.scenarioId.localeCompare(b.scenarioId)
  })

  const result: RankedScenario[] = []
  let rank = 1

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    if (i > 0 && Math.abs(current.finalScore - sorted[i - 1].finalScore) > SCORE_TIE_EPSILON) {
      rank = i + 1
    }

    const tiedWithScenarioIds = sorted
      .filter(
        (other) =>
          other.scenarioId !== current.scenarioId &&
          Math.abs(other.finalScore - current.finalScore) <= SCORE_TIE_EPSILON,
      )
      .map((other) => other.scenarioId)

    result.push({
      scenarioId: current.scenarioId,
      rank,
      finalScore: current.finalScore,
      isTie: tiedWithScenarioIds.length > 0,
      tiedWithScenarioIds,
    })
  }

  return result
}

// For each criterion, which scenario has the best raw value — with ties and
// "not worth mentioning" differences (within NEGLIGIBLE_DIFFERENCE_RATIO of
// the observed range) both surfaced explicitly rather than picking an
// arbitrary winner.
export function determineCriterionWinners(
  scenarios: NormalizedScenario[],
  criteria: CriterionDefinition[],
): CriterionWinner[] {
  return criteria.map((criterion) => {
    const values = scenarios.map((s) => ({
      scenarioId: s.id,
      value: s.missingMetrics.includes(criterion.key) ? null : (s.metrics[criterion.key] as number | null),
    }))

    const present = values.filter((v): v is { scenarioId: string; value: number } => v.value !== null)

    if (present.length === 0) {
      return { criterion: criterion.key, winnerScenarioId: null, isTie: false, isNegligibleDifference: false, values }
    }

    const sorted = [...present].sort((a, b) =>
      criterion.direction === 'higherIsBetter' ? b.value - a.value : a.value - b.value,
    )
    const best = sorted[0]

    if (present.length === 1) {
      return {
        criterion: criterion.key,
        winnerScenarioId: best.scenarioId,
        isTie: false,
        isNegligibleDifference: false,
        values,
      }
    }

    const runnerUp = sorted[1]
    const gap = Math.abs(best.value - runnerUp.value)
    const range = Math.max(...present.map((p) => p.value)) - Math.min(...present.map((p) => p.value))
    const isNegligibleDifference = range > 0 && gap / range < NEGLIGIBLE_DIFFERENCE_RATIO
    const isTie = gap === 0 || isNegligibleDifference

    return {
      criterion: criterion.key,
      winnerScenarioId: isTie ? null : best.scenarioId,
      isTie,
      isNegligibleDifference,
      values,
    }
  })
}
