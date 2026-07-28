import { roundMoney } from '@/lib/scenarios/money'
import type {
  CarInput,
  CarComparisonInput,
  CarComparisonResult,
  CarComparisonSide,
  CarPaymentComparison,
  CarPaymentMode,
} from './types'
import type { AffordabilityClassification } from '../types'
import { computeCarCosts } from './costs'
import { CLASSIFICATION_LABELS } from '../constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifySimple(
  liquidityAfter: number,
  negativeMonths: number,
  installmentToMarginRatio: number | null,
  baselineMargin: number,
): AffordabilityClassification {
  if (liquidityAfter < 0) return 'NOT_AFFORDABLE'
  if (negativeMonths >= 6) return 'NOT_AFFORDABLE'
  if (negativeMonths >= 3) return 'RISKY'
  if (installmentToMarginRatio != null && installmentToMarginRatio > 0.7) return 'RISKY'
  if (installmentToMarginRatio != null && installmentToMarginRatio > 0.5) return 'CAUTION'
  if (negativeMonths >= 1) return 'CAUTION'
  if (liquidityAfter > 0 && baselineMargin > 0) return 'AFFORDABLE'
  return 'CAUTION'
}

function projectNegativeMonths(
  liquidityAfter: number,
  monthlyMarginAfter: number,
  horizonMonths: number,
): number {
  if (monthlyMarginAfter >= 0) return liquidityAfter < 0 ? horizonMonths : 0
  let liq = liquidityAfter
  let count = 0
  for (let i = 0; i < horizonMonths; i++) {
    liq += monthlyMarginAfter
    if (liq < 0) count++
  }
  return count
}

// ── Payment mode comparison (IMMEDIATE vs FINANCING) ─────────────────────────

export function buildPaymentComparison(
  input: CarInput,
  totalLiquidity: number,
  monthlyMargin: number,
  horizonMonths: number,
): CarPaymentComparison[] {
  const costs = computeCarCosts(input)

  const modes: CarPaymentMode[] = ['IMMEDIATE', 'FINANCING']
  const results: CarPaymentComparison[] = []

  for (const mode of modes) {
    let upfrontCost: number
    let monthlyInstallment: number
    let financingTotalCost: number
    let totalOwnershipCost: number

    if (mode === 'IMMEDIATE') {
      upfrontCost = roundMoney(costs.effectivePurchasePrice + costs.initialCostsSum)
      monthlyInstallment = 0
      financingTotalCost = 0
      totalOwnershipCost = roundMoney(
        upfrontCost + costs.totalAnnualRunningCost * input.ownershipYears - costs.residualValue
      )
    } else {
      // Use the actual financing data from input
      upfrontCost = costs.upfrontCarCost
      monthlyInstallment = costs.monthlyInstallment
      financingTotalCost = costs.financingTotalCost
      totalOwnershipCost = costs.netOwnershipCost
    }

    const liquidityAfter = roundMoney(totalLiquidity - upfrontCost)
    const monthlyMarginAfter = roundMoney(monthlyMargin - monthlyInstallment - costs.totalMonthlyRunningCost)
    const negativeMonths = projectNegativeMonths(liquidityAfter, monthlyMarginAfter, horizonMonths)
    const installmentRatio = monthlyMargin > 0 ? monthlyInstallment / monthlyMargin : null
    const classification = classifySimple(liquidityAfter, negativeMonths, installmentRatio, monthlyMargin)

    results.push({
      label: mode === 'IMMEDIATE' ? 'Pagamento immediato' : 'Finanziamento',
      mode,
      upfrontCost,
      monthlyInstallment,
      financingTotalCost,
      totalOwnershipCost,
      liquidityAfter,
      negativeMonths,
      classification,
      classificationLabel: CLASSIFICATION_LABELS[classification],
    })
  }

  return results
}

// ── Car A vs Car B comparison ──────────────────────────────────────────────────

