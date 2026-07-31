import { CRITERIA, CRITICAL_MONTH_PENALTY, MAX_LIQUIDITY_PENALTY } from './constants'
import { computeAllCriterionScores } from './normalization'
import type { CriterionWeights, NormalizedScenario, ScenarioScore } from './types'

// A scenario with poor data quality/confidence shouldn't be able to win purely
// because its (unverified) figures look good. The factor discounts the final
// score but never zeroes it out fully, since a low-confidence scenario is
// still informative for the comparison.
function computeConfidenceFactor(scenario: NormalizedScenario): number {
  const average = (scenario.metrics.dataQualityScore + scenario.metrics.confidenceLevel) / 2
  return 0.7 + 0.3 * (average / 100)
}

export function scoreScenarios(scenarios: NormalizedScenario[], weights: CriterionWeights): ScenarioScore[] {
  const scoresByScenarioId = computeAllCriterionScores(scenarios, CRITERIA)

  return scenarios.map((scenario) => {
    const criterionScores = scoresByScenarioId.get(scenario.id) ?? []
    const rawWeightedScore = criterionScores.reduce(
      (sum, cs) => sum + cs.normalizedScore * (weights[cs.criterion] ?? 0),
      0,
    )

    // Liquidity criticality takes priority over everything else, including a
    // favorable residual value: critical months apply a direct score penalty
    // rather than competing with other criteria only through weights.
    const liquidityPenalty = Math.min(
      MAX_LIQUIDITY_PENALTY,
      scenario.metrics.criticalMonthsCount * CRITICAL_MONTH_PENALTY,
    )

    const confidenceFactor = computeConfidenceFactor(scenario)
    const penalizedScore = Math.max(0, rawWeightedScore - liquidityPenalty)
    const finalScore = Math.max(0, Math.min(100, Math.round(penalizedScore * confidenceFactor * 100) / 100))

    return {
      scenarioId: scenario.id,
      criterionScores,
      rawWeightedScore: Math.round(rawWeightedScore * 100) / 100,
      liquidityPenalty,
      confidenceFactor: Math.round(confidenceFactor * 1000) / 1000,
      finalScore,
    }
  })
}
