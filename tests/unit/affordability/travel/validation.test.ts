import { describe, expect, it } from 'vitest'
import { travelInputSchema } from '@/lib/affordability/travel/validation'

const VALID = {
  simulationName: 'Vacanza',
  currency: 'EUR',
  travelers: 2,
  adults: 2,
  children: 0,
  bookingDate: '2026-07-01',
  departureDate: '2026-10-01',
  returnDate: '2026-10-07',
}

function parse(overrides: Record<string, unknown> = {}) {
  return travelInputSchema.safeParse({ ...VALID, ...overrides })
}

describe('travelInputSchema', () => {
  it('accepts minimal valid input', () => {
    expect(parse().success).toBe(true)
  })

  it('rejects invalid date order and too long trip', () => {
    expect(parse({ returnDate: '2026-09-01' }).success).toBe(false)
    expect(parse({ returnDate: '2028-01-01' }).success).toBe(false)
  })

  it('rejects booking after departure and traveler mismatch', () => {
    expect(parse({ bookingDate: '2026-11-01' }).success).toBe(false)
    expect(parse({ adults: 1, children: 0 }).success).toBe(false)
  })

  it('rejects unknown properties and negative costs', () => {
    expect(parse({ unknown: true }).success).toBe(false)
    expect(parse({ transport: { mainTrip: -1 } }).success).toBe(false)
  })

  it('validates comparison date order', () => {
    expect(parse({ compareWithTravel: { label: 'B', totalCost: 1000, departureDate: '2026-10-10', returnDate: '2026-10-01' } }).success).toBe(false)
  })
})
