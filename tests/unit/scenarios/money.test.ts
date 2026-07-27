import { describe, it, expect } from 'vitest'
import {
  roundMoney, addMoney, subtractMoney, multiplyMoney,
  sumMoney, distributeEvenly, averageMoney,
} from '@/lib/scenarios/money'

describe('roundMoney', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(1.004)).toBe(1.00)
    expect(roundMoney(100)).toBe(100)
  })

  it('handles negative values', () => {
    expect(roundMoney(-1.005)).toBe(-1)
    expect(roundMoney(-0.004)).toBe(-0)
  })
})

describe('addMoney', () => {
  it('adds two amounts', () => {
    expect(addMoney(1.1, 2.2)).toBe(3.30)
    expect(addMoney(0, 0)).toBe(0)
  })
})

describe('subtractMoney', () => {
  it('subtracts two amounts', () => {
    expect(subtractMoney(3.3, 1.1)).toBe(2.20)
  })
})

describe('multiplyMoney', () => {
  it('multiplies amount by factor', () => {
    expect(multiplyMoney(10, 3)).toBe(30)
    expect(multiplyMoney(10.5, 2)).toBe(21)
  })
})

describe('sumMoney', () => {
  it('sums an array of amounts', () => {
    expect(sumMoney([1, 2, 3])).toBe(6)
    expect(sumMoney([])).toBe(0)
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.60)
  })
})

describe('distributeEvenly', () => {
  it('distributes total across periods', () => {
    const parts = distributeEvenly(100, 3)
    expect(parts).toHaveLength(3)
    // Sum should be 100 (within rounding)
    const total = parts.reduce((a, b) => a + b, 0)
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(0.02)
  })

  it('returns [] for 0 periods', () => {
    expect(distributeEvenly(100, 0)).toEqual([])
  })
})

describe('averageMoney', () => {
  it('computes average', () => {
    expect(averageMoney([10, 20, 30])).toBe(20)
  })

  it('returns 0 for empty array', () => {
    expect(averageMoney([])).toBe(0)
  })
})
