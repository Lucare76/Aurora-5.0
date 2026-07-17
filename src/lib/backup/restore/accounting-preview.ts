import type { AuroraBackupV1 } from '../types'
import type { AccountingPreview, AccountBalancePreview, DryRunIssue } from './types'

export function buildAccountingPreview(backup: AuroraBackupV1): { preview: AccountingPreview; issues: DryRunIssue[] } {
  const issues: DryRunIssue[] = []
  const accountIds = new Set(backup.data.accounts.map((account) => account.id))
  const categoryIds = new Set(backup.data.categories.map((category) => category.id))
  const byAccount = new Map<string, AccountBalancePreview>()
  const monthly = new Map<string, { month: string; income: number; expense: number; net: number }>()

  for (const account of backup.data.accounts) {
    byAccount.set(account.id, {
      accountId: account.id,
      currency: account.currency,
      backupBalance: account.balance,
      income: 0,
      expense: 0,
      transferIn: 0,
      transferOut: 0,
      netFromTransactions: 0,
    })
  }

  let totalIncome = 0
  let totalExpense = 0
  let transferCount = 0
  let uncategorizedTransactions = 0
  let missingReferenceTransactions = 0

  for (const tx of backup.data.transactions) {
    const account = byAccount.get(tx.account_id)
    if (!account) {
      missingReferenceTransactions += 1
      issues.push({
        code: 'ACCOUNTING_TRANSACTION_ACCOUNT_MISSING',
        severity: 'error',
        path: ['transactions', tx.id, 'account_id'],
        message: 'Movimento collegato a un conto assente.',
      })
      continue
    }

    if (tx.category_id && !categoryIds.has(tx.category_id)) {
      missingReferenceTransactions += 1
    }

    if (!tx.category_id && tx.type !== 'transfer') {
      uncategorizedTransactions += 1
    }

    const month = tx.date.slice(0, 7)
    const monthlyRow = monthly.get(month) ?? { month, income: 0, expense: 0, net: 0 }

    if (tx.type === 'income') {
      totalIncome += tx.amount
      account.income += tx.amount
      account.netFromTransactions += tx.amount
      monthlyRow.income += tx.amount
      monthlyRow.net += tx.amount
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount
      account.expense += tx.amount
      account.netFromTransactions -= tx.amount
      monthlyRow.expense += tx.amount
      monthlyRow.net -= tx.amount
    } else {
      transferCount += 1
      account.transferOut += tx.amount
    }

    monthly.set(month, monthlyRow)
  }

  const totalNetWorth = backup.data.accounts.reduce((sum, account) => sum + account.balance, 0)
  const loanRemainingTotal = backup.data.loans.reduce((sum, loan) => sum + loan.remaining, 0)

  return {
    preview: {
      transactionCount: backup.data.transactions.length,
      totalIncome: round(totalIncome),
      totalExpense: round(totalExpense),
      netCashflow: round(totalIncome - totalExpense),
      totalNetWorth: round(totalNetWorth),
      transferCount,
      transfersNeutral: true,
      uncategorizedTransactions,
      missingReferenceTransactions,
      monthlySummary: [...monthly.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((row) => ({
          month: row.month,
          income: round(row.income),
          expense: round(row.expense),
          net: round(row.net),
        })),
      accountBalances: [...byAccount.values()].map((account) => ({
        ...account,
        backupBalance: round(account.backupBalance),
        income: round(account.income),
        expense: round(account.expense),
        transferIn: round(account.transferIn),
        transferOut: round(account.transferOut),
        netFromTransactions: round(account.netFromTransactions),
      })),
      loanRemainingTotal: round(loanRemainingTotal),
    },
    issues,
  }
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
