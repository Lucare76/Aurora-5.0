export type AccountingTransactionType = 'income' | 'expense' | 'transfer'

export type AccountingTransaction = {
  id: string
  account_id: string
  amount: number
  type: AccountingTransactionType
  date: string
  category_id?: string | null
  transfer_peer_id?: string | null
}

export type Category = {
  id: string
  name: string
  type: 'income' | 'expense'
  parent_id?: string | null
}

export type MonthlyTotals = {
  income: number
  expense: number
  net: number
}

export type CategoryTotal = {
  categoryId: string
  total: number
  transactionCount: number
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  }
}

export function isDateInMonth(date: string, year: number, month: number): boolean {
  const { start, end } = getMonthRange(year, month)
  return date >= start && date <= end
}

export function calculateMonthlyTotals(
  transactions: AccountingTransaction[],
  year: number,
  month: number,
): MonthlyTotals {
  const totals = transactions.reduce(
    (acc, transaction) => {
      if (!isDateInMonth(transaction.date, year, month)) {
        return acc
      }

      if (transaction.transfer_peer_id) {
        return acc
      }

      if (transaction.type === 'income') {
        acc.income = roundCurrency(acc.income + transaction.amount)
      }

      if (transaction.type === 'expense') {
        acc.expense = roundCurrency(acc.expense + transaction.amount)
      }

      return acc
    },
    { income: 0, expense: 0 },
  )

  return {
    income: totals.income,
    expense: totals.expense,
    net: roundCurrency(totals.income - totals.expense),
  }
}

export function applyTransactionToBalances(
  balances: Record<string, number>,
  transaction: AccountingTransaction,
  destinationAccountId?: string | null,
): Record<string, number> {
  const next = { ...balances }
  const currentBalance = next[transaction.account_id] ?? 0

  if (transaction.type === 'income') {
    next[transaction.account_id] = roundCurrency(currentBalance + transaction.amount)
    return next
  }

  if (transaction.type === 'expense') {
    next[transaction.account_id] = roundCurrency(currentBalance - transaction.amount)
    return next
  }

  next[transaction.account_id] = roundCurrency(currentBalance - transaction.amount)

  const destination = destinationAccountId ?? transaction.transfer_peer_id
  if (destination) {
    next[destination] = roundCurrency((next[destination] ?? 0) + transaction.amount)
  }

  return next
}

export function applyTransactions(
  initialBalances: Record<string, number>,
  transactions: AccountingTransaction[],
): Record<string, number> {
  return transactions.reduce(
    (balances, transaction) => applyTransactionToBalances(balances, transaction),
    { ...initialBalances },
  )
}

export function aggregateExpenseByRootCategory(
  transactions: AccountingTransaction[],
  categories: Category[],
): CategoryTotal[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const totals = new Map<string, CategoryTotal>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') {
      continue
    }

    const category = transaction.category_id ? categoryById.get(transaction.category_id) : null
    const rootCategoryId = category?.parent_id ?? category?.id ?? 'uncategorized'
    const current = totals.get(rootCategoryId) ?? {
      categoryId: rootCategoryId,
      total: 0,
      transactionCount: 0,
    }

    totals.set(rootCategoryId, {
      ...current,
      total: roundCurrency(current.total + transaction.amount),
      transactionCount: current.transactionCount + 1,
    })
  }

  return Array.from(totals.values()).sort((a, b) => b.total - a.total)
}

function formatLocalDate(date: Date): string {
  return date.toLocaleDateString('en-CA')
}
