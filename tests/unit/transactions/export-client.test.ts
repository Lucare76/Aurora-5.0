import { describe, expect, it } from 'vitest'
import { filterTransactionsForExport } from '@/lib/transactions/export-client'
import type { AppTransaction } from '@/domain/accounting/transaction-adapter'

describe('CSV movimenti filtrati', () => {
  it('rispetta ricerca, categoria madre, importo ed esclude la seconda metà del giroconto personale', () => {
    const rows = [
      { id: 'expense', type: 'expense', amount: 40, categoryId: 'child', description: 'Spesa viaggio', notes: null, transferReferenceKind: 'none' },
      { id: 'other', type: 'expense', amount: 15, categoryId: 'child', description: 'Spesa viaggio', notes: null, transferReferenceKind: 'none' },
      { id: 'transfer-out', type: 'expense', amount: 40, categoryId: null, description: 'Spesa viaggio', notes: null, transferReferenceKind: 'peer_transaction' },
      { id: 'transfer-in', type: 'income', amount: 40, categoryId: null, description: 'Spesa viaggio', notes: null, transferReferenceKind: 'peer_transaction' },
    ] as unknown as AppTransaction[]
    const categories = [{ id: 'child', parent_id: 'parent' }]

    expect(filterTransactionsForExport(rows, categories, {
      personalOnly: true, search: 'VIAGGIO', categoryIds: ['parent'], amountMin: 20, amountMax: 50,
    }).map((row) => row.id)).toEqual(['expense'])
    expect(filterTransactionsForExport(rows, categories, { personalOnly: true }).map((row) => row.id))
      .toEqual(['expense', 'other', 'transfer-out'])
  })
})
