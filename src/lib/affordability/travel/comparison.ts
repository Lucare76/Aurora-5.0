import { CLASSIFICATION_LABELS } from '../constants'
import type { AffordabilityBaseline, AffordabilityClassification } from '../types'
import { computeCoverageMonths } from '../metrics'
import { roundMoney } from '@/lib/scenarios/money'
import { daysInclusive } from './schedule'
import type { TravelComparisonResult, TravelComparisonSide, TravelCosts, TravelInput } from './types'

function classify(liquidityAfter: number, coverageMonthsAfter: number | null): AffordabilityClassification {
  if (liquidityAfter < 0) return 'NOT_AFFORDABLE'
  if (coverageMonthsAfter != null && coverageMonthsAfter < 1) return 'RISKY'
  if (coverageMonthsAfter != null && coverageMonthsAfter < 3) return 'CAUTION'
  return 'AFFORDABLE'
}

function side(label: string, totalCost: number, durationDays: number, baseline: AffordabilityBaseline): TravelComparisonSide {
  const liquidityAfter = roundMoney(baseline.totalLiquidity - totalCost)
  const coverageMonthsAfter = computeCoverageMonths(liquidityAfter, baseline.monthlyExpenses)
  const classification = classify(liquidityAfter, coverageMonthsAfter)
  return {
    label,
    totalCost,
    durationDays,
    liquidityAfter,
    coverageMonthsAfter,
    classification,
    classificationLabel: CLASSIFICATION_LABELS[classification],
  }
}

function winner(a: number, b: number, lowerBetter = true): 'A' | 'B' | 'equal' {
  if (Math.abs(a - b) < 0.01) return 'equal'
  return (lowerBetter ? a < b : a > b) ? 'A' : 'B'
}

export function buildTravelComparison(input: TravelInput, costs: TravelCosts, baseline: AffordabilityBaseline): TravelComparisonResult | null {
  if (!input.compareWithTravel) return null
  const travelA = side(input.simulationName, costs.totalTripCost, costs.durationDays, baseline)
  const travelB = side(
    input.compareWithTravel.label,
    input.compareWithTravel.totalCost,
    daysInclusive(input.compareWithTravel.departureDate, input.compareWithTravel.returnDate),
    baseline,
  )
  return {
    travelA,
    travelB,
    insight: {
      lowerCost: winner(travelA.totalCost, travelB.totalCost),
      shorterDuration: winner(travelA.durationDays, travelB.durationDays),
      betterLiquidity: winner(travelA.liquidityAfter, travelB.liquidityAfter, false),
      betterSustainability: winner(score(travelA.classification), score(travelB.classification), false),
    },
  }
}

function score(classification: AffordabilityClassification): number {
  return { AFFORDABLE: 4, CAUTION: 3, RISKY: 2, NOT_AFFORDABLE: 1, INSUFFICIENT_DATA: 0 }[classification]
}
