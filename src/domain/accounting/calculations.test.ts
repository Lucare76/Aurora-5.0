import { describe, expect, it } from 'vitest'

import {
  aggregateExpenseByRootCategory,
  applyTransactionToBalances,
  applyTransactions,
  calculateMonthlyTotals,
  getMonthRange,
  roundCurrency,
} from './calculations'
import {
  accountIds,
  categories,
  initialBalances,
  transactions,
} from '../../../tests/fixtures/accounting-fixture'

describe('accounting calculations', () => {
  it('rounds currency values to two decimals', () => {
    expect(roundCurrency(10.335)).toBe(10.34)
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3)
  })

  it('returns stable month ranges for regular months, leap years and year boundaries', () => {
    expect(getMonthRange(2026, 1)).toEqual({ start: '2026-01-01', end: '2026-01-31' })
    expect(getMonthRange(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(getMonthRange(2024, 2)).toEqual({ start: '2024-02-01', end: '2024-02-29' })
    expect(getMonthRange(2026, 12)).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })

  it('calculates monthly income, expenses and net while excluding linked transfers', () => {
    expect(calculateMonthlyTotals(transactions, 2026, 1)).toEqual({
      income: 1000,
      expense: 860.99,
      net: 139.01,
    })

    expect(calculateMonthlyTotals(transactions, 2026, 2)).toEqual({
      income: 1000,
      expense: 350.34,
      net: 649.66,
    })
  })

  it('applies income and expense transactions to a single account balance', () => {
    const afterIncome = applyTransactionToBalances(initialBalances, {
      id: 'tx-income',
      account_id: accountIds.checking,
      amount: 125.5,
      type: 'income',
      date: '2026-03-01',
    })

    expect(afterIncome[accountIds.checking]).toBe(625.5)

    const afterExpense = applyTransactionToBalances(afterIncome, {
      id: 'tx-expense',
      account_id: accountIds.checking,
      amount: 25.25,
      type: 'expense',
      date: '2026-03-02',
    })

    expect(afterExpense[accountIds.checking]).toBe(600.25)
  })

  it('applies transfer transactions to source and destination balances', () => {
    const balances = applyTransactionToBalances(initialBalances, {
      id: 'tx-transfer',
      account_id: accountIds.checking,
      amount: 100,
      type: 'transfer',
      date: '2026-03-03',
      transfer_peer_id: accountIds.creditCard,
    })

    expect(balances[accountIds.checking]).toBe(400)
    expect(balances[accountIds.creditCard]).toBe(300)
  })

  it('applies a deterministic multi-month fixture without merging duplicate transactions', () => {
    const balances = applyTransactions(initialBalances, transactions)

    expect(balances[accountIds.checking]).toBe(1238.68)
    expect(balances[accountIds.creditCard]).toBe(300)
  })

  it('aggregates child categories into the root category and keeps uncategorized expenses separate', () => {
    const totals = aggregateExpenseByRootCategory(transactions, categories)

    expect(totals).toEqual([
      {
        categoryId: 'category-home',
        total: 700,
        transactionCount: 1,
      },
      {
        categoryId: 'category-food',
        total: 490,
        transactionCount: 4,
      },
      {
        categoryId: 'uncategorized',
        total: 21.33,
        transactionCount: 2,
      },
    ])
  })
})
