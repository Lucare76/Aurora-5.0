import type { AffordabilityDbData, AffordabilityInput } from '../types'
import { runAffordabilityEngine } from '../engine'
import { buildAffordabilityBaseline } from '../baseline'
import { DEFAULT_MINIMUM_LIQUIDITY_MONTHS, DISCLAIMER, DISCLAIMER_VARIABILITY } from '../constants'
import { computeHomeCosts } from './costs'
import { buildHomeReasons, buildHomeRisks, buildHomeAlternatives } from './explanations'
import { buildHomeComparison, buildMortgageComparison } from './comparison'
import { describeMortgage } from './mortgage'
import { DEFAULT_HOME_HORIZON_MONTHS, HOME_AFFORDABILITY_ENGINE_VERSION } from './constants'
import type { HomeAffordabilityResult, HomeCosts, HomeInput } from './types'
import { roundMoney } from '@/lib/scenarios/money'

function toAffordabilityInput(input: HomeInput, costs: HomeCosts): AffordabilityInput {
  const recurringMonths = Math.min(input.horizonMonths ?? DEFAULT_HOME_HORIZON_MONTHS, costs.ownershipPeriodMonths)
  return {
    purchaseName: input.simulationName,
    totalPrice: costs.effectivePropertyPrice,
    paymentMode: input.paymentMode === 'MORTGAGE' ? 'INSTALLMENTS' : 'IMMEDIATE',
    purchaseDate: input.purchaseDate,
    currency: input.currency,
    accountId: input.accountId,
    debitAccountId: input.debitAccountId,
    downPayment: input.paymentMode === 'MORTGAGE' ? costs.downPayment : null,
    installmentAmount: input.paymentMode === 'MORTGAGE' ? costs.mortgageMonthlyPayment : null,
    numberOfInstallments: input.paymentMode === 'MORTGAGE' ? (input.mortgageDurationMonths ?? null) : null,
    firstInstallmentDate: input.firstMortgagePaymentDate ?? input.purchaseDate,
    balloonPayment: costs.balloonPayment,
    additionalUpfrontCosts: roundMoney(costs.initialCostsTotal + costs.renovationCost + Math.max(0, costs.furnishingCost - costs.furnishingDeferrable)),
    monthlyRecurringCost: roundMoney(costs.recurringManagementCost + costs.separateFinancingMonthlyPayment),
    annualRecurringCost: null,
    estimatedResaleValue: costs.estimatedNetEquity,
    linkedMonthlyIncome: input.currentHousing?.futureRentalIncomeMonthly ?? null,
    recurringDurationMonths: recurringMonths,
    notes: input.description ?? null,
    minimumLiquidityMonths: input.minimumLiquidityMonths,
    maxInstallmentToMarginRatio: input.maxInstallmentToMarginRatio,
    horizonMonths: input.horizonMonths ?? DEFAULT_HOME_HORIZON_MONTHS,
    includeGoalContributions: input.includeGoalContributions,
  }
}

function buildHomeSummary(base: HomeAffordabilityResult): string {
  const m = base.homeMetrics
  const coverage = base.coverageMonthsAfter?.toFixed(1) ?? '—'
  return `${base.classificationLabel}. L'acquisto richiede un esborso iniziale di ${m.upfrontHomeCost.toFixed(2)} € e comporta un costo abitativo medio stimato di ${m.averageMonthlyHousingCost.toFixed(2)} € al mese. Rispetto alla situazione attuale, l'impegno varia di circa ${m.incrementalMonthlyHousingCost.toFixed(2)} € mensili. Dopo l'acquisto resterebbero ${coverage} mesi di spese disponibili.`
}

