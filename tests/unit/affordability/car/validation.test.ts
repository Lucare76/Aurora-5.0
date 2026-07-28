import { describe, it, expect } from 'vitest'
import { carInputSchemaFull } from '@/lib/affordability/car/validation'

const VALID: Record<string, unknown> = {
  carName: 'Toyota Yaris',
  purchasePrice: 25000,
  paymentMode: 'IMMEDIATE',
  purchaseDate: '2026-08-01',
  currency: 'EUR',
  ownershipYears: 5,
}

function parse(overrides: Record<string, unknown> = {}) {
  return carInputSchemaFull.safeParse({ ...VALID, ...overrides })
}

describe('carInputSchemaFull — required fields', () => {
  it('parses a minimal valid input', () => {
    const r = parse()
    expect(r.success).toBe(true)
  })

  it('rejects missing carName', () => {
    const r = parse({ carName: '' })
    expect(r.success).toBe(false)
  })

  it('rejects zero purchasePrice', () => {
    const r = parse({ purchasePrice: 0 })
    expect(r.success).toBe(false)
  })

  it('rejects negative purchasePrice', () => {
    const r = parse({ purchasePrice: -100 })
    expect(r.success).toBe(false)
  })

  it('rejects price above MAX_CAR_PRICE', () => {
    const r = parse({ purchasePrice: 10_000_001 })
    expect(r.success).toBe(false)
  })

  it('rejects invalid purchaseDate format', () => {
    const r = parse({ purchaseDate: '01/08/2026' })
    expect(r.success).toBe(false)
  })

  it('rejects ownershipYears below 0.5', () => {
    const r = parse({ ownershipYears: 0.4 })
    expect(r.success).toBe(false)
  })

  it('rejects ownershipYears above 20', () => {
    const r = parse({ ownershipYears: 21 })
    expect(r.success).toBe(false)
  })

  it('rejects invalid paymentMode', () => {
    const r = parse({ paymentMode: 'LEASE' })
    expect(r.success).toBe(false)
  })
})

describe('carInputSchemaFull — optional fields', () => {
  it('accepts valid condition', () => {
    const r = parse({ condition: 'new' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid condition', () => {
    const r = parse({ condition: 'rental' })
    expect(r.success).toBe(false)
  })

  it('accepts valid fuelType', () => {
    const r = parse({ fuelType: 'electric' })
    expect(r.success).toBe(true)
  })

  it('rejects annualKm above MAX_ANNUAL_KM', () => {
    const r = parse({ annualKm: 300_001 })
    expect(r.success).toBe(false)
  })
})

describe('carInputSchemaFull — FINANCING superRefine', () => {
  const financing = {
    paymentMode: 'FINANCING',
    downPayment: 5000,
  }

  it('rejects FINANCING without installmentAmount and numberOfInstallments', () => {
    const r = parse(financing)
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('installmentAmount')
    }
  })

  it('accepts FINANCING with installmentAmount', () => {
    const r = parse({ ...financing, installmentAmount: 300 })
    expect(r.success).toBe(true)
  })

  it('accepts FINANCING with numberOfInstallments', () => {
    const r = parse({ ...financing, numberOfInstallments: 60 })
    expect(r.success).toBe(true)
  })
})

describe('carInputSchemaFull — nested schemas', () => {
  it('accepts valid insurance', () => {
    const r = parse({ insurance: { rcAnnual: 1000, theftFireAnnual: 300 } })
    expect(r.success).toBe(true)
  })

  it('rejects negative insurance value', () => {
    const r = parse({ insurance: { rcAnnual: -100 } })
    expect(r.success).toBe(false)
  })

  it('accepts valid tax', () => {
    const r = parse({ tax: { bolloAnnual: 240, exempt: false } })
    expect(r.success).toBe(true)
  })

  it('rejects unknown field in nested object (strict mode)', () => {
    const r = parse({ insurance: { rcAnnual: 1000, unknownField: 99 } })
    expect(r.success).toBe(false)
  })

  it('accepts valid fuel monthly_estimate', () => {
    const r = parse({ fuel: { mode: 'monthly_estimate', monthlyEstimate: 120 } })
    expect(r.success).toBe(true)
  })

  it('rejects invalid fuelMode', () => {
    const r = parse({ fuel: { mode: 'per_liter' } })
    expect(r.success).toBe(false)
  })

  it('accepts compareWithCar', () => {
    const r = parse({
      compareWithCar: {
        carName: 'Fiat Panda',
        purchasePrice: 15000,
        paymentMode: 'IMMEDIATE',
      },
    })
    expect(r.success).toBe(true)
  })
})
