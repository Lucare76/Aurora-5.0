import type { Account, Category } from '@/types/database'

import type { AppTransaction } from './transaction-adapter'

export type ExportTransactionRow = {
  data: string
  tipo: 'Entrata' | 'Uscita' | 'Giroconto'
  descrizione: string
  categoria: string
  conto: string
  contoDestinazione: string
  importo: string
  transferKind: AppTransaction['transferReferenceKind']
}

export function buildTransactionExportRows(
  transactions: AppTransaction[],
  categories: Pick<Category, 'id' | 'name'>[],
  accounts: Pick<Account, 'id' | 'name'>[],
): ExportTransactionRow[] {
  const categoryById = new Map(categories.map((category) => [category.id, category.name]))
  const accountById = new Map(accounts.map((account) => [account.id, account.name]))

  return [...transactions]
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return b.createdAt.localeCompare(a.createdAt)
    })
    .map((transaction) => {
      const isTransfer = transaction.transferReferenceKind !== 'none' || transaction.type === 'transfer'
      const tipo = isTransfer
        ? 'Giroconto'
        : transaction.type === 'income'
          ? 'Entrata'
          : 'Uscita'

      return {
        data: transaction.date,
        tipo,
        descrizione: transaction.description ?? '',
        categoria: isTransfer
          ? 'Giroconto'
          : categoryById.get(transaction.categoryId ?? '') ?? 'Senza categoria',
        conto: accountById.get(transaction.accountId) ?? '',
        contoDestinazione: transaction.destinationAccountId
          ? accountById.get(transaction.destinationAccountId) ?? ''
          : '',
        importo: transaction.amount.toFixed(2),
        transferKind: transaction.transferReferenceKind,
      }
    })
}

export function buildTransactionsCsv(rows: ExportTransactionRow[]): string {
  const header = [
    'Data',
    'Tipo',
    'Descrizione',
    'Categoria',
    'Conto',
    'Conto destinazione',
    'Importo (EUR)',
    'Transfer kind',
  ]

  return [header, ...rows.map((row) => [
    row.data,
    row.tipo,
    row.descrizione,
    row.categoria,
    row.conto,
    row.contoDestinazione,
    row.importo,
    row.transferKind,
  ])]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
}

export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
