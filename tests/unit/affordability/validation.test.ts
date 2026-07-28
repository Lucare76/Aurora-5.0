import { describe, it, expect } from 'vitest'
import { affordabilityInputSchema } from '@/lib/affordability/validation'

const BASE_IMMEDIATE = {
  purchaseName: 'Auto usata',
  totalPrice: 8000,
  paymentMode: 'IMMEDIATE' as const,
  purchaseDate: '2026-08-01',
  currency: 'EUR',
}

const BASE_INSTALLMENTS = {
  purchaseName: 'Auto nuova',
  totalPrice: 20000,
  paymentMode: 'INSTALLMENTS' as const,
  purchaseDate: '2026-08-01',
  currency: 'EUR',
  installmentAmount: 350,
  numberOfInstallments: 48,
}

describe('affordabilityInputSchema', () => {
  describe('purchaseName', () => {
    it('accepts a valid name', () => {
      expect(affordabilityInputSchema.safeParse(BASE_IMMEDIATE).success).toBe(true)
    })

    it('rejects empty name', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, purchaseName: '' })
      expect(r.success).toBe(false)
    })

    it('rejects name longer than 120 chars', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, purchaseName: 'A'.repeat(121) })
      expect(r.success).toBe(false)
    })

    it('accepts name exactly 120 chars', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, purchaseName: 'A'.repeat(120) })
      expect(r.success).toBe(true)
    })
  })

  describe('totalPrice', () => {
    it('rejects zero price', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, totalPrice: 0 })
      expect(r.success).toBe(false)
    })

    it('rejects negative price', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, totalPrice: -1 })
      expect(r.success).toBe(false)
    })

    it('rejects price above 10 million', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, totalPrice: 10_000_001 })
      expect(r.success).toBe(false)
    })

    it('accepts price exactly 10 million', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, totalPrice: 10_000_000 })
      expect(r.success).toBe(true)
    })

    it('rejects non-finite price', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, totalPrice: Infinity })
      expect(r.success).toBe(false)
    })
  })

  describe('paymentMode', () => {
    it('accepts IMMEDIATE', () => {
      expect(affordabilityInputSchema.safeParse(BASE_IMMEDIATE).success).toBe(true)
    })

    it('accepts INSTALLMENTS', () => {
      expect(affordabilityInputSchema.safeParse(BASE_INSTALLMENTS).success).toBe(true)
    })

    it('rejects unknown mode', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, paymentMode: 'CASH' })
      expect(r.success).toBe(false)
    })
  })

  describe('purchaseDate', () => {
    it('rejects non-date string', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, purchaseDate: 'not-a-date' })
      expect(r.success).toBe(false)
    })

    it('rejects wrong format', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, purchaseDate: '01/08/2026' })
      expect(r.success).toBe(false)
    })

    it('accepts ISO date', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, purchaseDate: '2026-12-31' })
      expect(r.success).toBe(true)
    })
  })

  describe('currency', () => {
    it('defaults to EUR', () => {
      const input = { ...BASE_IMMEDIATE }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (input as any).currency
      const r = affordabilityInputSchema.safeParse(input)
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.currency).toBe('EUR')
    })

    it('rejects currency shorter than 3 chars', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, currency: 'EU' })
      expect(r.success).toBe(false)
    })

    it('rejects currency longer than 3 chars', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, currency: 'EURO' })
      expect(r.success).toBe(false)
    })
  })

  describe('INSTALLMENTS mode cross-field validation', () => {
    it('rejects INSTALLMENTS without installmentAmount and numberOfInstallments', () => {
      const r = affordabilityInputSchema.safeParse({
        ...BASE_IMMEDIATE,
        paymentMode: 'INSTALLMENTS',
      })
      expect(r.success).toBe(false)
    })

    it('accepts INSTALLMENTS with both installmentAmount and numberOfInstallments', () => {
      const r = affordabilityInputSchema.safeParse(BASE_INSTALLMENTS)
      expect(r.success).toBe(true)
    })

    it('rejects numberOfInstallments > 360', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_INSTALLMENTS, numberOfInstallments: 361 })
      expect(r.success).toBe(false)
    })

    it('accepts numberOfInstallments = 360', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_INSTALLMENTS, numberOfInstallments: 360 })
      expect(r.success).toBe(true)
    })

    it('rejects non-integer numberOfInstallments', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_INSTALLMENTS, numberOfInstallments: 12.5 })
      expect(r.success).toBe(false)
    })

    it('rejects negative downPayment', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_INSTALLMENTS, downPayment: -100 })
      expect(r.success).toBe(false)
    })

    it('accepts zero downPayment', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_INSTALLMENTS, downPayment: 0 })
      expect(r.success).toBe(true)
    })
  })

  describe('optional optional costs', () => {
    it('accepts additionalUpfrontCosts', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, additionalUpfrontCosts: 500 })
      expect(r.success).toBe(true)
    })

    it('rejects negative additionalUpfrontCosts', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, additionalUpfrontCosts: -1 })
      expect(r.success).toBe(false)
    })

    it('accepts monthlyRecurringCost', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, monthlyRecurringCost: 50 })
      expect(r.success).toBe(true)
    })

    it('accepts annualRecurringCost', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, annualRecurringCost: 600 })
      expect(r.success).toBe(true)
    })
  })

  describe('preferences', () => {
    it('rejects minimumLiquidityMonths > 24', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, minimumLiquidityMonths: 25 })
      expect(r.success).toBe(false)
    })

    it('accepts minimumLiquidityMonths = 0', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, minimumLiquidityMonths: 0 })
      expect(r.success).toBe(true)
    })

    it('rejects maxInstallmentToMarginRatio > 1', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, maxInstallmentToMarginRatio: 1.1 })
      expect(r.success).toBe(false)
    })

    it('accepts maxInstallmentToMarginRatio = 0', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, maxInstallmentToMarginRatio: 0 })
      expect(r.success).toBe(true)
    })

    it('rejects horizonMonths > 24', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, horizonMonths: 25 })
      expect(r.success).toBe(false)
    })

    it('rejects horizonMonths = 0', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, horizonMonths: 0 })
      expect(r.success).toBe(false)
    })
  })

  describe('notes', () => {
    it('rejects notes longer than 1000 chars', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, notes: 'A'.repeat(1001) })
      expect(r.success).toBe(false)
    })

    it('accepts notes exactly 1000 chars', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, notes: 'A'.repeat(1000) })
      expect(r.success).toBe(true)
    })
  })

  describe('strict mode', () => {
    it('rejects unknown fields', () => {
      const r = affordabilityInputSchema.safeParse({ ...BASE_IMMEDIATE, unknownField: 'foo' })
      expect(r.success).toBe(false)
    })
  })
})
