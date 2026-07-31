import { describe, expect, it } from 'vitest'
import { compareDecisions } from '@/lib/decision-comparison/engine'
import { DECISION_COMPARISON_ENGINE_VERSION, DISCLAIMER } from '@/lib/decision-comparison/constants'
import { DecisionComparisonError } from '@/lib/decision-comparison/types'
import type { DecisionComparisonInput } from '@/lib/decision-comparison/types'
import { makeScenario } from './fixtures'

const NOW = new Date('2026-07-31T10:00:00Z')

function baseInput(overrides: Partial<DecisionComparisonInput> = {}): DecisionComparisonInput {
  return {
    scenarios: [
      makeScenario({ id: 'a', name: 'Opzione A', metrics: { totalCashOutflow: 20000 } }),
      makeScenario({ id: 'b', name: 'Opzione B', metrics: { totalCashOutflow: 30000 } }),
    ],
    profile: 'BALANCED',
    ...overrides,
  }
}

describe('compareDecisions — happy paths', () => {
  it('produces a full result with the minimum of 2 scenarios', () => {
    const result = compareDecisions(baseInput(), NOW)
    expect(result.scores).toHaveLength(2)
    expect(result.ranking).toHaveLength(2)
    expect(result.engineVersion).toBe(DECISION_COMPARISON_ENGINE_VERSION)
    expect(result.calculatedAt).toBe(NOW.toISOString())
    expect(result.disclaimer).toBe(DISCLAIMER)
  })

  it('produces a full result with the maximum of 4 scenarios', () => {
    const scenarios = ['a', 'b', 'c', 'd'].map((id, i) =>
      makeScenario({ id, name: `Opzione ${id}`, metrics: { totalCashOutflow: 10000 + i * 5000 } }),
    )
    const result = compareDecisions(baseInput({ scenarios }), NOW)
    expect(result.scores).toHaveLength(4)
    expect(result.ranking).toHaveLength(4)
    expect(result.tradeoffs).toHaveLength(6)
  })

  it('supports every built-in comparison profile', () => {
    const profiles: DecisionComparisonInput['profile'][] = [
      'BALANCED',
      'PROTECT_LIQUIDITY',
      'REDUCE_TOTAL_COST',
      'REDUCE_MONTHLY_COMMITMENT',
      'AVOID_DEBT',
      'PRESERVE_EMERGENCY_FUND',
    ]
    for (const profile of profiles) {
      const result = compareDecisions(baseInput({ profile }), NOW)
      expect(result.profile).toBe(profile)
      expect(result.scores).toHaveLength(2)
    }
  })

  it('supports the CUSTOM profile with custom weights', () => {
    const result = compareDecisions(
      baseInput({ profile: 'CUSTOM', customWeights: { totalCashOutflow: 100 } }),
      NOW,
    )
    expect(result.weightsUsed.totalCashOutflow).toBeCloseTo(1, 6)
    expect(result.ranking.find((r) => r.scenarioId === 'a')!.rank).toBe(1)
  })

  it('compares scenarios across different domains (cross-domain / FINANCIAL_ONLY)', () => {
    const scenarios = [
      makeScenario({ id: 'car', type: 'CAR_PURCHASE', metrics: { totalCashOutflow: 20000 } }),
      makeScenario({ id: 'home', type: 'HOME_PURCHASE', metrics: { totalCashOutflow: 200000 } }),
    ]
    const result = compareDecisions(baseInput({ scenarios }), NOW)
    expect(result.compatibility.level).toBe('FINANCIAL_ONLY')
    expect(result.compatibility.sameType).toBe(false)
  })

  it('reports FULL compatibility for same-domain scenarios', () => {
    const scenarios = [
      makeScenario({ id: 'a', type: 'TRAVEL_PURCHASE' }),
      makeScenario({ id: 'b', type: 'TRAVEL_PURCHASE' }),
    ]
    const result = compareDecisions(baseInput({ scenarios }), NOW)
    expect(result.compatibility.level).toBe('FULL')
  })

  it('treats identical scenarios as a full parity tie', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const result = compareDecisions(baseInput({ scenarios }), NOW)
    expect(result.ranking.every((r) => r.isTie)).toBe(true)
    expect(result.dominance).toHaveLength(0)
  })
})

describe('compareDecisions — validation errors propagate', () => {
  it('rejects fewer than 2 scenarios', () => {
    expect(() => compareDecisions(baseInput({ scenarios: [makeScenario({ id: 'a' })] }), NOW)).toThrow(
      DecisionComparisonError,
    )
  })

  it('rejects more than 4 scenarios', () => {
    const scenarios = ['a', 'b', 'c', 'd', 'e'].map((id) => makeScenario({ id }))
    expect(() => compareDecisions(baseInput({ scenarios }), NOW)).toThrow(DecisionComparisonError)
  })

  it('rejects mismatched currencies', () => {
    const scenarios = [makeScenario({ id: 'a', currency: 'EUR' }), makeScenario({ id: 'b', currency: 'USD' })]
    expect(() => compareDecisions(baseInput({ scenarios }), NOW)).toThrow(DecisionComparisonError)
  })

  it('rejects NaN/Infinity metric values', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: Number.NaN } }),
      makeScenario({ id: 'b' }),
    ]
    expect(() => compareDecisions(baseInput({ scenarios }), NOW)).toThrow(DecisionComparisonError)
  })

  it('rejects CUSTOM profile without customWeights', () => {
    expect(() => compareDecisions(baseInput({ profile: 'CUSTOM' }), NOW)).toThrow(DecisionComparisonError)
  })
})

describe('compareDecisions — immutability', () => {
  it('does not mutate the input scenarios array or its objects', () => {
    const input = baseInput()
    const before = JSON.parse(JSON.stringify(input))
    compareDecisions(input, NOW)
    expect(input).toEqual(before)
  })

  it('does not mutate custom weights passed by the caller', () => {
    const customWeights = { totalCashOutflow: 100 }
    const input = baseInput({ profile: 'CUSTOM', customWeights })
    const before = { ...customWeights }
    compareDecisions(input, NOW)
    expect(customWeights).toEqual(before)
  })

  it('returns a weightsUsed object that does not alias PROFILE_WEIGHTS internals across calls', () => {
    const first = compareDecisions(baseInput({ profile: 'BALANCED' }), NOW)
    first.weightsUsed.totalCashOutflow = 999
    const second = compareDecisions(baseInput({ profile: 'BALANCED' }), NOW)
    expect(second.weightsUsed.totalCashOutflow).not.toBe(999)
  })

  it('does not mutate frozen input scenarios (deep freeze guard)', () => {
    const scenario = makeScenario({ id: 'a' })
    Object.freeze(scenario)
    Object.freeze(scenario.metrics)
    Object.freeze(scenario.missingMetrics)
    const input = baseInput({ scenarios: [scenario, makeScenario({ id: 'b' })] })
    expect(() => compareDecisions(input, NOW)).not.toThrow()
  })
})
