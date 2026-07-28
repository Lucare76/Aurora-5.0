import { describe, expect, it } from 'vitest'
import { homeInputSchema } from '@/lib/affordability/home/validation'

const VALID = {
  simulationName: 'Casa test',
  condition: 'used',
  purpose: 'primary_home',
  askingPrice: 220000,
  agreedPrice: 210000,
  purchaseDate: '2026-09-01',
  currency: 'EUR',
  ownershipYears: 20,
  paymentMode: 'MORTGAGE',
  downPayment: 40000,
  mortgageAmount: 170000,
  mortgageDurationMonths: 300,
  mortgageMonthlyPayment: 720,
}

function parse(overrides: Record<string, unknown> = {}) {
  return homeInputSchema.safeParse({ ...VALID, ...overrides })
}

describe('homeInputSchema', () => {
  it('accepts a valid mortgage input', () => {
    expect(parse().success).toBe(true)
  })

  it('rejects unknown properties in strict mode', () => {
    expect(parse({ hiddenField: true }).success).toBe(false)
  })

  it('rejects invalid dates and zero prices', () => {
    expect(parse({ purchaseDate: '01/09/2026' }).success).toBe(false)
    expect(parse({ agreedPrice: 0 }).success).toBe(false)
  })

  it('rejects deposit and down payment above agreed price', () => {
    expect(parse({ depositPaid: 300000 }).success).toBe(false)
    expect(parse({ downPayment: 300000 }).success).toBe(false)
  })

  it('requires mortgage payment and duration for mortgage mode', () => {
    expect(parse({ mortgageMonthlyPayment: null }).success).toBe(false)
    expect(parse({ mortgageDurationMonths: null }).success).toBe(false)
  })

  it('accepts immediate payment without mortgage fields', () => {
    expect(parse({
      paymentMode: 'IMMEDIATE',
      cashPaymentAmount: 210000,
      downPayment: null,
      mortgageAmount: null,
      mortgageDurationMonths: null,
      mortgageMonthlyPayment: null,
    }).success).toBe(true)
  })

  it('rejects percentages and durations outside limits', () => {
    expect(parse({ tan: 101 }).success).toBe(false)
    expect(parse({ mortgageDurationMonths: 601 }).success).toBe(false)
    expect(parse({ ownershipYears: 61 }).success).toBe(false)
    expect(parse({ surfaceSqm: 20001 }).success).toBe(false)
  })

  it('rejects incoherent mortgage amount and residual debt', () => {
    expect(parse({ mortgageAmount: 400000 }).success).toBe(false)
    expect(parse({ residualValue: { residualMortgageDebt: 400000 } }).success).toBe(false)
  })

  it('accepts nullable optional nested objects and known enums', () => {
    expect(parse({
      description: null,
      currentHousing: { type: 'owned_no_mortgage' },
      recurringTaxes: { exempt: true, exemptionYears: 5, paymentMonths: [6, 12] },
      maintenance: { roofEvent: { amount: 10000, months: 120, mode: 'one_time' } },
    }).success).toBe(true)
  })

  it('derives mortgage amount during validation when omitted', () => {
    expect(parse({ mortgageAmount: null, downPayment: 50000 }).success).toBe(true)
  })

  it('rejects invalid nested enum and invalid UUID', () => {
    expect(parse({ currentHousing: { type: 'hotel' } }).success).toBe(false)
    expect(parse({ accountId: 'not-a-uuid' }).success).toBe(false)
  })
})
