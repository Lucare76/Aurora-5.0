import { describe, expect, it } from 'vitest'
import {
  computeInstallmentFinancingCost,
  computeNetTotalCost,
  mapDataQualityToScore,
  safeNumber,
} from '@/lib/decision-comparison/metrics'

describe('mapDataQualityToScore', () => {
  it('maps every known data quality tier', () => {
    expect(mapDataQualityToScore('ALTA')).toBe(100)
    expect(mapDataQualityToScore('MEDIA')).toBe(66)
    expect(mapDataQualityToScore('BASSA')).toBe(33)
    expect(mapDataQualityToScore('INSUFFICIENTE')).toBe(0)
  })
})

describe('computeNetTotalCost', () => {
  it('subtracts residual value from total cash outflow', () => {
    expect(computeNetTotalCost(20000, 5000)).toBe(15000)
  })

  it('rounds to money precision', () => {
    expect(computeNetTotalCost(10.005, 0.001)).toBeCloseTo(10.0, 2)
  })

  it('can go negative when residual value exceeds outflow', () => {
    expect(computeNetTotalCost(1000, 5000)).toBe(-4000)
  })
})

describe('computeInstallmentFinancingCost', () => {
  it('isolates the financing markup over the purchase cost', () => {
    expect(computeInstallmentFinancingCost(22000, 20000)).toBe(2000)
  })

  it('never returns a negative financing cost', () => {
    expect(computeInstallmentFinancingCost(18000, 20000)).toBe(0)
  })

  it('is zero when installments cost exactly the purchase price', () => {
    expect(computeInstallmentFinancingCost(20000, 20000)).toBe(0)
  })
})

describe('safeNumber', () => {
  it('returns the value when present', () => {
    expect(safeNumber(42)).toBe(42)
  })

  it('falls back to 0 by default for null/undefined', () => {
    expect(safeNumber(null)).toBe(0)
    expect(safeNumber(undefined)).toBe(0)
  })

  it('honors a custom fallback', () => {
    expect(safeNumber(null, -1)).toBe(-1)
    expect(safeNumber(undefined, 7)).toBe(7)
  })

  it('preserves a genuine zero (does not treat it as missing)', () => {
    expect(safeNumber(0, 99)).toBe(0)
  })
})
