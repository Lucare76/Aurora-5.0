import type {
  AffordabilityClassification,
  AffordabilityDataQuality,
} from '@/lib/affordability/types'
import type {
  ComparisonProfile,
  CriterionDefinition,
  CriterionKey,
  CriterionWeights,
} from './types'

export const DECISION_COMPARISON_ENGINE_VERSION = '24A.0.0'

export const MIN_SCENARIOS = 2
export const MAX_SCENARIOS = 4

// Relative score ties within this many points are treated as a rank tie.
export const SCORE_TIE_EPSILON = 0.5

// Per-criterion "difference is not worth mentioning" threshold, expressed as a
// fraction of the observed range across the compared scenarios.
export const NEGLIGIBLE_DIFFERENCE_RATIO = 0.02

// Flat penalty (score points) subtracted per critical month, so that liquidity
// criticality cannot be offset by a high residual value — see scoring.ts.
export const CRITICAL_MONTH_PENALTY = 4
export const MAX_LIQUIDITY_PENALTY = 40

export const DISCLAIMER =
  'Questo confronto produce un indice relativo (0-100) utile a ordinare le opzioni analizzate tra loro. ' +
  'Non costituisce una raccomandazione finanziaria assoluta né sostituisce una valutazione professionale: ' +
  "i punteggi dipendono dal profilo scelto e dalla qualità dei dati disponibili per ciascuno scenario."

export const DATA_QUALITY_SCORE_MAP: Record<AffordabilityDataQuality, number> = {
  ALTA: 100,
  MEDIA: 66,
  BASSA: 33,
  INSUFFICIENTE: 0,
}

// Used as a ranking tie-breaker: lower index = more sustainable classification.
export const CLASSIFICATION_RANK: Record<AffordabilityClassification, number> = {
  AFFORDABLE: 0,
  CAUTION: 1,
  RISKY: 2,
  NOT_AFFORDABLE: 3,
  INSUFFICIENT_DATA: 4,
}

// ── Criteria catalogue ───────────────────────────────────────────────────────

export const CRITERIA: CriterionDefinition[] = [
  { key: 'initialCashOutflow', label: 'Esborso iniziale', direction: 'lowerIsBetter', category: 'cost' },
  { key: 'totalCashOutflow', label: 'Uscita di cassa totale', direction: 'lowerIsBetter', category: 'cost' },
  { key: 'netTotalCost', label: 'Costo netto totale', direction: 'lowerIsBetter', category: 'cost' },
  { key: 'averageMonthlyCost', label: 'Costo medio mensile', direction: 'lowerIsBetter', category: 'cost' },
  { key: 'recurringMonthlyCommitment', label: 'Impegno mensile ricorrente', direction: 'lowerIsBetter', category: 'commitment' },
  { key: 'residualLiquidity', label: 'Liquidità residua', direction: 'higherIsBetter', category: 'liquidity' },
  { key: 'minimumProjectedBalance', label: 'Saldo minimo proiettato', direction: 'higherIsBetter', category: 'liquidity' },
  { key: 'emergencyFundMonthsAfterDecision', label: 'Mesi di fondo emergenza dopo la decisione', direction: 'higherIsBetter', category: 'liquidity' },
  { key: 'monthlyMarginAfterDecision', label: 'Margine mensile dopo la decisione', direction: 'higherIsBetter', category: 'liquidity' },
  { key: 'negativeMonthsCount', label: 'Mesi in negativo', direction: 'lowerIsBetter', category: 'liquidity' },
  { key: 'criticalMonthsCount', label: 'Mesi critici', direction: 'lowerIsBetter', category: 'liquidity' },
  { key: 'totalFinancingCost', label: 'Costo totale del finanziamento', direction: 'lowerIsBetter', category: 'debt' },
  { key: 'remainingDebtAtEnd', label: 'Debito residuo a fine periodo', direction: 'lowerIsBetter', category: 'debt' },
  { key: 'estimatedResidualValue', label: 'Valore residuo stimato', direction: 'higherIsBetter', category: 'value' },
]

export const CRITERION_KEYS: CriterionKey[] = CRITERIA.map((c) => c.key)

export const LIQUIDITY_CRITERIA: CriterionKey[] = CRITERIA.filter((c) => c.category === 'liquidity').map((c) => c.key)

