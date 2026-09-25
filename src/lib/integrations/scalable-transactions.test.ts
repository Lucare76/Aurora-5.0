import { describe, expect, it } from 'vitest'
import { investedAmountFromTransactions } from './scalable'

const isin = 'IE00BG0J4C88'
const buy = {
  kind: 'security', status: 'SETTLED', isCancellation: false,
  security: { isin, side: 'BUY', amount: '-100', quantity: '8.60289' },
}

describe('Scalable cost basis from completed purchases', () => {
  it('records the paid amount, preserving a loss against the current value', () => {
    expect(investedAmountFromTransactions({ page: { nextCursor: null }, transactions: [buy] }, isin, 8.60289)).toBe(100)
    expect(98.28 - 100).toBeCloseTo(-1.72, 2)
    expect(investedAmountFromTransactions({
      page: { nextCursor: null },
      transactions: [{ ...buy, security: { isin: 'IE00BF4RFH31', side: 'BUY', amount: '-50', quantity: '5.543237' } }],
    }, 'IE00BF4RFH31', 5.543237)).toBe(50)
  })

  it('does not guess when history is paginated, sold, or units do not match', () => {
    expect(investedAmountFromTransactions({ page: { nextCursor: 'more' }, transactions: [buy] }, isin, 8.60289)).toBeNull()
    expect(investedAmountFromTransactions({ page: { nextCursor: null }, transactions: [buy] }, isin, 10)).toBeNull()
    expect(investedAmountFromTransactions({ page: { nextCursor: null }, transactions: [{ ...buy, security: { ...buy.security, side: 'SELL' } }] }, isin, 8.60289)).toBeNull()
  })
})
