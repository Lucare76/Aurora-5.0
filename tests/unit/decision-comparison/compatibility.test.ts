import { describe, expect, it } from 'vitest'
import { determineCompatibility } from '@/lib/decision-comparison/compatibility'
import { CRITERION_KEYS } from '@/lib/decision-comparison/constants'
import { makeScenario } from './fixtures'

describe('determineCompatibility', () => {
  it('returns FULL when every scenario shares the same domain type', () => {
    const scenarios = [
      makeScenario({ id: 'a', type: 'CAR_PURCHASE' }),
      makeScenario({ id: 'b', type: 'CAR_PURCHASE' }),
    ]
    const result = determineCompatibility(scenarios)
    expect(result.level).toBe('FULL')
    expect(result.sameType).toBe(true)
  })

  it('returns FINANCIAL_ONLY when domain types differ', () => {
    const scenarios = [
      makeScenario({ id: 'a', type: 'CAR_PURCHASE' }),
      makeScenario({ id: 'b', type: 'HOME_PURCHASE' }),
    ]
    const result = determineCompatibility(scenarios)
    expect(result.level).toBe('FINANCIAL_ONLY')
    expect(result.sameType).toBe(false)
  })

  it('reports the shared currency', () => {
    const scenarios = [makeScenario({ id: 'a', currency: 'USD' }), makeScenario({ id: 'b', currency: 'USD' })]
    expect(determineCompatibility(scenarios).currency).toBe('USD')
  })

  it('exposes every criterion as usable regardless of compatibility level', () => {
    const scenarios = [
      makeScenario({ id: 'a', type: 'TRAVEL_PURCHASE' }),
      makeScenario({ id: 'b', type: 'HOME_PURCHASE' }),
    ]
    const result = determineCompatibility(scenarios)
    expect(result.usableCriteria).toEqual(CRITERION_KEYS)
  })

  it('does not let a caller mutating the returned usableCriteria corrupt CRITERION_KEYS', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const result = determineCompatibility(scenarios)
    result.usableCriteria.push('estimatedResidualValue')
    expect(CRITERION_KEYS).not.toContain(undefined)
    expect(CRITERION_KEYS.length).toBe(14)
  })
})