function computeHomeMaxPrice(base: HomeAffordabilityResult): { price: number | null; note: string | null } {
  const m = base.homeMetrics
  if (base.dataQuality === 'INSUFFICIENTE' || base.confidence < 40 || m.missingCosts.length >= 6) {
    return { price: null, note: 'Dati insufficienti per stimare un intervallo prudenziale.' }
  }
  const minMonths = Number.isFinite(base.coverageMonthsBefore ?? NaN)
    ? DEFAULT_MINIMUM_LIQUIDITY_MONTHS
    : 3
  const requiredBuffer = roundMoney((base.liquidityBefore - base.liquidityAfter + Math.max(0, base.monthlyMarginBefore)) * 0)
  const availableUpfront = Math.max(0, base.liquidityBefore - (base.monthlyMarginBefore > 0 ? minMonths * Math.max(1, base.monthlyMarginBefore * 0.5) : requiredBuffer))
  const monthlyCapacity = Math.max(0, base.monthlyMarginBefore * (base.installmentToMarginRatio != null ? 0.35 : 0.3) - m.recurringManagementCost)
  const mortgageCapacity = base.homeMetrics.mortgageMonthlyPayment > 0 && monthlyCapacity > 0 && m.mortgageAmount > 0
    ? roundMoney(m.mortgageAmount * (monthlyCapacity / m.mortgageMonthlyPayment))
    : 0
  const rough = roundMoney(availableUpfront + mortgageCapacity - m.initialCostsTotal)
  if (rough <= 0) return { price: null, note: 'Liquidità o margine mensile insufficienti per stimare un prezzo massimo.' }
  const low = Math.max(0, roundMoney(rough * 0.95))
  const high = roundMoney(rough * 1.05)
  return {
    price: roundMoney((low + high) / 2),
    note: `Intervallo prudenziale indicativo: tra ${low.toFixed(2)} € e ${high.toFixed(2)} €. Non considera imposte o tassi non inseriti.`,
  }
}

export function runHomeAffordabilityEngine(
  input: HomeInput,
  dbData: AffordabilityDbData,
  now: Date,
): HomeAffordabilityResult {
  const costs = computeHomeCosts(input)
  const affordabilityInput = toAffordabilityInput(input, costs)
  const base = runAffordabilityEngine(affordabilityInput, dbData, now)
  const baseline = buildAffordabilityBaseline(dbData, input.includeGoalContributions ?? true, now)

  const homeReasons = buildHomeReasons(input, costs, baseline.monthlyMargin, base.liquidityAfter)
  const homeRisks = buildHomeRisks(input, costs)
  const homeAlternatives = buildHomeAlternatives(input, costs, baseline.monthlyMargin, base.liquidityAfter)
  const missingData = [...base.missingData]
  if (costs.missingCosts.length > 0) {
    missingData.push(`Costi casa non inseriti: ${costs.missingCosts.join(', ')}.`)
  }
  const assumptions = [
    ...base.assumptions,
    'Prezzo, imposte, costi accessori, valore residuo e debito residuo sono valori inseriti manualmente.',
    'La caparra già versata è trattata come quota già sostenuta e non riduce il costo complessivo della casa.',
    ...describeMortgage(input),
  ]

  const result: HomeAffordabilityResult = {
    ...base,
    summary: base.summary,
    reasons: [...base.reasons, ...homeReasons],
    risks: [...base.risks, ...homeRisks],
    alternatives: [...base.alternatives, ...homeAlternatives],
    missingData,
    assumptions,
    disclaimer: `${DISCLAIMER} ${DISCLAIMER_VARIABILITY} Non costituisce consulenza finanziaria, fiscale, bancaria o immobiliare.`,
    engineVersion: HOME_AFFORDABILITY_ENGINE_VERSION,
    homeMetrics: costs,
    homeComparison: buildHomeComparison(input, costs, baseline.totalLiquidity, baseline.monthlyMargin),
    mortgageComparison: buildMortgageComparison(input, baseline.totalLiquidity, baseline.monthlyMargin),
  }

  const maxPrice = computeHomeMaxPrice(result)
  result.maxAffordablePrice = maxPrice.price
  result.maxAffordablePriceNote = maxPrice.note
  result.summary = buildHomeSummary(result)

  return result
}
