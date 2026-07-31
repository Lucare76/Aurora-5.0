import { runCarAffordabilityEngine } from '@/lib/affordability/car/engine'
import type { CarAffordabilityResult, CarInput } from '@/lib/affordability/car/types'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import { computeNetTotalCost, mapDataQualityToScore } from '../metrics'
import type { CriterionKey, NormalizedScenario } from '../types'

export interface AdaptCarScenarioParams {
  id: string
  name?: string
  input: CarInput
  dbData: AffordabilityDbData
  now: Date
}

// Reuses the car affordability engine directly (no calculation is duplicated
// here) and maps its result onto the common comparison metrics.
export function adaptCarScenario(params: AdaptCarScenarioParams): NormalizedScenario {
  const result = runCarAffordabilityEngine(params.input, params.dbData, params.now)
  return buildNormalizedScenario(params.id, params.name ?? params.input.carName, params.input, result)
}

function buildNormalizedScenario(
  id: string,
  name: string,
  input: CarInput,
  result: CarAffordabilityResult,
): NormalizedScenario {
  const missingMetrics: CriterionKey[] = []

  // The car engine assumes the financing plan completes within the modeled
  // ownership horizon — it exposes no figure for debt that could still be
  // outstanding after that point, so this is flagged rather than assumed zero.
  const remainingDebtAtEnd = 0
  if (input.paymentMode === 'FINANCING') missingMetrics.push('remainingDebtAtEnd')

  const totalCashOutflow = result.totalCostEstimate
  const estimatedResidualValue = result.carMetrics.residualValue
  const netTotalCost = computeNetTotalCost(totalCashOutflow, estimatedResidualValue)

  return {
    id,
    name,
    type: 'CAR_PURCHASE',
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
      totalFinancingCost: result.carMetrics.financingTotalCost,
      remainingDebtAtEnd,
      estimatedResidualValue,
      affordabilityClassification: result.classification,
      dataQualityScore: mapDataQualityToScore(result.dataQuality),
      confidenceLevel: result.confidence,
    },
    missingMetrics,
  }
}
