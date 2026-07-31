import { DECISION_COMPARISON_ENGINE_VERSION, DISCLAIMER } from './constants'
import { determineCompatibility } from './compatibility'
import { getCriteria, resolveWeights } from './criteria'
import { scoreScenarios } from './scoring'
import { determineCriterionWinners, rankScenarios } from './ranking'
import { computeDominance, computeTradeoffs } from './tradeoffs'
import { buildExplanations } from './explanations'
import { validateDecisionComparisonInput } from './validation'
import type { DecisionComparisonInput, DecisionComparisonResult } from './types'

export function compareDecisions(input: DecisionComparisonInput, now: Date): DecisionComparisonResult {
  validateDecisionComparisonInput(input)

  // Structural clone: the comparison never mutates the caller's scenarios or
  // the original financial results they were derived from.
  const scenarios = input.scenarios.map((s) => ({
    ...s,
    metrics: { ...s.metrics },
    missingMetrics: [...s.missingMetrics],
  }))

  const compatibility = determineCompatibility(scenarios)
  const weightsUsed = resolveWeights(input.profile, input.customWeights)
  const criteria = getCriteria()

  const scores = scoreScenarios(scenarios, weightsUsed)
  const ranking = rankScenarios(scores, scenarios)
  const criterionWinners = determineCriterionWinners(scenarios, criteria)
  const dominance = computeDominance(scores)
  const tradeoffs = computeTradeoffs(scores, dominance)

  const explanations = buildExplanations({
    compatibility,
    ranking,
    criterionWinners,
    dominance,
    tradeoffs,
    scenarios,
  })

  return {
    engineVersion: DECISION_COMPARISON_ENGINE_VERSION,
    calculatedAt: now.toISOString(),
    compatibility,
    profile: input.profile,
    weightsUsed,
    scenarios,
    scores,
    ranking,
    criterionWinners,
    dominance,
    tradeoffs,
    explanations,
    disclaimer: DISCLAIMER,
  }
}
