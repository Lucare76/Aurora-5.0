import type { AffordabilityClassification } from '@/lib/affordability/types'

// ── Scenario domain ────────────────────────────────────────────────────────────

export type ScenarioType = 'GENERIC_PURCHASE' | 'CAR_PURCHASE' | 'HOME_PURCHASE' | 'TRAVEL_PURCHASE'

// ── Common metrics (normalized, cross-domain) ──────────────────────────────────
//
// Every adapter (generic/car/home/travel) must populate all of these fields.
// Values are always finite numbers (defaulted to 0 where a domain has no such
// concept, e.g. a trip has no `remainingDebtAtEnd`) — absence of real data is
// tracked separately via `NormalizedScenario.missingMetrics` so the scoring
// layer never lets a defaulted 0 win a "lower is better" criterion by accident.

export interface CommonMetrics {
  initialCashOutflow: number
  totalCashOutflow: number
  netTotalCost: number
  averageMonthlyCost: number
  recurringMonthlyCommitment: number
  residualLiquidity: number
  minimumProjectedBalance: number
  emergencyFundMonthsAfterDecision: number | null
  monthlyMarginAfterDecision: number
  negativeMonthsCount: number
  criticalMonthsCount: number
  totalFinancingCost: number
  remainingDebtAtEnd: number
  estimatedResidualValue: number
  affordabilityClassification: AffordabilityClassification
  dataQualityScore: number
  confidenceLevel: number
}

// Keys of CommonMetrics that are actually used as weighted comparison criteria.
// (affordabilityClassification / dataQualityScore / confidenceLevel are quality
// signals, not user preferences — they inform the confidence blend in scoring.ts
// and tie-breaking in ranking.ts instead of taking a weight slot.)
export type CriterionKey =
  | 'initialCashOutflow'
  | 'totalCashOutflow'
  | 'netTotalCost'
  | 'averageMonthlyCost'
  | 'recurringMonthlyCommitment'
  | 'residualLiquidity'
  | 'minimumProjectedBalance'
  | 'emergencyFundMonthsAfterDecision'
  | 'monthlyMarginAfterDecision'
  | 'negativeMonthsCount'
  | 'criticalMonthsCount'
  | 'totalFinancingCost'
  | 'remainingDebtAtEnd'
  | 'estimatedResidualValue'

export type CriterionDirection = 'lowerIsBetter' | 'higherIsBetter'

export type CriterionCategory = 'cost' | 'commitment' | 'liquidity' | 'debt' | 'value'

export interface CriterionDefinition {
  key: CriterionKey
  label: string
  direction: CriterionDirection
  category: CriterionCategory
}

// ── Normalized scenario ─────────────────────────────────────────────────────────

export interface NormalizedScenario {
  id: string
  name: string
  type: ScenarioType
  currency: string
  metrics: CommonMetrics
  /** Criterion metrics that were not truly available in the source engine result and were defaulted. */
  missingMetrics: CriterionKey[]
}

// ── Comparison profiles ──────────────────────────────────────────────────────────

export type ComparisonProfile =
  | 'BALANCED'
  | 'PROTECT_LIQUIDITY'
  | 'REDUCE_TOTAL_COST'
  | 'REDUCE_MONTHLY_COMMITMENT'
  | 'AVOID_DEBT'
  | 'PRESERVE_EMERGENCY_FUND'
  | 'CUSTOM'

export type CriterionWeights = Record<CriterionKey, number>

// ── Compatibility ──────────────────────────────────────────────────────────────

export type CompatibilityLevel = 'FULL' | 'FINANCIAL_ONLY'

export interface CompatibilityResult {
  level: CompatibilityLevel
  sameType: boolean
  currency: string
  usableCriteria: CriterionKey[]
}

// ── Scoring ──────────────────────────────────────────────────────────────────────

export interface CriterionScore {
  criterion: CriterionKey
  rawValue: number | null
  normalizedScore: number // 0-100
  isMissing: boolean
}

export interface ScenarioScore {
  scenarioId: string
  criterionScores: CriterionScore[]
  rawWeightedScore: number
  liquidityPenalty: number
  confidenceFactor: number
  finalScore: number // 0-100
}

// ── Ranking ────────────────────────────────────────────────────────────────────

export interface RankedScenario {
  scenarioId: string
  rank: number
  finalScore: number
  isTie: boolean
  tiedWithScenarioIds: string[]
}

export interface CriterionWinner {
  criterion: CriterionKey
  winnerScenarioId: string | null // null when tied / no usable data
  isTie: boolean
  isNegligibleDifference: boolean
  values: Array<{ scenarioId: string; value: number | null }>
}

// ── Trade-offs & dominance ────────────────────────────────────────────────────

export interface DominanceRelation {
  dominantScenarioId: string
  dominatedScenarioId: string
  marginCriteria: CriterionKey[]
}

export interface TradeoffSummary {
  scenarioAId: string
  scenarioBId: string
  aWinsOn: CriterionKey[]
  bWinsOn: CriterionKey[]
  tiedOn: CriterionKey[]
  isDominance: boolean
}

// ── Engine input/output ───────────────────────────────────────────────────────

export interface DecisionComparisonInput {
  scenarios: NormalizedScenario[]
  profile: ComparisonProfile
  /** Required (and only used) when profile === 'CUSTOM'. Missing keys default to 0. */
  customWeights?: Partial<CriterionWeights> | null
}

export interface DecisionComparisonResult {
  engineVersion: string
  calculatedAt: string
  compatibility: CompatibilityResult
  profile: ComparisonProfile
  weightsUsed: CriterionWeights
  scenarios: NormalizedScenario[]
  scores: ScenarioScore[]
  ranking: RankedScenario[]
  criterionWinners: CriterionWinner[]
  dominance: DominanceRelation[]
  tradeoffs: TradeoffSummary[]
  explanations: string[]
  disclaimer: string
}

// ── Errors ─────────────────────────────────────────────────────────────────────

export type DecisionComparisonErrorCode =
  | 'TOO_FEW_SCENARIOS'
  | 'TOO_MANY_SCENARIOS'
  | 'CURRENCY_MISMATCH'
  | 'INVALID_NUMBER'
  | 'INSUFFICIENT_DATA'
  | 'INVALID_WEIGHTS'

export class DecisionComparisonError extends Error {
  readonly code: DecisionComparisonErrorCode

  constructor(code: DecisionComparisonErrorCode, message: string) {
    super(message)
    this.name = 'DecisionComparisonError'
    this.code = code
  }
}
