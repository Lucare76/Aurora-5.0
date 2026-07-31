import { CRITERION_KEYS, MAX_SCENARIOS, MIN_SCENARIOS } from './constants'
import { DecisionComparisonError } from './types'
import type { CriterionKey, DecisionComparisonInput, NormalizedScenario } from './types'

// Core metrics a scenario must genuinely have (i.e. not be in missingMetrics)
// to be considered to hold "minimum data" for comparison.
const CORE_REQUIRED_METRICS: CriterionKey[] = [
  'initialCashOutflow',
  'totalCashOutflow',
  'residualLiquidity',
  'minimumProjectedBalance',
  'monthlyMarginAfterDecision',
]

function assertFiniteMetrics(scenario: NormalizedScenario): void {
  for (const key of CRITERION_KEYS) {
    const value = scenario.metrics[key]
    if (value === null) continue // only emergencyFundMonthsAfterDecision may be null
    if (!Number.isFinite(value)) {
      throw new DecisionComparisonError(
        'INVALID_NUMBER',
        `Lo scenario "${scenario.name}" contiene un valore non valido (NaN/Infinity) per "${key}".`,
      )
    }
  }
  if (!Number.isFinite(scenario.metrics.dataQualityScore) || !Number.isFinite(scenario.metrics.confidenceLevel)) {
    throw new DecisionComparisonError(
      'INVALID_NUMBER',
      `Lo scenario "${scenario.name}" contiene un valore non valido (NaN/Infinity) negli indicatori di qualità dati.`,
    )
  }
}

function assertMinimumData(scenario: NormalizedScenario): void {
  const missingCore = CORE_REQUIRED_METRICS.filter((key) => scenario.missingMetrics.includes(key))
  const insufficient = scenario.metrics.affordabilityClassification === 'INSUFFICIENT_DATA'

  if (missingCore.length > 0 || insufficient) {
    throw new DecisionComparisonError(
      'INSUFFICIENT_DATA',
      `Lo scenario "${scenario.name}" non dispone dei dati minimi necessari per il confronto.`,
    )
  }
}

export function validateScenarios(scenarios: NormalizedScenario[]): void {
  if (scenarios.length < MIN_SCENARIOS) {
    throw new DecisionComparisonError('TOO_FEW_SCENARIOS', `Servono almeno ${MIN_SCENARIOS} scenari per un confronto.`)
  }
  if (scenarios.length > MAX_SCENARIOS) {
    throw new DecisionComparisonError('TOO_MANY_SCENARIOS', `Non è possibile confrontare più di ${MAX_SCENARIOS} scenari.`)
  }

  const currency = scenarios[0].currency
  const currencyMismatch = scenarios.some((s) => s.currency !== currency)
  if (currencyMismatch) {
    throw new DecisionComparisonError(
      'CURRENCY_MISMATCH',
      'Tutti gli scenari devono essere espressi nella stessa valuta.',
    )
  }

  for (const scenario of scenarios) {
    assertFiniteMetrics(scenario)
    assertMinimumData(scenario)
  }
}

export function validateWeights(weights: Partial<Record<CriterionKey, number>>): Record<CriterionKey, number> {
  const normalized = {} as Record<CriterionKey, number>
  let sum = 0

  for (const key of CRITERION_KEYS) {
    const raw = weights[key] ?? 0
    if (!Number.isFinite(raw) || raw < 0) {
      throw new DecisionComparisonError('INVALID_WEIGHTS', `Il peso per "${key}" non è un numero valido non negativo.`)
    }
    normalized[key] = raw
    sum += raw
  }

  if (sum <= 0) {
    throw new DecisionComparisonError('INVALID_WEIGHTS', 'La somma dei pesi personalizzati deve essere maggiore di zero.')
  }

  for (const key of CRITERION_KEYS) {
    normalized[key] = normalized[key] / sum
  }

  return normalized
}

export function validateDecisionComparisonInput(input: DecisionComparisonInput): void {
  validateScenarios(input.scenarios)

  if (input.profile === 'CUSTOM') {
    if (!input.customWeights) {
      throw new DecisionComparisonError('INVALID_WEIGHTS', 'Il profilo CUSTOM richiede customWeights.')
    }
    validateWeights(input.customWeights)
  }
}
