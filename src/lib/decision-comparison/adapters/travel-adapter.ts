import { runTravelAffordabilityEngine } from '@/lib/affordability/travel/engine'
import type { TravelAffordabilityResult, TravelInput } from '@/lib/affordability/travel/types'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import { computeNetTotalCost, mapDataQualityToScore } from '../metrics'
import type { NormalizedScenario } from '../types'

export interface AdaptTravelScenarioParams {
  id: string
  name?: string
  input: TravelInput
  dbData: AffordabilityDbData
  now: Date
}

// Reuses the travel affordability engine directly (no calculation is
// duplicated here) and maps its result onto the common comparison metrics.
export function adaptTravelScenario(params: AdaptTravelScenarioParams): NormalizedScenario {
  const result = runTravelAffordabilityEngine(params.input, params.dbData, params.now)
  return buildNormalizedScenario(params.id, params.name ?? params.input.simulationName, result)
}

function buildNormalizedScenario(id: string, name: string, result: TravelAffordabilityResult): NormalizedScenario {
  const totalCashOutflow = result.totalCostEstimate
  // A trip is never financed and has no resale/residual value in this model —
  // these are genuine domain facts (true zero), not placeholders for unknown
  // data, so they are NOT flagged as missing.
  const estimatedResidualValue = 0
  const netTotalCost = computeNetTotalCost(totalCashOutflow, estimatedResidualValue)

  return {
    id,
    name,
    type: 'TRAVEL_PURCHASE',
    currency: result.currency,
    metrics: {
      initialCashOutflow: result.upfrontCost,
      totalCashOutflow,
      netTotalCost,
      averageMonthlyCost: result.effectiveMonthlyCost,
      recurringMonthlyCommitment: result.recurringMonthlyCost,
      residualLiquidity: result.liquidityAfter,
      minimumProjectedBalance: result.minimumProjectedLiquidity,
      emergencyFundMonthsAfterDecision: result.coverageMonthsAfter,
      monthlyMarginAfterDecision: result.monthlyMarginAfter,
      negativeMonthsCount: result.negativeMonths,
      criticalMonthsCount: result.criticalMonths.length,
      totalFinancingCost: 0,
      remainingDebtAtEnd: 0,
      estimatedResidualValue,
      affordabilityClassification: result.classification,
      dataQualityScore: mapDataQualityToScore(result.dataQuality),
      confidenceLevel: result.confidence,
    },
    missingMetrics: [],
  }
}
