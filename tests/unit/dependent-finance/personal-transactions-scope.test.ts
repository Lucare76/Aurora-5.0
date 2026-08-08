import { describe, expect, it } from 'vitest'
import {
  filterPersonalAccounts,
  filterPersonalTransactions,
  filterTransactionsByScope,
  getPersonalExcludedAccountIds,
} from '@/lib/dependent-finance/calculations'
import { adaptTransactionRows } from '@/domain/accounting/transaction-adapter'
import { calculateExpenseTotal, calculateIncomeTotal, calculateNetTotal } from '@/domain/accounting/aggregations'
import type { Account, Transaction } from '@/types/database'

/**
 * Regression coverage for the isolation bug: a transaction on an Aurora/DEPENDENT
 * account (e.g. "Buoni Fruttiferi") was visible in /transactions because the page
 * queried transactions without applying the PERSONAL scope rule at all.
 */

const userId = 'user-1'

const links = [
  { account_id: 'personal-1', purpose: 'PERSONAL' },
  { account_id: 'aurora-bridge', purpose: 'DEPENDENT_AURORA' },
  { account_id: 'aurora-buoni-fruttiferi', purpose: 'DEPENDENT' },
  { account_id: 'adi-1', purpose: 'ADI' },
]

const accounts: Pick<Account, 'id' | 'name'>[] = [
  { id: 'personal-1', name: 'Conto corrente' },
  { id: 'aurora-bridge', name: 'Aurora piano di accumulo' },
  { id: 'aurora-buoni-fruttiferi', name: 'Buoni Fruttiferi' },
  { id: 'adi-1', name: 'ADI' },
]

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx',
    user_id: userId,
    account_id: 'personal-1',
    category_id: null,
    type: 'expense',
    amount: 10,
    description: null,
    notes: null,
    date: '2026-08-01',
    transfer_peer_id: null,
    recurring_id: null,
    receipt_url: null,
    receipt_data: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('scope PERSONAL — isolamento dai movimenti Aurora/DEPENDENT', () => {
  it('1. un movimento su conto PERSONAL resta visibile nella lista personale', () => {
    const rows = [tx({ id: 'personal-income', account_id: 'personal-1', type: 'income', amount: 500 })]
    const result = filterPersonalTransactions(rows, links, accounts)
    expect(result.map((row) => row.id)).toEqual(['personal-income'])
  })

  it('2. un movimento sul conto Aurora "Buoni Fruttiferi" (purpose DEPENDENT) e escluso dalla lista personale', () => {
    const rows = [
      tx({ id: 'personal-1-tx', account_id: 'personal-1' }),
      tx({ id: 'buoni-fruttiferi-tx', account_id: 'aurora-buoni-fruttiferi', amount: 1000 }),
    ]
    const result = filterPersonalTransactions(rows, links, accounts)
    expect(result.map((row) => row.id)).toEqual(['personal-1-tx'])
  })

  it('3. lo stesso movimento Aurora resta visibile nello scope Aurora', () => {
    const rows = [
      tx({ id: 'personal-1-tx', account_id: 'personal-1' }),
      tx({ id: 'buoni-fruttiferi-tx', account_id: 'aurora-buoni-fruttiferi', amount: 1000 }),
    ]
    const result = filterTransactionsByScope(rows, links, 'DEPENDENT_AURORA')
    expect(result.map((row) => row.id)).toEqual(['buoni-fruttiferi-tx'])
  })

  it('4. un conto DEPENDENT non compare nel filtro conti personale, ma il conto ponte Aurora si', () => {
    const personalAccounts = filterPersonalAccounts(accounts, links)
    const ids = personalAccounts.map((account) => account.id)
    expect(ids).not.toContain('aurora-buoni-fruttiferi')
    expect(ids).not.toContain('adi-1')
    expect(ids).toContain('personal-1')
    expect(ids).toContain('aurora-bridge')
  })

  it('5-7. i riepiloghi entrate/uscite/saldo netto personali escludono i movimenti Aurora', () => {
    const rows = [
      tx({ id: 'personal-income', account_id: 'personal-1', type: 'income', amount: 500 }),
      tx({ id: 'personal-expense', account_id: 'personal-1', type: 'expense', amount: 120 }),
      tx({ id: 'aurora-income', account_id: 'aurora-buoni-fruttiferi', type: 'income', amount: 9000 }),
      tx({ id: 'aurora-expense', account_id: 'aurora-buoni-fruttiferi', type: 'expense', amount: 4000 }),
    ]
    const personalOnly = filterPersonalTransactions(rows, links, accounts)
    const app = adaptTransactionRows(personalOnly)

    expect(calculateIncomeTotal(app)).toBe(500)
    expect(calculateExpenseTotal(app)).toBe(120)
    expect(calculateNetTotal(app)).toBe(380)
  })

  it('8. giroconto PERSONAL -> AURORA: solo la gamba personale (uscita) resta visibile nel personale, senza duplicati', () => {
    const outLeg = tx({
      id: 'transfer-out',
      account_id: 'personal-1',
      type: 'expense',
      amount: 300,
      transfer_peer_id: 'transfer-in',
    })
    const inLeg = tx({
      id: 'transfer-in',
      account_id: 'aurora-buoni-fruttiferi',
      type: 'income',
      amount: 300,
      transfer_peer_id: 'transfer-out',
    })
    const result = filterPersonalTransactions([outLeg, inLeg], links, accounts)
    expect(result.map((row) => row.id)).toEqual(['transfer-out'])
  })

  it('9. giroconto AURORA -> PERSONAL: la gamba Aurora resta esclusa dal personale, la gamba personale (entrata) resta visibile', () => {
    const outLeg = tx({
      id: 'transfer-out-aurora',
      account_id: 'aurora-buoni-fruttiferi',
      type: 'expense',
      amount: 150,
      transfer_peer_id: 'transfer-in-personal',
    })
    const inLeg = tx({
      id: 'transfer-in-personal',
      account_id: 'personal-1',
      type: 'income',
      amount: 150,
      transfer_peer_id: 'transfer-out-aurora',
    })
    const result = filterPersonalTransactions([outLeg, inLeg], links, accounts)
    expect(result.map((row) => row.id)).toEqual(['transfer-in-personal'])
  })

  it('10. nessun cross-scope leakage: ogni movimento appare in un solo scope filtrato', () => {
    const rows = [
      tx({ id: 'personal-tx', account_id: 'personal-1' }),
      tx({ id: 'aurora-tx', account_id: 'aurora-buoni-fruttiferi' }),
      tx({ id: 'adi-tx', account_id: 'adi-1' }),
    ]
    const personal = filterPersonalTransactions(rows, links, accounts).map((row) => row.id)
    const aurora = filterTransactionsByScope(rows, links, 'DEPENDENT_AURORA').map((row) => row.id)
    const adi = filterTransactionsByScope(rows, links, 'ADI').map((row) => row.id)

    expect(personal).toEqual(['personal-tx'])
    expect(aurora).toEqual(['aurora-tx'])
    expect(adi).toEqual(['adi-tx'])
  })

  it('11. ADI resta separato: mai visibile nello scope personale ne in quello Aurora', () => {
    const rows = [tx({ id: 'adi-tx', account_id: 'adi-1', amount: 80 })]
    expect(filterPersonalTransactions(rows, links, accounts)).toEqual([])
    expect(filterTransactionsByScope(rows, links, 'DEPENDENT_AURORA')).toEqual([])
    expect(filterTransactionsByScope(rows, links, 'ADI').map((row) => row.id)).toEqual(['adi-tx'])
  })

  it('12. un conto senza alcun purpose link e trattato come PERSONAL (comportamento invariato)', () => {
    const noLinkAccountId = 'legacy-account-without-link'
    const rows = [tx({ id: 'legacy-tx', account_id: noLinkAccountId })]
    const result = filterPersonalTransactions(rows, links, [...accounts, { id: noLinkAccountId, name: 'Conto legacy' }])
    expect(result.map((row) => row.id)).toEqual(['legacy-tx'])
    expect(getPersonalExcludedAccountIds(links, accounts).has(noLinkAccountId)).toBe(false)
  })
})
