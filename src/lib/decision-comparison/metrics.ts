import type { AffordabilityDataQuality } from '@/lib/affordability/types'
import { roundMoney } from '@/lib/scenarios/money'
import { DATA_QUALITY_SCORE_MAP } from './constants'

// Pure helpers shared by adapters to derive CommonMetrics fields uniformly,
// rather than trusting each domain's own (differently-defined) "net cost" /
// "financing cost" fields — see decision-comparison research notes.

export function mapDataQualityToScore(quality: AffordabilityDataQuality): number {
  return DATA_QUALITY_SCORE_MAP[quality]
}

export function computeNetTotalCost(totalCashOutflow: number, estimatedResidualValue: number): number {
  return roundMoney(totalCashOutflow - estimatedResidualValue)
}

// Isolates the pure cost of financing from the generic engine's installment
// tracking (totalInstallmentCost includes the financed principal).
export function computeInstallmentFinancingCost(totalInstallmentCost: number, purchaseCost: number): number {
  return Math.max(0, roundMoney(totalInstallmentCost - purchaseCost))
}

export function safeNumber(value: number | null | undefined, fallback = 0): number {
  return value ?? fallback
}
