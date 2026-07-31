import { runHomeAffordabilityEngine } from '@/lib/affordability/home/engine'
import type { HomeAffordabilityResult, HomeInput } from '@/lib/affordability/home/types'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import { computeNetTotalCost, mapDataQualityToScore } from '../metrics'
import type { NormalizedScenario } from '../types'

export interface AdaptHomeScenarioParams {
  id: string
  name?: string
  input: HomeInput
  dbData: AffordabilityDbData
  now: Date
}

// Reuses the home affordability engine directly (no calculation is
// duplicated here) and maps its result onto the common comparison metrics.
export function adaptHomeScenario(params: AdaptHomeScenarioParams): NormalizedScenario {
  const result = runHomeAffordabilityEngine(params.input, params.dbData, params.now)
  return buildNormalizedScenario(params.id, params.name ?? params.input.simulationName, result)
}

function buildNormalizedScenario(id: string, name: string, result: HomeAffordabilityResult): NormalizedScenario {
  const totalCashOutflow = result.totalCostEstimate
  const estimatedResidualValue = result.homeMetrics.residualPropertyValue
  const netTotalCost = computeNetTotalCost(totalCashOutflow, estimatedResidualValue)

  // The home engine explicitly tracks the outstanding mortgage balance over
  // the ownership horizon, so no metric is a placeholder here.
  return {
    id,
    name,
    type: 'HOME_PURCHASE',
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
      totalFinancingCost: result.homeMetrics.mortgageAdditionalCost,
      remainingDebtAtEnd: result.homeMetrics.residualMortgageDebt,
      estimatedResidualValue,
      affordabilityClassification: result.classification,
      dataQualityScore: mapDataQualityToScore(result.dataQuality),
      confidenceLevel: result.confidence,
    },
    missingMetrics: [],
  }
}
