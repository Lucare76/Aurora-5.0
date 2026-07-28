import type { AffordabilityBaseline, AffordabilityInput, ProjectionPoint } from './types'
import { roundMoney, addMoney, subtractMoney } from '@/lib/scenarios/money'
import { generatePeriods, periodKeyForDate } from '@/lib/scenarios/dates'
import { DEFAULT_HORIZON_MONTHS } from './constants'

// ── Cost breakdown ────────────────────────────────────────────────────────────

export type CostBreakdown = {
  upfrontCost: number
  monthlyInstallment: number
  balloonPayment: number
  totalInstallmentCost: number
  recurringMonthlyCost: number
  effectiveMonthlyCost: number
  totalCostEstimate: number
}

export function computeCostBreakdown(input: AffordabilityInput): CostBreakdown {
  const additional = roundMoney(input.additionalUpfrontCosts ?? 0)
  const resale = roundMoney(input.estimatedResaleValue ?? 0)
  const linkedIncome = roundMoney(input.linkedMonthlyIncome ?? 0)
  const monthlyCost = roundMoney(input.monthlyRecurringCost ?? 0)
  const annualCost = roundMoney(input.annualRecurringCost ?? 0)
  const horizonMonths = input.horizonMonths ?? DEFAULT_HORIZON_MONTHS
  const recurringMonths = input.recurringDurationMonths ?? horizonMonths
  const recurringMonthly = addMoney(monthlyCost, roundMoney(annualCost / 12))

  if (input.paymentMode === 'IMMEDIATE') {
    const upfront = addMoney(input.totalPrice, additional)
    const effectiveMonthlyCost = roundMoney(Math.max(0, subtractMoney(recurringMonthly, linkedIncome)))
    const totalCost = roundMoney(
      subtractMoney(upfront, resale) + recurringMonthly * recurringMonths,
    )
    return {
      upfrontCost: upfront,
      monthlyInstallment: 0,
      balloonPayment: 0,
      totalInstallmentCost: 0,
      recurringMonthlyCost: recurringMonthly,
      effectiveMonthlyCost,
      totalCostEstimate: totalCost,
    }
  }

  // Installments
  const down = roundMoney(input.downPayment ?? 0)
  const upfront = addMoney(down, additional)
  const installment = roundMoney(input.installmentAmount ?? 0)
  const nInstallments = input.numberOfInstallments ?? 0
  const balloon = roundMoney(input.balloonPayment ?? 0)

  const totalInstallmentCost = addMoney(addMoney(upfront, roundMoney(installment * nInstallments)), balloon)
  const effectiveMonthlyCost = roundMoney(
    Math.max(0, addMoney(installment, recurringMonthly) - linkedIncome),
  )
  const totalCostEstimate = roundMoney(
    subtractMoney(totalInstallmentCost, resale) +
      recurringMonthly * Math.max(0, recurringMonths - nInstallments),
  )

  return {
    upfrontCost: upfront,
    monthlyInstallment: installment,
    balloonPayment: balloon,
    totalInstallmentCost,
    recurringMonthlyCost: recurringMonthly,
    effectiveMonthlyCost,
    totalCostEstimate,
  }
}

// ── Liquidity helpers ─────────────────────────────────────────────────────────

export function computeLiquidityAfter(
  baseline: AffordabilityBaseline,
  upfrontCost: number,
): number {
  return subtractMoney(baseline.totalLiquidity, upfrontCost)
}

export function computeCoverageMonths(
  liquidity: number,
  monthlyExpenses: number,
): number | null {
  if (monthlyExpenses <= 0) return null
  return roundMoney(liquidity / monthlyExpenses)
}

export function computeMonthlyMarginAfter(
  baseline: AffordabilityBaseline,
  effectiveMonthlyCost: number,
): number {
  return subtractMoney(baseline.monthlyMargin, effectiveMonthlyCost)
}

export function computeInstallmentToMarginRatio(
  installment: number,
  monthlyMarginBefore: number,
): number | null {
  if (monthlyMarginBefore <= 0) return null
  return roundMoney(installment / monthlyMarginBefore)
}

export function computeTotalDebtToMarginRatio(
  existingMonthlyDebt: number,
  newInstallment: number,
  newRecurring: number,
  monthlyMarginBefore: number,
): number | null {
  if (monthlyMarginBefore <= 0) return null
  const totalBurden = roundMoney(existingMonthlyDebt + newInstallment + newRecurring)
  return roundMoney(totalBurden / monthlyMarginBefore)
}

// ── Monthly projection ────────────────────────────────────────────────────────

export type ProjectionResult = {
  points: ProjectionPoint[]
  negativeMonths: number
  criticalMonths: string[]
  minimumLiquidity: number
  minimumLiquidityDate: string | null
}

