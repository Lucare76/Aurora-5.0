import { describe, expect, it } from 'vitest'
import {
  CRITERION_KEYS,
  DECISION_COMPARISON_ENGINE_VERSION,
  LIQUIDITY_CRITERIA,
  MAX_SCENARIOS,
  MIN_SCENARIOS,
  PROFILE_WEIGHTS,
} from '@/lib/decision-comparison/constants'

const PROFILES = Object.keys(PROFILE_WEIGHTS) as Array<keyof typeof PROFILE_WEIGHTS>

describe('PROFILE_WEIGHTS', () => {
  it.each(PROFILES)('%s sums to 1 across all criteria', (profile) => {
    const sum = CRITERION_KEYS.reduce((acc, key) => acc + PROFILE_WEIGHTS[profile][key], 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it.each(PROFILES)('%s gives every criterion a non-negative weight', (profile) => {
    for (const key of CRITERION_KEYS) {
      expect(PROFILE_WEIGHTS[profile][key]).toBeGreaterThanOrEqual(0)
    }
  })

  it.each(PROFILES)(
    '%s weighs liquidity criteria higher than estimatedResidualValue (Sprint 24A invariant)',
    (profile) => {
      const liquidityWeight = LIQUIDITY_CRITERIA.reduce((acc, key) => acc + PROFILE_WEIGHTS[profile][key], 0)
      expect(liquidityWeight).toBeGreaterThan(PROFILE_WEIGHTS[profile].estimatedResidualValue)
    },
  )
})

describe('module constants', () => {
  it('defines a semantic engine version', () => {
    expect(DECISION_COMPARISON_ENGINE_VERSION).toMatch(/^\d+\S*\.\d+\.\d+$/)
  })

  it('requires between 2 and 4 scenarios', () => {
    expect(MIN_SCENARIOS).toBe(2)
    expect(MAX_SCENARIOS).toBe(4)
  })

  it('lists every criterion key exactly once', () => {
    expect(new Set(CRITERION_KEYS).size).toBe(CRITERION_KEYS.length)
  })
})
