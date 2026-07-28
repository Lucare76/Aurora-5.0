import { CLASSIFICATION_LABELS } from '../constants'
import type { AffordabilityClassification } from '../types'
import type {
  HomeComparisonResult,
  HomeComparisonSide,
  HomeCosts,
  HomeInput,
  HomeMortgageComparisonResult,
} from './types'
import { computeHomeCosts } from './costs'
import { roundMoney, sumMoney } from '@/lib/scenarios/money'

function classifySimple(liquidityAfter: number, monthlyCost: number, monthlyMargin: number): AffordabilityClassification {
  if (liquidityAfter < 0) return 'NOT_AFFORDABLE'
  if (monthlyMargin <= 0 && monthlyCost > 0) return 'RISKY'
  const ratio = monthlyMargin > 0 ? monthlyCost / monthlyMargin : null
  if (ratio != null && ratio > 0.7) return 'RISKY'
  if (ratio != null && ratio > 0.35) return 'CAUTION'
  return 'AFFORDABLE'
}

function side(label: string, costs: HomeCosts, totalLiquidity: number, monthlyMargin: number): HomeComparisonSide {
  const liquidityAfter = roundMoney(totalLiquidity - costs.upfrontHomeCost)
  const classification = classifySimple(liquidityAfter, costs.averageMonthlyHousingCost, monthlyMargin)
  return {
    label,
    effectivePropertyPrice: costs.effectivePropertyPrice,
    upfrontHomeCost: costs.upfrontHomeCost,
    mortgageMonthlyPayment: costs.mortgageMonthlyPayment,
    averageMonthlyHousingCost: costs.averageMonthlyHousingCost,
    totalOwnershipCost: costs.totalOwnershipCost,
    netOwnershipCost: costs.netOwnershipCost,
    residualPropertyValue: costs.residualPropertyValue,
    minimumLiquidity: liquidityAfter,
    negativeMonths: liquidityAfter < 0 ? 1 : 0,
    classification,
    classificationLabel: CLASSIFICATION_LABELS[classification],
  }
}

function winner(a: number, b: number, lowerBetter = true): 'A' | 'B' | 'equal' {
  if (Math.abs(a - b) < 0.01) return 'equal'
  return (lowerBetter ? a < b : a > b) ? 'A' : 'B'
}

export function buildHomeComparison(input: HomeInput, costs: HomeCosts, totalLiquidity: number, monthlyMargin: number): HomeComparisonResult | null {
  if (!input.compareWithHome) return null
  const otherInput: HomeInput = {
    ...input,
    simulationName: input.compareWithHome.label,
    askingPrice: input.compareWithHome.agreedPrice,
    agreedPrice: input.compareWithHome.agreedPrice,
    downPayment: input.compareWithHome.downPayment,
    mortgageAmount: input.compareWithHome.mortgageAmount,
    mortgageMonthlyPayment: input.compareWithHome.mortgageMonthlyPayment,
    mortgageDurationMonths: input.compareWithHome.mortgageDurationMonths ?? input.mortgageDurationMonths,
    acquisitionCosts: {
      ...input.acquisitionCosts,
      notary: input.compareWithHome.notary,
      taxes: input.compareWithHome.taxes,
      agency: input.compareWithHome.agency,
    },
    renovation: { ...input.renovation, totalEstimated: input.compareWithHome.renovation },
    furnishing: { ...input.furnishing, furniture: input.compareWithHome.furnishing },
    condominium: { ...input.condominium, monthly: input.compareWithHome.condominiumMonthly },
    utilities: { ...input.utilities, electricity: input.compareWithHome.utilitiesMonthly },
    maintenance: { ...input.maintenance, ordinaryAnnual: input.compareWithHome.maintenanceAnnual },
    residualValue: { ...input.residualValue, estimatedPropertyValue: input.compareWithHome.residualPropertyValue },
  }
  const homeA = side(input.simulationName, costs, totalLiquidity, monthlyMargin)
  const homeB = side(input.compareWithHome.label, computeHomeCosts(otherInput), totalLiquidity, monthlyMargin)
  return {
    homeA,
    homeB,
    insight: {
      lowerUpfront: winner(homeA.upfrontHomeCost, homeB.upfrontHomeCost),
      lowerMonthly: winner(homeA.averageMonthlyHousingCost, homeB.averageMonthlyHousingCost),
      lowerTotalCost: winner(homeA.netOwnershipCost, homeB.netOwnershipCost),
      betterSustainability: winner(homeA.negativeMonths, homeB.negativeMonths),
    },
  }
}

export function buildMortgageComparison(input: HomeInput, totalLiquidity: number, monthlyMargin: number): HomeMortgageComparisonResult | null {
  if (!input.compareMortgageOptions || input.compareMortgageOptions.length === 0) return null
  return {
    options: input.compareMortgageOptions.map((option) => {
      const upfrontHomeCost = sumMoney([option.downPayment, option.fees ?? 0])
      const mortgageTotalCost = roundMoney(Math.max(0, option.monthlyPayment * option.durationMonths + (option.balloonPayment ?? 0) + (option.fees ?? 0) - option.mortgageAmount))
      const liquidityAfter = roundMoney(totalLiquidity - upfrontHomeCost)
      const classification = classifySimple(liquidityAfter, option.monthlyPayment, monthlyMargin)
      return {
        label: option.label,
        upfrontHomeCost,
        mortgageMonthlyPayment: option.monthlyPayment,
        mortgageTotalCost,
        liquidityAfter,
        negativeMonths: liquidityAfter < 0 ? 1 : 0,
        classification,
        classificationLabel: CLASSIFICATION_LABELS[classification],
      }
    }),
  }
}
