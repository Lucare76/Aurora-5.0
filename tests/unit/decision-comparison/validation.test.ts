import { describe, expect, it } from 'vitest'
import {
  validateDecisionComparisonInput,
  validateScenarios,
  validateWeights,
} from '@/lib/decision-comparison/validation'
import { DecisionComparisonError } from '@/lib/decision-comparison/types'
import type { DecisionComparisonInput } from '@/lib/decision-comparison/types'
import { makeScenario } from './fixtures'

describe('validateScenarios', () => {
  it('rejects fewer than 2 scenarios', () => {
    expect(() => validateScenarios([makeScenario({ id: 'a' })])).toThrow(DecisionComparisonError)
    try {
      validateScenarios([makeScenario({ id: 'a' })])
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('TOO_FEW_SCENARIOS')
    }
  })

  it('rejects more than 4 scenarios', () => {
    const scenarios = ['a', 'b', 'c', 'd', 'e'].map((id) => makeScenario({ id }))
    expect(() => validateScenarios(scenarios)).toThrow(DecisionComparisonError)
    try {
      validateScenarios(scenarios)
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('TOO_MANY_SCENARIOS')
    }
  })

  it('accepts exactly the minimum of 2 scenarios', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    expect(() => validateScenarios(scenarios)).not.toThrow()
  })

  it('accepts exactly the maximum of 4 scenarios', () => {
    const scenarios = ['a', 'b', 'c', 'd'].map((id) => makeScenario({ id }))
    expect(() => validateScenarios(scenarios)).not.toThrow()
  })

  it('rejects mismatched currencies', () => {
    const scenarios = [makeScenario({ id: 'a', currency: 'EUR' }), makeScenario({ id: 'b', currency: 'USD' })]
    expect(() => validateScenarios(scenarios)).toThrow(DecisionComparisonError)
    try {
      validateScenarios(scenarios)
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('CURRENCY_MISMATCH')
    }
  })

  it('accepts scenarios sharing the same currency', () => {
    const scenarios = [makeScenario({ id: 'a', currency: 'USD' }), makeScenario({ id: 'b', currency: 'USD' })]
    expect(() => validateScenarios(scenarios)).not.toThrow()
  })

  it('rejects a NaN metric value', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: Number.NaN } }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => validateScenarios(scenarios)).toThrow(DecisionComparisonError)
    try {
      validateScenarios(scenarios)
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('INVALID_NUMBER')
    }
  })

  it('rejects an Infinity metric value', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { residualLiquidity: Number.POSITIVE_INFINITY } }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => validateScenarios(scenarios)).toThrow(DecisionComparisonError)
  })

  it('rejects a negative-Infinity metric value', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { minimumProjectedBalance: Number.NEGATIVE_INFINITY } }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => validateScenarios(scenarios)).toThrow(DecisionComparisonError)
  })

  it('rejects NaN in dataQualityScore/confidenceLevel quality indicators', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { confidenceLevel: Number.NaN } }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => validateScenarios(scenarios)).toThrow(DecisionComparisonError)
  })

  it('allows emergencyFundMonthsAfterDecision to legitimately be null', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { emergencyFundMonthsAfterDecision: null } }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => validateScenarios(scenarios)).not.toThrow()
  })

  it('rejects a scenario missing core required metrics', () => {
    const scenarios = [
      makeScenario({ id: 'a', missingMetrics: ['residualLiquidity'] }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => validateScenarios(scenarios)).toThrow(DecisionComparisonError)
    try {
      validateScenarios(scenarios)
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('INSUFFICIENT_DATA')
    }
  })

  it('rejects a scenario classified as INSUFFICIENT_DATA', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { affordabilityClassification: 'INSUFFICIENT_DATA' } }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => validateScenarios(scenarios)).toThrow(DecisionComparisonError)
  })

  it('allows a non-core metric (e.g. estimatedResidualValue) to be missing', () => {
    const scenarios = [
      makeScenario({ id: 'a', missingMetrics: ['estimatedResidualValue'] }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => validateScenarios(scenarios)).not.toThrow()
  })
})

describe('validateWeights', () => {
  it('normalizes positive weights so they sum to 1', () => {
    const normalized = validateWeights({ initialCashOutflow: 50, totalCashOutflow: 50 })
    expect(normalized.initialCashOutflow).toBeCloseTo(0.5, 6)
    expect(normalized.totalCashOutflow).toBeCloseTo(0.5, 6)
  })

  it('defaults omitted criteria to 0', () => {
    const normalized = validateWeights({ initialCashOutflow: 1 })
    expect(normalized.estimatedResidualValue).toBe(0)
  })

  it('rejects a negative weight', () => {
    expect(() => validateWeights({ initialCashOutflow: -1 })).toThrow(DecisionComparisonError)
    try {
      validateWeights({ initialCashOutflow: -1 })
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('INVALID_WEIGHTS')
    }
  })

  it('rejects a NaN weight', () => {
    expect(() => validateWeights({ initialCashOutflow: Number.NaN })).toThrow(DecisionComparisonError)
  })

  it('rejects an Infinity weight', () => {
    expect(() => validateWeights({ initialCashOutflow: Number.POSITIVE_INFINITY })).toThrow(DecisionComparisonError)
  })

  it('rejects all-zero weights (sum must be > 0)', () => {
    expect(() => validateWeights({})).toThrow(DecisionComparisonError)
    try {
      validateWeights({})
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('INVALID_WEIGHTS')
    }
  })

  it('does not mutate the input weights object', () => {
    const input = { initialCashOutflow: 10 }
    const frozen = Object.freeze({ ...input })
    expect(() => validateWeights(frozen)).not.toThrow()
  })
})

describe('validateDecisionComparisonInput', () => {
  function baseInput(overrides: Partial<DecisionComparisonInput> = {}): DecisionComparisonInput {
    return {
      scenarios: [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })],
      profile: 'BALANCED',
      ...overrides,
    }
  }

  it('accepts a valid BALANCED input', () => {
    expect(() => validateDecisionComparisonInput(baseInput())).not.toThrow()
  })

  it('requires customWeights when profile is CUSTOM', () => {
    expect(() => validateDecisionComparisonInput(baseInput({ profile: 'CUSTOM' }))).toThrow(DecisionComparisonError)
    try {
      validateDecisionComparisonInput(baseInput({ profile: 'CUSTOM' }))
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('INVALID_WEIGHTS')
    }
  })

  it('accepts CUSTOM profile with valid customWeights', () => {
    const input = baseInput({ profile: 'CUSTOM', customWeights: { initialCashOutflow: 1 } })
    expect(() => validateDecisionComparisonInput(input)).not.toThrow()
  })

  it('rejects CUSTOM profile with invalid customWeights', () => {
    const input = baseInput({ profile: 'CUSTOM', customWeights: { initialCashOutflow: -5 } })
    expect(() => validateDecisionComparisonInput(input)).toThrow(DecisionComparisonError)
  })

  it('validates scenarios before considering weights', () => {
    const input = baseInput({ scenarios: [makeScenario({ id: 'a' })] })
    try {
      validateDecisionComparisonInput(input)
    } catch (err) {
      expect((err as DecisionComparisonError).code).toBe('TOO_FEW_SCENARIOS')
    }
  })
})
