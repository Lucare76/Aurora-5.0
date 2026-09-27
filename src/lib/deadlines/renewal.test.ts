import { describe, expect, it } from 'vitest'
import { nextRenewalDate } from './renewal'

describe('deadline renewal', () => {
  it('advances licence and vehicle inspection dates', () => {
    expect(nextRenewalDate('2026-09-27', 'YEARLY', 10)).toBe('2036-09-27')
    expect(nextRenewalDate('2026-09-27', 'YEARLY', 2)).toBe('2028-09-27')
  })

  it('supports arbitrary month intervals and calendar ends', () => {
    expect(nextRenewalDate('2026-09-27', 'MONTHLY', 5)).toBe('2027-02-27')
    expect(nextRenewalDate('2028-02-29', 'YEARLY', 1)).toBe('2029-02-28')
    expect(nextRenewalDate('2026-01-31', 'MONTHLY', 1)).toBe('2026-02-28')
  })
})