export function buildProjection(
  baseline: AffordabilityBaseline,
  input: AffordabilityInput,
  costs: CostBreakdown,
  startDate: string,
): ProjectionResult {
  const horizonMonths = input.horizonMonths ?? DEFAULT_HORIZON_MONTHS
  const periods = generatePeriods(startDate, horizonMonths)

  const purchasePeriodKey = periodKeyForDate(input.purchaseDate)
  const firstInstallmentPeriodKey = input.firstInstallmentDate
    ? periodKeyForDate(input.firstInstallmentDate)
    : purchasePeriodKey

  const nInstallments = input.numberOfInstallments ?? 0
  const recurringDuration = input.recurringDurationMonths ?? horizonMonths
  const linkedIncome = roundMoney(input.linkedMonthlyIncome ?? 0)

  // Find index of first installment period
  const firstInstIdx = periods.findIndex((p) => p.key >= firstInstallmentPeriodKey)
  const purchasePeriodIdx = periods.findIndex((p) => p.key >= purchasePeriodKey)

  // Base monthly net for baseline
  const baselineMonthlyNet = roundMoney(
    baseline.monthlyIncome - baseline.monthlyExpenses - baseline.monthlyLoanPayments - baseline.monthlyGoalContributions,
  )

  let baselineLiquidity = baseline.totalLiquidity
  let scenarioLiquidity = baseline.totalLiquidity

  const points: ProjectionPoint[] = []
  let negativeMonths = 0
  const criticalMonths: string[] = []
  let minimumLiquidity = scenarioLiquidity
  let minimumLiquidityDate: string | null = null

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]

    // Baseline: constant net cash flow each month
    baselineLiquidity = addMoney(baselineLiquidity, baselineMonthlyNet)

    // Scenario net = baseline net, then apply purchase effects
    let scenarioNet = baselineMonthlyNet

    // Upfront cost (once, in the purchase month)
    if (i === purchasePeriodIdx) {
      scenarioLiquidity = subtractMoney(scenarioLiquidity, costs.upfrontCost)
    }

    // Installment in relevant months
    let installmentThisMonth = 0
    if (nInstallments > 0 && firstInstIdx >= 0) {
      const installIdx = i - firstInstIdx
      if (installIdx >= 0 && installIdx < nInstallments) {
        installmentThisMonth = costs.monthlyInstallment
        scenarioNet = subtractMoney(scenarioNet, installmentThisMonth)
        // Balloon on last installment month
        if (installIdx === nInstallments - 1 && costs.balloonPayment > 0) {
          scenarioNet = subtractMoney(scenarioNet, costs.balloonPayment)
        }
      }
    }

    // Recurring cost (net of linked income) for recurringDuration months after purchase
    if (purchasePeriodIdx >= 0) {
      const monthsAfterPurchase = i - purchasePeriodIdx
      if (monthsAfterPurchase >= 0 && monthsAfterPurchase < recurringDuration) {
        const netRecurring = roundMoney(costs.recurringMonthlyCost - linkedIncome)
        if (netRecurring > 0) {
          scenarioNet = subtractMoney(scenarioNet, netRecurring)
        }
      }
    }

    scenarioLiquidity = addMoney(scenarioLiquidity, scenarioNet)

    if (scenarioLiquidity < minimumLiquidity) {
      minimumLiquidity = scenarioLiquidity
      minimumLiquidityDate = period.startDate
    }

    if (scenarioLiquidity < 0) {
      negativeMonths++
      criticalMonths.push(period.key)
    }

    points.push({
      period: period.key,
      label: period.label,
      baselineLiquidity: roundMoney(baselineLiquidity),
      scenarioLiquidity: roundMoney(scenarioLiquidity),
      baselineMargin: roundMoney(baselineMonthlyNet),
      scenarioMargin: roundMoney(scenarioNet),
      installment: installmentThisMonth,
    })
  }

  return {
    points,
    negativeMonths,
    criticalMonths,
    minimumLiquidity: roundMoney(minimumLiquidity),
    minimumLiquidityDate,
  }
}

// ── Max affordable price ──────────────────────────────────────────────────────

export function computeMaxAffordablePrice(
  baseline: AffordabilityBaseline,
  input: AffordabilityInput,
  minMonths: number,
): { price: number | null; note: string | null } {
  const additional = input.additionalUpfrontCosts ?? 0

  if (baseline.dataQuality === 'INSUFFICIENTE') {
    return { price: null, note: 'Dati insufficienti per calcolare un prezzo massimo.' }
  }

  if (input.paymentMode === 'IMMEDIATE') {
    const minBuffer = roundMoney(baseline.monthlyExpenses * minMonths)
    const maxUpfront = subtractMoney(baseline.totalLiquidity, minBuffer)
    if (maxUpfront <= 0) {
      return {
        price: null,
        note: `La liquidità non supera il fondo minimo di ${minMonths} ${minMonths === 1 ? 'mese' : 'mesi'} di spese (${minBuffer.toFixed(2)} €).`,
      }
    }
    const maxPrice = subtractMoney(maxUpfront, additional)
    if (maxPrice <= 0) {
      return {
        price: null,
        note: 'Le spese aggiuntive superano la liquidità disponibile dopo il fondo minimo.',
      }
    }
    return {
      price: roundMoney(maxPrice),
      note: `Mantiene almeno ${minMonths} ${minMonths === 1 ? 'mese' : 'mesi'} di spese come fondo di sicurezza (${minBuffer.toFixed(2)} €).`,
    }
  }

  // Installments
  const maxRatio = input.maxInstallmentToMarginRatio ?? 0.35
  if (baseline.monthlyMargin <= 0) {
    return { price: null, note: 'Il margine mensile attuale è zero o negativo.' }
  }
  const maxInstallment = roundMoney(baseline.monthlyMargin * maxRatio)
  const nInstallments = input.numberOfInstallments ?? 0
  if (nInstallments <= 0) {
    return { price: null, note: 'Numero di rate non specificato.' }
  }
  const minBuffer = roundMoney(baseline.monthlyExpenses * minMonths)
  const maxDownPayment = roundMoney(Math.max(0, subtractMoney(baseline.totalLiquidity, minBuffer)))
  const maxFinanced = roundMoney(maxInstallment * nInstallments)
  const maxPrice = addMoney(maxDownPayment, maxFinanced)

  return {
    price: roundMoney(maxPrice),
    note: `Anticipo massimo: ${maxDownPayment.toFixed(2)} €. Rata massima (${Math.round(maxRatio * 100)}% del margine): ${maxInstallment.toFixed(2)} €/mese × ${nInstallments} rate.`,
  }
}
