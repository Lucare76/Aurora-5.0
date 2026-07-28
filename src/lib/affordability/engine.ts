import type { AffordabilityInput, AffordabilityResult, AffordabilityDbData } from './types'
import {
  AFFORDABILITY_ENGINE_VERSION,
  CLASSIFICATION_LABELS,
  DEFAULT_MINIMUM_LIQUIDITY_MONTHS,
  DISCLAIMER,
  DISCLAIMER_VARIABILITY,
  FIXED_ASSUMPTIONS,
  SIMULATION_NOTE,
} from './constants'
import { buildAffordabilityBaseline } from './baseline'
import {
  computeCostBreakdown,
  computeLiquidityAfter,
  computeCoverageMonths,
  computeMonthlyMarginAfter,
  computeInstallmentToMarginRatio,
  computeTotalDebtToMarginRatio,
  buildProjection,
  computeMaxAffordablePrice,
} from './metrics'
import { classify, classificationLabel, buildSummary, computeSustainabilityScore } from './classification'
import { buildReasons, buildRisks } from './explanations'
import { buildAlternatives } from './alternatives'
import { formatDateISO, currentMonthStart } from '@/lib/scenarios/dates'

export function runAffordabilityEngine(
  input: AffordabilityInput,
  dbData: AffordabilityDbData,
  now: Date,
): AffordabilityResult {
  const calculatedAt = now.toISOString()
  const currency = input.currency ?? 'EUR'

  // 1. Build baseline
  const includeGoals = input.includeGoalContributions ?? true
  const baseline = buildAffordabilityBaseline(dbData, includeGoals, now)

  // 2. Compute cost breakdown
  const costs = computeCostBreakdown(input)

  // 3. Compute core metrics
  const liquidityAfter = computeLiquidityAfter(baseline, costs.upfrontCost)
  const coverageMonthsBefore = computeCoverageMonths(baseline.totalLiquidity, baseline.monthlyExpenses)
  const coverageMonthsAfter = computeCoverageMonths(liquidityAfter, baseline.monthlyExpenses)
  const marginAfter = computeMonthlyMarginAfter(baseline, costs.effectiveMonthlyCost)
  const installmentToMarginRatio = input.paymentMode === 'INSTALLMENTS'
    ? computeInstallmentToMarginRatio(costs.monthlyInstallment, baseline.monthlyMargin)
    : null
  const totalDebtToMarginRatio = computeTotalDebtToMarginRatio(
    baseline.existingMonthlyDebtBurden,
    costs.monthlyInstallment,
    costs.recurringMonthlyCost,
    baseline.monthlyMargin,
  )

  // 4. Build projection
  const startDate = currentMonthStart(now)
  const projection = buildProjection(baseline, input, costs, startDate)

  // 5. Classify
  const classParams = {
    baseline,
    input,
    costs,
    liquidityAfter,
    coverageMonthsAfter,
    marginAfter,
    installmentToMarginRatio,
    projection,
  }
  const classification = classify(classParams)
  const label = classificationLabel(classification)
  const summary = buildSummary(classification, classParams)
  const sustainabilityScore = classification !== 'INSUFFICIENT_DATA'
    ? computeSustainabilityScore(classParams)
    : null

  // 6. Build reasons, risks, alternatives
  const reasons = buildReasons(
    baseline, input, costs, liquidityAfter, coverageMonthsAfter, marginAfter, installmentToMarginRatio, projection,
  )
  const risks = buildRisks(baseline, input, costs, liquidityAfter, projection)
  const alternatives = buildAlternatives(baseline, input, costs, liquidityAfter, marginAfter)

  // 7. Max affordable price
  const minMonths = input.minimumLiquidityMonths ?? DEFAULT_MINIMUM_LIQUIDITY_MONTHS
  const { price: maxAffordablePrice, note: maxAffordablePriceNote } =
    computeMaxAffordablePrice(baseline, input, minMonths)

  // 8. Missing data & assumptions
  const missingData: string[] = [...baseline.warnings]
  if (baseline.monthlyIncome === 0) missingData.push('Nessuna entrata mensile rilevata.')
  if (baseline.monthlyExpenses === 0) missingData.push('Nessuna uscita mensile rilevata.')

  const assumptions: string[] = [...FIXED_ASSUMPTIONS]
  if (!includeGoals) assumptions.push('Le contribuzioni agli obiettivi di risparmio sono escluse dal calcolo.')

  // 9. Confidence based on data quality
  const confidence = baseline.dataQualityScore

  return {
    classification,
    classificationLabel: label,
    sustainabilityScore,
    summary,
    currency,

    purchaseCost: input.totalPrice,
    upfrontCost: costs.upfrontCost,
    monthlyInstallment: costs.monthlyInstallment,
    balloonPayment: costs.balloonPayment,
    totalInstallmentCost: costs.totalInstallmentCost,
    recurringMonthlyCost: costs.recurringMonthlyCost,
    effectiveMonthlyCost: costs.effectiveMonthlyCost,
    totalCostEstimate: costs.totalCostEstimate,

    liquidityBefore: baseline.totalLiquidity,
    liquidityAfter,
    minimumProjectedLiquidity: projection.minimumLiquidity,
    minimumLiquidityDate: projection.minimumLiquidityDate,
    coverageMonthsBefore,
    coverageMonthsAfter,

    monthlyMarginBefore: baseline.monthlyMargin,
    monthlyMarginAfter: marginAfter,
    installmentToMarginRatio,
    totalDebtToMarginRatio,

    negativeMonths: projection.negativeMonths,
    criticalMonths: projection.criticalMonths,

    maxAffordablePrice,
    maxAffordablePriceNote,

    dataQuality: baseline.dataQuality,
    confidence,

    reasons,
    risks,
    alternatives,

    projections: projection.points,
    comparison: null, // future enhancement

    assumptions,
    missingData,
    disclaimer: `${DISCLAIMER} ${DISCLAIMER_VARIABILITY}`,
    calculatedAt,
    engineVersion: AFFORDABILITY_ENGINE_VERSION,
  }
}
