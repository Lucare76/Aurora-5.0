import type { CommonMetrics, NormalizedScenario } from '@/lib/decision-comparison/types'

// Shared scenario builder for decision-comparison unit tests. Not a test file
// itself (no .test.ts suffix) — vitest will not collect it as a suite.

const DEFAULT_METRICS: CommonMetrics = {
  initialCashOutflow: 5000,
  totalCashOutflow: 20000,
  netTotalCost: 18000,
  averageMonthlyCost: 300,
  recurringMonthlyCommitment: 250,
  residualLiquidity: 15000,
  minimumProjectedBalance: 8000,
  emergencyFundMonthsAfterDecision: 6,
  monthlyMarginAfterDecision: 800,
  negativeMonthsCount: 0,
  criticalMonthsCount: 0,
  totalFinancingCost: 1000,
  remainingDebtAtEnd: 0,
  estimatedResidualValue: 2000,
  affordabilityClassification: 'AFFORDABLE',
  dataQualityScore: 100,
  confidenceLevel: 90,
}

export function makeMetrics(overrides: Partial<CommonMetrics> = {}): CommonMetrics {
  return { ...DEFAULT_METRICS, ...overrides }
}

export function makeScenario(
  overrides: Partial<Omit<NormalizedScenario, 'metrics'>> & { metrics?: Partial<CommonMetrics> } = {},
): NormalizedScenario {
  const { metrics, ...rest } = overrides
  return {
    id: 'scenario-a',
    name: 'Scenario A',
    type: 'GENERIC_PURCHASE',
    currency: 'EUR',
    metrics: makeMetrics(metrics),
    missingMetrics: [],
    ...rest,
  }
}