function weights(pct: Record<CriterionKey, number>): CriterionWeights {
  const out = {} as CriterionWeights
  for (const key of CRITERION_KEYS) {
    out[key] = pct[key] / 100
  }
  return out
}

// Every profile below sums to exactly 100 (validated in constants.test.ts).
// Invariant enforced across ALL profiles: total liquidity-category weight must
// exceed the estimatedResidualValue weight, per Sprint 24A requirement that
// liquidity criticality takes priority over residual value.
export const PROFILE_WEIGHTS: Record<Exclude<ComparisonProfile, 'CUSTOM'>, CriterionWeights> = {
  BALANCED: weights({
    initialCashOutflow: 7,
    totalCashOutflow: 7,
    netTotalCost: 7,
    averageMonthlyCost: 7,
    recurringMonthlyCommitment: 10,
    residualLiquidity: 6,
    minimumProjectedBalance: 6,
    emergencyFundMonthsAfterDecision: 6,
    monthlyMarginAfterDecision: 6,
    negativeMonthsCount: 6,
    criticalMonthsCount: 6,
    totalFinancingCost: 8,
    remainingDebtAtEnd: 8,
    estimatedResidualValue: 10,
  }),
  PROTECT_LIQUIDITY: weights({
    initialCashOutflow: 4,
    totalCashOutflow: 4,
    netTotalCost: 4,
    averageMonthlyCost: 4,
    recurringMonthlyCommitment: 6,
    residualLiquidity: 12,
    minimumProjectedBalance: 12,
    emergencyFundMonthsAfterDecision: 12,
    monthlyMarginAfterDecision: 12,
    negativeMonthsCount: 10,
    criticalMonthsCount: 10,
    totalFinancingCost: 5,
    remainingDebtAtEnd: 5,
    estimatedResidualValue: 0,
  }),
  REDUCE_TOTAL_COST: weights({
    initialCashOutflow: 12,
    totalCashOutflow: 16,
    netTotalCost: 16,
    averageMonthlyCost: 10,
    recurringMonthlyCommitment: 6,
    residualLiquidity: 5,
    minimumProjectedBalance: 5,
    emergencyFundMonthsAfterDecision: 4,
    monthlyMarginAfterDecision: 4,
    negativeMonthsCount: 4,
    criticalMonthsCount: 4,
    totalFinancingCost: 6,
    remainingDebtAtEnd: 4,
    estimatedResidualValue: 4,
  }),
  REDUCE_MONTHLY_COMMITMENT: weights({
    initialCashOutflow: 4,
    totalCashOutflow: 4,
    netTotalCost: 4,
    averageMonthlyCost: 14,
    recurringMonthlyCommitment: 28,
    residualLiquidity: 5,
    minimumProjectedBalance: 5,
    emergencyFundMonthsAfterDecision: 5,
    monthlyMarginAfterDecision: 14,
    negativeMonthsCount: 4,
    criticalMonthsCount: 4,
    totalFinancingCost: 5,
    remainingDebtAtEnd: 4,
    estimatedResidualValue: 0,
  }),
  AVOID_DEBT: weights({
    initialCashOutflow: 4,
    totalCashOutflow: 4,
    netTotalCost: 6,
    averageMonthlyCost: 4,
    recurringMonthlyCommitment: 6,
    residualLiquidity: 6,
    minimumProjectedBalance: 6,
    emergencyFundMonthsAfterDecision: 6,
    monthlyMarginAfterDecision: 6,
    negativeMonthsCount: 6,
    criticalMonthsCount: 6,
    totalFinancingCost: 20,
    remainingDebtAtEnd: 16,
    estimatedResidualValue: 4,
  }),
  PRESERVE_EMERGENCY_FUND: weights({
    initialCashOutflow: 4,
    totalCashOutflow: 4,
    netTotalCost: 4,
    averageMonthlyCost: 4,
    recurringMonthlyCommitment: 6,
    residualLiquidity: 16,
    minimumProjectedBalance: 16,
    emergencyFundMonthsAfterDecision: 20,
    monthlyMarginAfterDecision: 8,
    negativeMonthsCount: 6,
    criticalMonthsCount: 6,
    totalFinancingCost: 3,
    remainingDebtAtEnd: 3,
    estimatedResidualValue: 0,
  }),
}
