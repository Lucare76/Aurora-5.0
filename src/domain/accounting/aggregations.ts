import type { Account } from '@/types/database'

import type { AppTransaction } from './transaction-adapter'

export type AccountingCategory = {
  id: string
  name?: string
  parent_id?: string | null
  parentId?: string | null
  color?: string | null
}

export type CategoryTotal = {
  categoryId: string
  amount: number
  count: number
}

export type MonthlyTotal = {
  key: string
  income: number
  expense: number
  net: number
  transfer: number
}

export type AccountBalanceInput = Pick<Account, 'id' | 'balance' | 'is_active'>

const UNCATEGORIZED_ID = 'no-category'

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function isCountableIncome(transaction: AppTransaction): boolean {
  return transaction.type === 'income' && transaction.transferReferenceKind === 'none'
}

export function isCountableExpense(transaction: AppTransaction): boolean {
  return transaction.type === 'expense' && transaction.transferReferenceKind === 'none'
}

export function isValidTransfer(transaction: AppTransaction): boolean {
  return (
    transaction.transferReferenceKind === 'peer_transaction' ||
    transaction.transferReferenceKind === 'destination_account'
  )
}

export function calculateIncomeTotal(transactions: AppTransaction[]): number {
  return roundMoney(
    transactions
      .filter(isCountableIncome)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  )
}

export function calculateExpenseTotal(transactions: AppTransaction[]): number {
  return roundMoney(
    transactions
      .filter(isCountableExpense)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  )
}

export function calculateNetTotal(transactions: AppTransaction[]): number {
  return roundMoney(calculateIncomeTotal(transactions) - calculateExpenseTotal(transactions))
}

export function calculateTransferTotal(transactions: AppTransaction[]): number {
  return roundMoney(
    transactions
      .filter((transaction) => {
        if (transaction.transferReferenceKind === 'destination_account') return true
        if (transaction.transferReferenceKind === 'peer_transaction') return transaction.type === 'expense'
        return false
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  )
}

export function calculateAccountBalance(
  accountId: string,
  transactions: AppTransaction[],
  openingBalance = 0,
): number {
  return calculateAccountBalances([{ id: accountId, balance: openingBalance, is_active: true }], transactions)[accountId] ?? roundMoney(openingBalance)
}

export function calculateAccountBalances(
  accounts: AccountBalanceInput[],
  transactions: AppTransaction[],
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const account of accounts) {
    balances[account.id] = Number(account.balance)
  }

  for (const transaction of transactions) {
    if (transaction.transferReferenceKind === 'ambiguous' || transaction.transferReferenceKind === 'orphan' || transaction.transferReferenceKind === 'invalid') {
      continue
    }

    if (transaction.type === 'income') {
      balances[transaction.accountId] = roundMoney((balances[transaction.accountId] ?? 0) + transaction.amount)
    } else if (transaction.type === 'expense') {
      balances[transaction.accountId] = roundMoney((balances[transaction.accountId] ?? 0) - transaction.amount)
    } else if (isValidTransfer(transaction) && transaction.destinationAccountId) {
      balances[transaction.accountId] = roundMoney((balances[transaction.accountId] ?? 0) - transaction.amount)
      balances[transaction.destinationAccountId] = roundMoney((balances[transaction.destinationAccountId] ?? 0) + transaction.amount)
    }
  }

  return balances
}

export function calculateNetWorth(accounts: AccountBalanceInput[]): number {
  return roundMoney(
    accounts
      .filter((account) => account.is_active)
      .reduce((sum, account) => sum + Number(account.balance), 0),
  )
}

export function filterTransactionsByDateRange(
  transactions: AppTransaction[],
  from: string,
  to: string,
): AppTransaction[] {
  return transactions.filter((transaction) => transaction.date >= from && transaction.date <= to)
}

export function groupTransactionsByMonth(transactions: AppTransaction[]): Record<string, AppTransaction[]> {
  return transactions.reduce<Record<string, AppTransaction[]>>((groups, transaction) => {
    const key = transaction.date.slice(0, 7)
    groups[key] = groups[key] ?? []
    groups[key].push(transaction)
    return groups
  }, {})
}

export function calculateMonthlyTotals(transactions: AppTransaction[]): MonthlyTotal[] {
  const groups = groupTransactionsByMonth(transactions)
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => ({
      key,
      income: calculateIncomeTotal(rows),
      expense: calculateExpenseTotal(rows),
      net: calculateNetTotal(rows),
      transfer: calculateTransferTotal(rows),
    }))
}

export function rollupToParentCategory(
  categoryId: string | null,
  categories: AccountingCategory[],
): string {
  if (!categoryId) return UNCATEGORIZED_ID
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const category = categoryById.get(categoryId)
  return category?.parent_id ?? category?.parentId ?? category?.id ?? UNCATEGORIZED_ID
}

export function calculateCategoryTotals(
  transactions: AppTransaction[],
  categories: AccountingCategory[],
): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>()

  for (const transaction of transactions) {
    if (!isCountableExpense(transaction)) continue

    const categoryId = rollupToParentCategory(transaction.categoryId, categories)
    const current = totals.get(categoryId) ?? { categoryId, amount: 0, count: 0 }
    totals.set(categoryId, {
      categoryId,
      amount: roundMoney(current.amount + transaction.amount),
      count: current.count + 1,
    })
  }

  return Array.from(totals.values()).sort((a, b) => b.amount - a.amount)
}
