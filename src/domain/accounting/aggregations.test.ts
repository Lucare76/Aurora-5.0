import { describe, expect, it } from 'vitest'

import {
  calculateAccountBalance,
  calculateAccountBalances,
  calculateCategoryTotals,
  calculateExpenseTotal,
  calculateIncomeTotal,
  calculateMonthlyTotals,
  calculateNetTotal,
  calculateNetWorth,
  calculateTransferTotal,
  filterTransactionsByDateRange,
  groupTransactionsByMonth,
  isCountableExpense,
  isCountableIncome,
  isValidTransfer,
  rollupToParentCategory,
} from './aggregations'
import {
  expectedRich,
  richAccounts,
  richAppTransactions,
  richCategories,
  richTransactions,
} from '../../../tests/fixtures/accounting-rich-fixture'

describe('accounting aggregations', () => {
  it('calculates income totals excluding legacy transfer peers', () => {
    const december = filterTransactionsByDateRange(richAppTransactions, '2025-12-01', '2025-12-31')
    expect(calculateIncomeTotal(december)).toBe(expectedRich.december2025.income)
  })

  it('calculates expense totals excluding legacy transfer peers', () => {
    const december = filterTransactionsByDateRange(richAppTransactions, '2025-12-01', '2025-12-31')
    expect(calculateExpenseTotal(december)).toBe(expectedRich.december2025.expense)
  })

  it('calculates net totals without transfers', () => {
    const january = filterTransactionsByDateRange(richAppTransactions, '2026-01-01', '2026-01-31')
    expect(calculateNetTotal(january)).toBe(expectedRich.january2026.net)
  })

  it('calculates transfer totals once for old peer model', () => {
    const december = filterTransactionsByDateRange(richAppTransactions, '2025-12-01', '2025-12-31')
    expect(calculateTransferTotal(december)).toBe(expectedRich.december2025.transfer)
  })

  it('calculates transfer totals for new destination-account model', () => {
    const january = filterTransactionsByDateRange(richAppTransactions, '2026-01-01', '2026-01-31')
    expect(calculateTransferTotal(january)).toBe(expectedRich.january2026.transfer)
  })

  it('does not count orphan or invalid transfers as valid transfers', () => {
    const march = filterTransactionsByDateRange(richAppTransactions, '2026-03-01', '2026-03-31')
    expect(calculateTransferTotal(march)).toBe(0)
  })

  it('filters transactions by inclusive date range', () => {
    const rows = filterTransactionsByDateRange(richAppTransactions, '2026-01-05', '2026-01-12')
    expect(rows.map((row) => row.id)).toEqual(['tx-2026-salary-jan', 'tx-2026-rent-jan', 'tx-2026-food-jan'])
  })

  it('groups transactions by month key', () => {
    const groups = groupTransactionsByMonth(richAppTransactions)
    expect(Object.keys(groups).sort()).toEqual(['2024-02', '2025-12', '2026-01', '2026-02', '2026-03'])
  })

  it('calculates monthly totals for all months', () => {
    const totals = calculateMonthlyTotals(richAppTransactions)
    expect(totals.find((row) => row.key === '2025-12')).toMatchObject(expectedRich.december2025)
    expect(totals.find((row) => row.key === '2026-01')).toMatchObject(expectedRich.january2026)
  })

  it('handles leap-year dates in monthly totals', () => {
    const totals = calculateMonthlyTotals(richAppTransactions)
    expect(totals.find((row) => row.key === '2024-02')).toMatchObject(expectedRich.february2024)
  })

  it('handles negative months in monthly totals', () => {
    const totals = calculateMonthlyTotals(richAppTransactions)
    expect(totals.find((row) => row.key === '2026-03')).toMatchObject(expectedRich.march2026)
  })

  it('calculates net worth from active account balances', () => {
    expect(calculateNetWorth(richAccounts)).toBe(expectedRich.netWorth)
  })

  it('ignores inactive accounts in net worth', () => {
    expect(calculateNetWorth([...richAccounts, { ...richAccounts[0], id: 'inactive', balance: 9999, is_active: false }])).toBe(expectedRich.netWorth)
  })

  it('calculates account balances from opening balances and transaction effects', () => {
    const balances = calculateAccountBalances(richAccounts, richAppTransactions)
    expect(balances['acct-bank']).toBe(5139.56)
    expect(balances['acct-savings']).toBe(10800)
    expect(balances['acct-card']).toBe(-340)
  })

  it('calculates a single account balance', () => {
    expect(calculateAccountBalance('acct-bank', richAppTransactions, 5000)).toBe(5139.56)
  })

  it('rolls child categories to their parent', () => {
    expect(rollupToParentCategory('cat-rent', richCategories)).toBe('cat-home')
    expect(rollupToParentCategory('cat-market', richCategories)).toBe('cat-food')
  })

  it('keeps root categories as their own rollup key', () => {
    expect(rollupToParentCategory('cat-food', richCategories)).toBe('cat-food')
  })

  it('uses no-category for missing categories', () => {
    expect(rollupToParentCategory(null, richCategories)).toBe('no-category')
    expect(rollupToParentCategory('missing', richCategories)).toBe('no-category')
  })

  it('calculates category totals with parent rollup', () => {
    const totals = calculateCategoryTotals(richAppTransactions, richCategories)
    expect(totals).toEqual([
      { categoryId: 'cat-home', amount: expectedRich.categoryTotals.home, count: 3 },
      { categoryId: 'cat-food', amount: expectedRich.categoryTotals.food, count: 4 },
      { categoryId: 'no-category', amount: expectedRich.categoryTotals.uncategorized, count: 1 },
    ])
  })

  it('marks only non-transfer income as countable income', () => {
    const income = richAppTransactions.find((tx) => tx.id === 'tx-2026-salary-jan')
    const peerIncome = richAppTransactions.find((tx) => tx.id === 'tx-2025-legacy-in')
    expect(income && isCountableIncome(income)).toBe(true)
    expect(peerIncome && isCountableIncome(peerIncome)).toBe(false)
  })

  it('marks only non-transfer expense as countable expense', () => {
    const expense = richAppTransactions.find((tx) => tx.id === 'tx-2026-rent-jan')
    const peerExpense = richAppTransactions.find((tx) => tx.id === 'tx-2025-legacy-out')
    expect(expense && isCountableExpense(expense)).toBe(true)
    expect(peerExpense && isCountableExpense(peerExpense)).toBe(false)
  })

  it('recognizes old and new transfer models as valid', () => {
    expect(isValidTransfer(richAppTransactions.find((tx) => tx.id === 'tx-2025-legacy-out')!)).toBe(true)
    expect(isValidTransfer(richAppTransactions.find((tx) => tx.id === 'tx-2026-new-transfer')!)).toBe(true)
  })

  it('does not recognize orphan transfer models as valid', () => {
    expect(isValidTransfer(richAppTransactions.find((tx) => tx.id === 'tx-2026-invalid-transfer')!)).toBe(false)
  })

  it('matches the legacy dashboard/report income formula on the fixture', () => {
    const legacy = richTransactions
      .filter((tx) => tx.type === 'income' && !tx.transfer_peer_id)
      .reduce((sum, tx) => sum + tx.amount, 0)
    expect(calculateIncomeTotal(richAppTransactions)).toBe(legacy)
  })

  it('matches the legacy dashboard/report expense formula on the fixture', () => {
    const legacy = richTransactions
      .filter((tx) => tx.type === 'expense' && !tx.transfer_peer_id)
      .reduce((sum, tx) => sum + tx.amount, 0)
    expect(calculateExpenseTotal(richAppTransactions)).toBe(legacy)
  })

  it('matches the legacy dashboard/report net formula on the fixture', () => {
    const legacyIncome = richTransactions
      .filter((tx) => tx.type === 'income' && !tx.transfer_peer_id)
      .reduce((sum, tx) => sum + tx.amount, 0)
    const legacyExpense = richTransactions
      .filter((tx) => tx.type === 'expense' && !tx.transfer_peer_id)
      .reduce((sum, tx) => sum + tx.amount, 0)

    expect(calculateNetTotal(richAppTransactions)).toBe(Math.round((legacyIncome - legacyExpense) * 100) / 100)
  })
})
