import { runAffordabilityEngine } from '@/lib/affordability/engine'
import type { AffordabilityDbData, AffordabilityInput, AffordabilityResult } from '@/lib/affordability/types'
import { computeInstallmentFinancingCost, computeNetTotalCost, mapDataQualityToScore, safeNumber } from '../metrics'
import type { CriterionKey, NormalizedScenario } from '../types'

export interface AdaptGenericScenarioParams {
  id: string
  name?: string
  input: AffordabilityInput
  dbData: AffordabilityDbData
  now: Date
}

// Reuses the generic affordability engine directly (no calculation is
// duplicated here) and maps its result onto the common comparison metrics.
export function adaptGenericScenario(params: AdaptGenericScenarioParams): NormalizedScenario {
  const result = runAffordabilityEngine(params.input, params.dbData, params.now)
  return buildNormalizedScenario(params.id, params.name ?? params.input.purchaseName, params.input, result)
}

function buildNormalizedScenario(
  id: string,
  name: string,
  input: AffordabilityInput,
  result: AffordabilityResult,
): NormalizedScenario {
  const missingMetrics: CriterionKey[] = []

  const estimatedResidualValue = safeNumber(input.estimatedResaleValue)
  if (input.estimatedResaleValue == null) missingMetrics.push('estimatedResidualValue')

  const totalFinancingCost =
    input.paymentMode === 'INSTALLMENTS'
      ? computeInstallmentFinancingCost(result.totalInstallmentCost, result.purchaseCost)
      : 0

  // The generic engine models the installment plan but not any balance that
  // could remain unpaid past its projection horizon — genuinely unknown for
  // financed purchases, so it is flagged rather than assumed to be zero.
  const remainingDebtAtEnd = 0
  if (input.paymentMode === 'INSTALLMENTS') missingMetrics.push('remainingDebtAtEnd')

  const totalCashOutflow = result.totalCostEstimate
  const netTotalCost = computeNetTotalCost(totalCashOutflow, estimatedResidualValue)

  return {
    id,
    name,
    type: 'GENERIC_PURCHASE',
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
      totalFinancingCost,
      remainingDebtAtEnd,
      estimatedResidualValue,
      affordabilityClassification: result.classification,
      dataQualityScore: mapDataQualityToScore(result.dataQuality),
      confidenceLevel: result.confidence,
    },
    missingMetrics,
  }
}