function computeSide(
  label: string,
  carInput: CarInput,
  totalLiquidity: number,
  monthlyMargin: number,
  horizonMonths: number,
): CarComparisonSide {
  const costs = computeCarCosts(carInput)
  const liquidityAfter = roundMoney(totalLiquidity - costs.upfrontCarCost)
  const monthlyMarginAfter = roundMoney(
    monthlyMargin - costs.monthlyInstallment - costs.totalMonthlyRunningCost
  )
  const negativeMonths = projectNegativeMonths(liquidityAfter, monthlyMarginAfter, horizonMonths)
  const installmentRatio =
    monthlyMargin > 0 && costs.monthlyInstallment > 0
      ? costs.monthlyInstallment / monthlyMargin
      : null
  const classification = classifySimple(liquidityAfter, negativeMonths, installmentRatio, monthlyMargin)

  return {
    label,
    effectivePrice: costs.effectivePurchasePrice,
    upfrontCost: costs.upfrontCarCost,
    monthlyInstallment: costs.monthlyInstallment,
    totalMonthlyRunningCost: costs.totalMonthlyRunningCost,
    averageMonthlyOwnershipCost: costs.averageMonthlyOwnershipCost,
    totalOwnershipCost: costs.totalOwnershipCost,
    netOwnershipCost: costs.netOwnershipCost,
    residualValue: costs.residualValue,
    liquidityAfter,
    negativeMonths,
    classification,
    classificationLabel: CLASSIFICATION_LABELS[classification],
  }
}

function winner(a: number, b: number, lowerBetter = true): 'A' | 'B' | 'equal' {
  if (Math.abs(a - b) < 0.01) return 'equal'
  return (lowerBetter ? a < b : a > b) ? 'A' : 'B'
}

export function buildCarComparison(
  input: CarInput,
  totalLiquidity: number,
  monthlyMargin: number,
  horizonMonths: number,
): CarComparisonResult | null {
  if (!input.compareWithCar) return null

  const carBInput = buildCarBInput(input, input.compareWithCar)
  const carA = computeSide(input.carName, input, totalLiquidity, monthlyMargin, horizonMonths)
  const carB = computeSide(input.compareWithCar.carName, carBInput, totalLiquidity, monthlyMargin, horizonMonths)

  return {
    carA,
    carB,
    winner: {
      cheapestTotal: winner(carA.netOwnershipCost, carB.netOwnershipCost),
      lowestUpfront: winner(carA.upfrontCost, carB.upfrontCost),
      lowestMonthly: winner(carA.averageMonthlyOwnershipCost, carB.averageMonthlyOwnershipCost),
      mostSustainable: winner(carA.negativeMonths, carB.negativeMonths),
    },
  }
}

// ── Build a full CarInput from the simplified CarComparisonInput ───────────────

function buildCarBInput(baseInput: CarInput, comp: NonNullable<CarInput['compareWithCar']>): CarInput {
  return {
    carName: comp.carName,
    purchasePrice: comp.purchasePrice,
    paymentMode: comp.paymentMode,
    purchaseDate: baseInput.purchaseDate,
    currency: baseInput.currency,
    ownershipYears: baseInput.ownershipYears,
    annualKm: baseInput.annualKm,

    discount: comp.discount,
    tradeInValue: comp.tradeInValue,
    downPayment: comp.downPayment,
    installmentAmount: comp.installmentAmount,
    numberOfInstallments: comp.numberOfInstallments,
    balloonPayment: comp.balloonPayment,

    insurance: comp.insuranceAnnualCost != null ? { rcAnnual: comp.insuranceAnnualCost } : null,
    tax: comp.bolloAnnualCost != null ? { bolloAnnual: comp.bolloAnnualCost } : null,
    fuel: comp.fuelMonthlyCost != null ? { mode: 'monthly_estimate', monthlyEstimate: comp.fuelMonthlyCost } : null,
    maintenance: comp.maintenanceAnnualCost != null ? { ordinaryAnnual: comp.maintenanceAnnualCost } : null,
    additional: comp.parkingMonthly != null ? { parkingMonthly: comp.parkingMonthly } : null,

    initialCosts: comp.otherInitialCosts != null ? { other: comp.otherInitialCosts } : null,
    estimatedResidualValue: comp.estimatedResidualValue,

    minimumLiquidityMonths: baseInput.minimumLiquidityMonths,
    maxInstallmentToMarginRatio: baseInput.maxInstallmentToMarginRatio,
    horizonMonths: baseInput.horizonMonths,
  }
}
