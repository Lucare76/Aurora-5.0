import { describe, expect, it } from 'vitest'
import { getCriteria, resolveWeights } from '@/lib/decision-comparison/criteria'
import { CRITERIA, PROFILE_WEIGHTS } from '@/lib/decision-comparison/constants'

describe('getCriteria', () => {
  it('returns the full criteria catalogue', () => {
    expect(getCriteria()).toEqual(CRITERIA)
  })

  it('returns a defensive copy that cannot corrupt the shared CRITERIA constant', () => {
    const criteria = getCriteria()
    criteria.pop()
    expect(getCriteria()).toHaveLength(CRITERIA.length)
  })
})

describe('resolveWeights — built-in profiles', () => {
  it.each(Object.keys(PROFILE_WEIGHTS) as Array<keyof typeof PROFILE_WEIGHTS>)(
    'resolves %s to the matching PROFILE_WEIGHTS entry',
    (profile) => {
      expect(resolveWeights(profile)).toEqual(PROFILE_WEIGHTS[profile])
    },
  )

  it('returns a defensive copy that cannot corrupt the shared PROFILE_WEIGHTS constant', () => {
    const weights = resolveWeights('BALANCED')
    weights.initialCashOutflow = 999
    expect(resolveWeights('BALANCED').initialCashOutflow).toBe(PROFILE_WEIGHTS.BALANCED.initialCashOutflow)
    expect(resolveWeights('BALANCED').initialCashOutflow).not.toBe(999)
  })
})

describe('resolveWeights — CUSTOM profile', () => {
  it('normalizes provided custom weights to sum to 1', () => {
    const weights = resolveWeights('CUSTOM', { initialCashOutflow: 25, totalCashOutflow: 75 })
    expect(weights.initialCashOutflow).toBeCloseTo(0.25, 6)
    expect(weights.totalCashOutflow).toBeCloseTo(0.75, 6)
  })

  it('defaults missing custom weight keys to 0', () => {
    const weights = resolveWeights('CUSTOM', { residualLiquidity: 1 })
    expect(weights.estimatedResidualValue).toBe(0)
  })

  it('throws when customWeights is null/undefined for CUSTOM', () => {
    expect(() => resolveWeights('CUSTOM', null)).toThrow()
    expect(() => resolveWeights('CUSTOM', undefined)).toThrow()
  })

  it('throws when all custom weights are zero', () => {
    expect(() => resolveWeights('CUSTOM', {})).toThrow()
  })
})
