import type { AffordabilityDbData, AffordabilityInput } from '../types'
import { runAffordabilityEngine } from '../engine'
import { buildAffordabilityBaseline } from '../baseline'
import { DEFAULT_CAR_HORIZON_MONTHS } from './constants'
import { computeCarCosts } from './costs'
import { buildCarReasons, buildCarRisks, buildCarAlternatives } from './explanations'
import { buildPaymentComparison, buildCarComparison } from './comparison'
import type { CarInput, CarAffordabilityResult, CarMetrics } from './types'
import { roundMoney, sumMoney } from '@/lib/scenarios/money'

// ── Adapter: CarInput → AffordabilityInput ────────────────────────────────────

function toAffordabilityInput(input: CarInput, costs: ReturnType<typeof computeCarCosts>): AffordabilityInput {
  return {
    purchaseName: input.carName,
    totalPrice: costs.effectivePurchasePrice,
    paymentMode: input.paymentMode === 'FINANCING' ? 'INSTALLMENTS' : 'IMMEDIATE',
    purchaseDate: input.purchaseDate,
    currency: input.currency,

    accountId: input.accountId,
    debitAccountId: input.debitAccountId,

    downPayment: input.paymentMode === 'FINANCING' ? (input.downPayment ?? 0) : null,
    installmentAmount: input.paymentMode === 'FINANCING' ? costs.monthlyInstallment : null,
    numberOfInstallments: input.paymentMode === 'FINANCING' ? costs.numberOfInstallments : null,
    firstInstallmentDate: input.firstInstallmentDate,
    balloonPayment: input.paymentMode === 'FINANCING' ? costs.balloonPayment : null,

    // Pass running costs + initial costs as recurring / upfront
    additionalUpfrontCosts: costs.initialCostsSum + (input.paymentMode === 'FINANCING' ? costs.financingFees : 0),
    monthlyRecurringCost: costs.totalMonthlyRunningCost,
    annualRecurringCost: null,
    estimatedResaleValue: costs.residualValue,

    recurringDurationMonths: costs.ownershipPeriodMonths,

    minimumLiquidityMonths: input.minimumLiquidityMonths,
    maxInstallmentToMarginRatio: input.maxInstallmentToMarginRatio,
    horizonMonths: input.horizonMonths ?? DEFAULT_CAR_HORIZON_MONTHS,
    includeGoalContributions: input.includeGoalContributions,
  }
}

// ── CarMetrics builder ─────────────────────────────────────────────────────────

function buildCarMetrics(input: CarInput, costs: ReturnType<typeof computeCarCosts>): CarMetrics {
  const n = (v: number | null | undefined) => v ?? 0
  const a = input.additional
  const parkingAnnual = a
    ? roundMoney((n(a.parkingMonthly) + n(a.garageMonthly)) * 12)
    : 0

  return {
    carPurchasePrice: input.purchasePrice,
    effectivePurchasePrice: costs.effectivePurchasePrice,
    totalReductions: costs.totalReductions,
    tradeInValue: n(input.tradeInValue),
    incentives: roundMoney(sumMoney([n(input.incentive), n(input.subsidy)])),
    upfrontCarCost: costs.upfrontCarCost,
    financedAmount: costs.financedAmount,
    financingTotalCost: costs.financingTotalCost,

    insuranceAnnualCost: costs.insuranceAnnualCost,
    taxAnnualCost: costs.taxAnnualCost,
    energyAnnualCost: costs.energyAnnualCost,
    maintenanceAnnualCost: costs.maintenanceAnnualCost,
    parkingAnnualCost: parkingAnnual,
    additionalAnnualCost: costs.additionalAnnualCost,
    totalAnnualRunningCost: costs.totalAnnualRunningCost,

    insuranceMonthlyCost: costs.insuranceMonthlyCost,
    taxMonthlyCost: costs.taxMonthlyCost,
    energyMonthlyCost: costs.energyMonthlyCost,
    maintenanceMonthlyCost: costs.maintenanceMonthlyCost,
    additionalMonthlyCost: costs.additionalMonthlyCost,
    totalMonthlyRunningCost: costs.totalMonthlyRunningCost,

    averageMonthlyOwnershipCost: costs.averageMonthlyOwnershipCost,
    totalOwnershipCost: costs.totalOwnershipCost,
    netOwnershipCost: costs.netOwnershipCost,

    currentCarMonthlyCost: costs.currentCarMonthlyCost,
    incrementalMonthlyCost: costs.incrementalMonthlyCost,

    costPerKilometer: costs.costPerKilometer,
    residualValue: costs.residualValue,
    ownershipPeriodMonths: costs.ownershipPeriodMonths,

    missingCosts: costs.missingCosts,
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export function runCarAffordabilityEngine(
  input: CarInput,
  dbData: AffordabilityDbData,
  now: Date,
): CarAffordabilityResult {
  const costs = computeCarCosts(input)
  const affordabilityInput = toAffordabilityInput(input, costs)

  // Run the generic engine (handles baseline, projection, classification, etc.)
  const base = runAffordabilityEngine(affordabilityInput, dbData, now)

  // Build the baseline for car-specific metrics that need it
  const includeGoals = input.includeGoalContributions ?? true
  const baseline = buildAffordabilityBaseline(dbData, includeGoals, now)

  const carMetrics = buildCarMetrics(input, costs)

  // Override reasons/risks/alternatives with car-specific ones
  const carReasons = buildCarReasons(
    input,
    costs,
    baseline.monthlyMargin,
    baseline.totalLiquidity,
    base.negativeMonths,
    base.liquidityAfter,
  )
  const carRisks = buildCarRisks(
    input,
    costs,
    baseline.monthlyMargin,
    base.liquidityAfter,
    base.negativeMonths,
  )
  const carAlternatives = buildCarAlternatives(
    input,
    costs,
    baseline.monthlyMargin,
    base.liquidityAfter,
  )

  // Merge car-specific reasons into the generic ones
  const reasons = [...base.reasons, ...carReasons]
  const risks = [...base.risks, ...carRisks]
  const alternatives = [...base.alternatives, ...carAlternatives]

  // Payment comparison (IMMEDIATE vs FINANCING)
  const horizonMonths = input.horizonMonths ?? DEFAULT_CAR_HORIZON_MONTHS
  const paymentComparison =
    input.paymentMode === 'FINANCING'
      ? buildPaymentComparison(input, baseline.totalLiquidity, baseline.monthlyMargin, horizonMonths)
      : null

  // Car A vs Car B comparison
  const carComparison = input.compareWithCar
    ? buildCarComparison(input, baseline.totalLiquidity, baseline.monthlyMargin, horizonMonths)
    : null

  // Augment missingData with car-specific missing costs
  const missingData = [...base.missingData]
  if (costs.missingCosts.length > 0) {
    missingData.push(`Costi non indicati: ${costs.missingCosts.join(', ')}.`)
  }

  return {
    ...base,
    reasons,
    risks,
    alternatives,
    missingData,
    carMetrics,
    paymentComparison,
    carComparison,
  }
}
