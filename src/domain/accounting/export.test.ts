import { describe, expect, it } from 'vitest'

import { richAccounts, richAppTransactions, richCategories } from '../../../tests/fixtures/accounting-rich-fixture'
import { buildTransactionExportRows, buildTransactionsCsv, csvCell } from './export'

describe('transaction export', () => {
  const rows = buildTransactionExportRows(richAppTransactions, richCategories, richAccounts)

  it('exports every transaction without dropping transfers', () => {
    expect(rows).toHaveLength(richAppTransactions.length)
  })

  it('exports income rows', () => {
    expect(rows.find((row) => row.descrizione === 'Movimento' && row.data === '2026-01-05')).toMatchObject({
      tipo: 'Entrata',
      categoria: 'Stipendio',
      conto: 'Banca',
      importo: '2300.00',
    })
  })

  it('exports expense rows', () => {
    expect(rows.find((row) => row.descrizione === 'Spesa carta A')).toMatchObject({
      tipo: 'Uscita',
      categoria: 'Supermercato',
      conto: 'Carta',
      importo: '45.00',
    })
  })

  it('exports legacy transfer rows', () => {
    expect(rows.find((row) => row.descrizione === 'Giroconto storico uscita')).toMatchObject({
      tipo: 'Giroconto',
      conto: 'Banca',
      contoDestinazione: 'Risparmio',
      transferKind: 'peer_transaction',
    })
  })

  it('exports new destination-account transfer rows', () => {
    expect(rows.find((row) => row.descrizione === 'Giroconto nuovo')).toMatchObject({
      tipo: 'Giroconto',
      conto: 'Banca',
      contoDestinazione: 'Risparmio',
      transferKind: 'destination_account',
    })
  })

  it('exports uncategorized movements', () => {
    expect(rows.find((row) => row.data === '2026-01-13')).toMatchObject({
      categoria: 'Senza categoria',
      importo: '39.90',
    })
  })

  it('keeps same date and same amount rows distinct by description', () => {
    const duplicated = rows.filter((row) => row.data === '2025-12-29' && row.importo === '45.00')
    expect(duplicated.map((row) => row.descrizione).sort()).toEqual(['Spesa carta A', 'Spesa carta B'])
  })

  it('builds a complete CSV with header and all rows', () => {
    const csv = buildTransactionsCsv(rows)
    expect(csv.split('\n')).toHaveLength(rows.length + 1)
    expect(csv.split('\n')[0]).toBe('Data,Tipo,Descrizione,Categoria,Conto,Conto destinazione,Importo (EUR),Transfer kind')
  })

  it('escapes CSV cells with quotes and commas', () => {
    expect(csvCell('A "quoted", value')).toBe('"A ""quoted"", value"')
  })

  it('round-trips logical CSV fields for a transfer row', () => {
    const csv = buildTransactionsCsv(rows)
    expect(csv).toContain('Giroconto storico uscita')
    expect(csv).toContain('peer_transaction')
    expect(csv).toContain('destination_account')
  })

  it('sorts export rows by date descending', () => {
    expect(rows[0].data >= rows[1].data).toBe(true)
    expect(rows[0].data).toBe('2026-03-02')
  })

  it('uses Giroconto category for transfer rows', () => {
    const transferRows = rows.filter((row) => row.tipo === 'Giroconto')
    expect(transferRows.every((row) => row.categoria === 'Giroconto')).toBe(true)
  })

  it('keeps invalid transfer rows in the full export', () => {
    expect(rows.find((row) => row.transferKind === 'orphan')).toMatchObject({
      tipo: 'Giroconto',
      importo: '777.00',
    })
  })

  it('does not mutate input transactions while exporting', () => {
    const before = richAppTransactions.map((transaction) => transaction.id).join('|')
    buildTransactionExportRows(richAppTransactions, richCategories, richAccounts)
    expect(richAppTransactions.map((transaction) => transaction.id).join('|')).toBe(before)
  })

  it('does not quote simple CSV cells', () => {
    expect(csvCell('Bancoposta')).toBe('Bancoposta')
  })

  it('escapes CSV cells with new lines', () => {
    expect(csvCell('prima\nseconda')).toBe('"prima\nseconda"')
  })
})
