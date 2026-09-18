import { describe, expect, it } from 'vitest'

function currentValueFromScalableShape(row: any) {
  const quantity = row?.position?.filled
  const unitPrice = row?.currentQuote?.midPrice
  if (typeof quantity !== 'number' || typeof unitPrice !== 'number') return null
  return quantity * unitPrice
}

describe('Scalable exact holdings shape', () => {
  it('derives market value from position.filled and currentQuote.midPrice', () => {
    expect(currentValueFromScalableShape({
      isin: 'IE00TEST',
      position: { filled: 24.125452, blocked: 0, pending: 0 },
      currentQuote: { currency: 'EUR', midPrice: 167.97 },
    })).toBeCloseTo(4052.35, 2)
  })
})
