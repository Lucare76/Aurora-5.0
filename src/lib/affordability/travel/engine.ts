import { buildAffordabilityBaseline } from '../baseline'
import { DEFAULT_MINIMUM_LIQUIDITY_MONTHS, DISCLAIMER, DISCLAIMER_VARIABILITY } from '../constants'
import { runAffordabilityEngine } from '../engine'
import type { AffordabilityDbData, AffordabilityInput, AffordabilityClassification } from '../types'
import { roundMoney } from '@/lib/scenarios/money'
import { computeTravelCosts } from './costs'
import { buildTravelAlternatives } from './alternatives'
import { buildTravelComparison } from './comparison'
import { TRAVEL_AFFORDABILITY_ENGINE_VERSION, DEFAULT_TRAVEL_HORIZON_MONTHS } from './constants'
import { buildTravelReasons, buildTravelRisks } from './explanations'
import { monthsUntil } from './schedule'
import type { TravelAffordabilityResult, TravelCosts, TravelInput } from './types'

function toAffordabilityInput(input: TravelInput, costs: TravelCosts): AffordabilityInput {
  return {
    purchaseName: input.simulationName,
    totalPrice: costs.totalTripCost,
    paymentMode: 'IMMEDIATE',
    purchaseDate: input.bookingDate,
    currency: input.currency,
    additionalUpfrontCosts: 0,
    monthlyRecurringCost: 0,
    estimatedResaleValue: 0,
    recurringDurationMonths: 0,
    minimumLiquidityMonths: input.minimumLiquidityMonths,
    maxInstallmentToMarginRatio: input.maxInstallmentToMarginRatio,
    horizonMonths: input.horizonMonths ?? DEFAULT_TRAVEL_HORIZON_MONTHS,
    includeGoalContributions: input.includeGoalContributions,
  }
}

function maxBudget(base: TravelAffordabilityResult): { low: number | null; high: number | null; note: string | null } {
  if (base.dataQuality === 'INSUFFICIENTE' || base.confidence < 40) return { low: null, high: null, note: 'Dati insufficienti per stimare un budget massimo.' }
  const minMonths = DEFAULT_MINIMUM_LIQUIDITY_MONTHS
  const buffer = roundMoney(base.monthlyMarginBefore > 0 ? base.monthlyMarginBefore * minMonths : 0)
  const available = roundMoney(base.liquidityBefore - buffer)
  if (available <= 0) return { low: null, high: null, note: 'La liquidità non supera il fondo prudenziale impostato.' }
  return { low: roundMoney(available * 0.9), high: roundMoney(available), note: `Intervallo prudenziale: tra ${(available * 0.9).toFixed(2)} € e ${available.toFixed(2)} €.` }
}

function classifyShift(liquidityAfter: number): AffordabilityClassification {
  if (liquidityAfter < 0) return 'NOT_AFFORDABLE'
  return 'AFFORDABLE'
}

export function runTravelAffordabilityEngine(input: TravelInput, dbData: AffordabilityDbData, now: Date): TravelAffordabilityResult {
  const costs = computeTravelCosts(input, now)
  const baseInput = toAffordabilityInput(input, costs)
  const base = runAffordabilityEngine(baseInput, dbData, now)
  const baseline = buildAffordabilityBaseline(dbData, input.includeGoalContributions ?? true, now)
  const reasons = [...base.reasons, ...buildTravelReasons(costs, base.liquidityAfter, base.coverageMonthsAfter)]
  const risks = [...base.risks, ...buildTravelRisks(input, costs)]
  const alternatives = [...base.alternatives, ...buildTravelAlternatives(costs, base.liquidityAfter)]
  const missingData = [...base.missingData]
  if (costs.missingCosts.length > 0) missingData.push(`Costi vacanza non inseriti: ${costs.missingCosts.join(', ')}.`)

  const result: TravelAffordabilityResult = {
    ...base,
    engineVersion: TRAVEL_AFFORDABILITY_ENGINE_VERSION,
    summary: `${base.classificationLabel}. La vacanza costa ${costs.totalTripCost.toFixed(2)} € per ${costs.durationDays} giorni e ${costs.travelers} viaggiatori. Dopo la spesa resterebbero ${base.coverageMonthsAfter?.toFixed(1) ?? '—'} mesi di copertura.`,
    reasons,
    risks,
    alternatives,
    missingData,
    assumptions: [
      ...base.assumptions,
      'Tutti i costi viaggio sono importi inseriti manualmente.',
      'Aurora non recupera prezzi, tariffe, voli, hotel o cambi valuta online.',
      'La valutazione misura solo l impatto finanziario della vacanza.',
    ],
    disclaimer: `${DISCLAIMER} ${DISCLAIMER_VARIABILITY} Non costituisce consulenza finanziaria o turistica.`,
    travelMetrics: costs,
    travelComparison: buildTravelComparison(input, costs, baseline),
    departureShiftComparison: [0, 3, 6, 12].map((shift) => {
      const shifted = new Date(`${input.departureDate}T00:00:00Z`)
      shifted.setUTCMonth(shifted.getUTCMonth() + shift)
      const departureDate = shifted.toISOString().slice(0, 10)
      const months = monthsUntil(now, departureDate)
      const suggestedMonthlySaving = months > 0 ? roundMoney(costs.totalTripCost / months) : costs.totalTripCost
      const liquidityAfter = roundMoney(baseline.totalLiquidity - costs.totalTripCost)
      const classification = classifyShift(liquidityAfter)
      return {
        label: shift === 0 ? 'Oggi' : `Tra ${shift} mesi`,
        departureDate,
        suggestedMonthlySaving,
        liquidityAfter,
        classification,
        classificationLabel: base.classificationLabel,
      }
    }),
  }

  const budget = maxBudget(result)
  result.travelMetrics.maxSustainableBudgetLow = budget.low
  result.travelMetrics.maxSustainableBudgetHigh = budget.high
  result.maxAffordablePrice = budget.high
  result.maxAffordablePriceNote = budget.note
  return result
}
