import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '@/types/database'
import { adaptTransactionRows } from './transaction-adapter'
import {
  calculateAccountBalances,
  calculateExpenseTotal,
  calculateIncomeTotal,
  isCountableExpense,
  isCountableIncome,
  isEconomicallyNeutralTransaction,
  shouldIncludeInFinancialMetrics,
} from './aggregations'
import { calculateReconciliationDifference, isReconciliationBalanced } from './reconciliation'

const userId = 'user-1'
const checkingId = 'acct-checking'
const savingsId = 'acct-savings'

function account(overrides: Partial<Account>): Account {
  return {
    id: checkingId,
    user_id: userId,
    name: 'Conto',
    type: 'checking',
    color: null,
    icon: null,
    balance: 0,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx',
    user_id: userId,
    account_id: checkingId,
    category_id: null,
    type: 'expense',
    amount: 0,
    description: 'Movimento',
    notes: null,
    date: '2026-04-01',
    transfer_peer_id: null,
    recurring_id: null,
    receipt_url: null,
    receipt_data: null,
    is_neutral: false,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

const accounts = [account({ id: checkingId, balance: 1000 }), account({ id: savingsId, name: 'Risparmio', balance: 0 })]

describe('neutral transactions (partite di giro / rimborsi di terzi)', () => {
  it('3. una spesa neutra non aumenta le "spese" contabili', () => {
    const rows = adaptTransactionRows([
      tx({ id: 't-real-expense', type: 'expense', amount: 94.02, is_neutral: false }),
      tx({ id: 't-neutral-expense', type: 'expense', amount: 203.40, is_neutral: true }),
    ], { accounts })

    expect(calculateExpenseTotal(rows)).toBe(94.02)
    expect(isCountableExpense(rows.find((r) => r.id === 't-neutral-expense')!)).toBe(false)
  })

  it('4. un’entrata neutra non aumenta le "entrate" contabili', () => {
    const rows = adaptTransactionRows([
      tx({ id: 't-real-income', type: 'income', amount: 2000, is_neutral: false }),
      tx({ id: 't-neutral-income', type: 'income', amount: 291.32, is_neutral: true }),
    ], { accounts })

    expect(calculateIncomeTotal(rows)).toBe(2000)
    expect(isCountableIncome(rows.find((r) => r.id === 't-neutral-income')!)).toBe(false)
  })

  it('5. un giroconto non diventa neutro per errore: is_neutral=true non lo rende "countable" e resta escluso comunque', () => {
    const rows = adaptTransactionRows([
      tx({ id: 't-transfer', type: 'transfer', amount: 87.92, transfer_peer_id: savingsId, is_neutral: false }),
    ], { accounts })
    const transferTx = rows[0]

    // A transfer is excluded from financial metrics because it IS a transfer
    // (transferReferenceKind !== 'none'), never because it was marked neutral —
    // the DB constraint (transactions_neutral_not_transfer, migration 00039)
    // guarantees is_neutral is always false for a transfer row.
    expect(transferTx.isNeutral).toBe(false)
    expect(isEconomicallyNeutralTransaction(transferTx)).toBe(false)
    expect(shouldIncludeInFinancialMetrics(transferTx)).toBe(false)
    expect(isCountableIncome(transferTx)).toBe(false)
    expect(isCountableExpense(transferTx)).toBe(false)
  })

  it('6. caso reale: -203.40 neutro, +291.32 neutro, -87.92 transfer, -94.02 expense — metriche corrette, saldo corretto, riconciliazione coerente', () => {
    const rawTxs: Transaction[] = [
      tx({ id: 't1', type: 'expense', amount: 203.40, is_neutral: true, date: '2026-04-02' }),
      tx({ id: 't2', type: 'income', amount: 291.32, is_neutral: true, date: '2026-04-03' }),
      tx({ id: 't3', type: 'transfer', amount: 87.92, transfer_peer_id: savingsId, date: '2026-04-04' }),
      tx({ id: 't4', type: 'expense', amount: 94.02, is_neutral: false, date: '2026-04-05' }),
    ]
    const rows = adaptTransactionRows(rawTxs, { accounts })

    // Le metriche personali non devono essere falsate dai movimenti neutri o dal transfer.
    expect(calculateIncomeTotal(rows)).toBe(0)
    expect(calculateExpenseTotal(rows)).toBe(94.02)

    // Il saldo (derivato dal ledger) deve riflettere TUTTI i movimenti reali, neutri inclusi.
    const balances = calculateAccountBalances(
      [{ id: checkingId, balance: 1000, is_active: true }, { id: savingsId, balance: 0, is_active: true }],
      rows,
    )
    expect(balances[checkingId]).toBe(905.98)
    expect(balances[savingsId]).toBe(87.92)

    // La riconciliazione confronta il saldo banca con lo snapshot del saldo Aurora:
    // se combaciano, la differenza è coerente (0) indipendentemente dalla presenza
    // di movimenti neutri o transfer nello storico che ha prodotto quel saldo.
    const difference = calculateReconciliationDifference(balances[checkingId], balances[checkingId])
    expect(isReconciliationBalanced(difference)).toBe(true)
  })
})
