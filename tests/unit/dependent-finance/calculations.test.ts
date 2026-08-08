import { describe, expect, it } from 'vitest'
import {
  buildAdiSummary,
  buildAuroraScopeSummary,
  canRegisterAdiDebit,
  classifyTransferDirection,
  filterAccountsByScope,
  filterPersonalAccounts,
  filterPersonalTransactions,
  filterTransactionsByScope,
  getDependentAccountIds,
  getRealAuroraAccountIds,
  normalizeFinanceScope,
} from '@/lib/dependent-finance/calculations'
import type { AccountPurposeLink, AdiEntry } from '@/lib/dependent-finance/types'

const links: Pick<AccountPurposeLink, 'account_id' | 'purpose'>[] = [
  { account_id: 'personal-1', purpose: 'PERSONAL' },
  { account_id: 'aurora-1', purpose: 'DEPENDENT_AURORA' },
  { account_id: 'aurora-2', purpose: 'DEPENDENT' },
  { account_id: 'adi-1', purpose: 'ADI' },
]

describe('dependent finance calculations', () => {
  it('normalizza i tre perimetri e mantiene compatibilita legacy DEPENDENT', () => {
    expect(normalizeFinanceScope('PERSONAL')).toBe('PERSONAL')
    expect(normalizeFinanceScope('DEPENDENT_AURORA')).toBe('DEPENDENT_AURORA')
    expect(normalizeFinanceScope('DEPENDENT')).toBe('DEPENDENT_AURORA')
    expect(normalizeFinanceScope('ADI')).toBe('ADI')
  })

  it('identifica i conti Aurora senza duplicare il conto originale', () => {
    expect([...getDependentAccountIds(links)].sort()).toEqual(['aurora-1', 'aurora-2'])
  })

  it('filtra conti personali, Aurora e ADI in modo separato', () => {
    const accounts = [
      { id: 'personal-1', name: 'Bancoposta', balance: 1000 },
      { id: 'aurora-1', name: 'Aurora piano di accumulo', balance: 5000 },
      { id: 'aurora-2', name: 'Libretto Aurora', balance: 300 },
      { id: 'adi-1', name: 'ADI', balance: 200 },
    ]
    expect(filterPersonalAccounts(accounts, links).map((account) => account.id)).toEqual(['personal-1', 'aurora-1'])
    expect(filterAccountsByScope(accounts, links, 'DEPENDENT_AURORA').map((account) => account.id)).toEqual(['aurora-1', 'aurora-2'])
    expect(filterAccountsByScope(accounts, links, 'ADI').map((account) => account.id)).toEqual(['adi-1'])
  })

  it('mantiene nel personale solo i movimenti del conto ponte Aurora piano di accumulo', () => {
    const accounts = [
      { id: 'personal-1', name: 'Bancoposta' },
      { id: 'aurora-1', name: 'Aurora piano di accumulo' },
      { id: 'aurora-2', name: 'Libretto Aurora' },
      { id: 'adi-1', name: 'ADI' },
    ]
    const transactions = [
      { id: 'tx-1', account_id: 'personal-1', amount: 100 },
      { id: 'tx-2', account_id: 'aurora-1', amount: 500 },
      { id: 'tx-3', account_id: 'aurora-2', amount: 300 },
      { id: 'tx-4', account_id: 'adi-1', amount: 50 },
    ]
    expect(filterPersonalTransactions(transactions, links, accounts).map((tx) => tx.id)).toEqual(['tx-1', 'tx-2'])
    expect(filterTransactionsByScope(transactions, links, 'DEPENDENT_AURORA').map((tx) => tx.id)).toEqual(['tx-2', 'tx-3'])
    expect(filterTransactionsByScope(transactions, links, 'ADI').map((tx) => tx.id)).toEqual(['tx-4'])
  })

  it('classifica i giroconti tra perimetri', () => {
    expect(classifyTransferDirection('personal-1', 'aurora-1', links)).toBe('PERSONAL_TO_AURORA')
    expect(classifyTransferDirection('aurora-1', 'personal-1', links)).toBe('AURORA_TO_PERSONAL')
    expect(classifyTransferDirection('aurora-1', 'aurora-2', links)).toBe('AURORA_TO_AURORA')
    expect(classifyTransferDirection('personal-1', 'personal-2', links)).toBe('PERSONAL_TO_PERSONAL')
  })

  it('calcola statistiche Aurora multi-conto ed esclude giroconti interni da entrate e uscite', () => {
    const summary = buildAuroraScopeSummary({
      accounts: [
        { id: 'aurora-1', name: 'Investimento Aurora', balance: 4364, currency: 'EUR', type: 'investment' },
        { id: 'aurora-2', name: 'Libretto Aurora', balance: 300, currency: 'EUR', type: 'savings' },
      ],
      links,
      transactions: [
        { id: 'in-1', account_id: 'aurora-1', type: 'income', amount: 100, date: '2026-08-01', description: 'Regalo' },
        { id: 'out-1', account_id: 'aurora-1', type: 'expense', amount: 20, date: '2026-08-02', description: 'Salute' },
        { id: 'p-to-a', account_id: 'personal-1', transfer_peer_id: 'aurora-1', type: 'transfer', amount: 50, date: '2026-08-03', description: 'Versamento' },
        { id: 'a-to-p', account_id: 'aurora-1', transfer_peer_id: 'personal-1', type: 'expense', amount: 10, date: '2026-08-04', description: 'Utilizzo' },
        { id: 'a-to-a', account_id: 'aurora-1', transfer_peer_id: 'aurora-2', type: 'transfer', amount: 40, date: '2026-08-05', description: 'Giroconto interno' },
      ],
    })

    expect(summary.balance).toBe(4664)
    expect(summary.investments).toBe(4364)
    expect(summary.liquidity).toBe(300)
    expect(summary.income).toBe(100)
    expect(summary.expenses).toBe(20)
    expect(summary.transfersIn).toBe(50)
    expect(summary.transfersOut).toBe(10)
    expect(summary.internalTransfers).toBe(40)
    expect(summary.periodChange).toBe(120)
    expect(summary.byAccount).toHaveLength(2)
  })

  it('getRealAuroraAccountIds esclude il conto specchio "Aurora piano di accumulo" dal perimetro reale', () => {
    const accounts = [
      { id: 'aurora-real', name: 'Investimento Aurora' },
      { id: 'aurora-mirror', name: 'Aurora piano di accumulo' },
    ]
    const mirrorLinks = [
      { account_id: 'aurora-real', purpose: 'DEPENDENT_AURORA' },
      { account_id: 'aurora-mirror', purpose: 'DEPENDENT_AURORA' },
    ]
    expect([...getRealAuroraAccountIds(accounts, mirrorLinks)]).toEqual(['aurora-real'])
  })

  it('il conto specchio Aurora contribuisce solo al patrimonio, mai a statistiche, grafici o cronologia', () => {
    const accounts = [
      { id: 'aurora-real', name: 'Investimento Aurora', balance: 2000, currency: 'EUR', type: 'investment' },
      { id: 'aurora-mirror', name: 'Aurora piano di accumulo', balance: 5000, currency: 'EUR', type: 'savings' },
    ]
    const mirrorLinks = [
      { account_id: 'personal-1', purpose: 'PERSONAL' },
      { account_id: 'aurora-real', purpose: 'DEPENDENT_AURORA' },
      { account_id: 'aurora-mirror', purpose: 'DEPENDENT_AURORA' },
    ]
    const summary = buildAuroraScopeSummary({
      accounts,
      links: mirrorLinks,
      transactions: [
        { id: 'real-income', account_id: 'aurora-real', type: 'income', amount: 200, date: '2026-08-01', description: 'Cedola' },
        { id: 'real-expense', account_id: 'aurora-real', type: 'expense', amount: 30, date: '2026-08-02', description: 'Commissione' },
        // movimenti propri del conto specchio: devono sparire dalla cronologia/statistiche
        { id: 'mirror-income', account_id: 'aurora-mirror', type: 'income', amount: 9999, date: '2026-08-03', description: 'Non deve comparire' },
        { id: 'mirror-expense', account_id: 'aurora-mirror', type: 'expense', amount: 9999, date: '2026-08-04', description: 'Non deve comparire' },
        // giroconto personale -> specchio: la riga "+100" segnalata dal bug
        { id: 'p-to-mirror', account_id: 'personal-1', transfer_peer_id: 'aurora-mirror', type: 'transfer', amount: 100, date: '2026-08-05', description: 'Versamento verso specchio' },
        // giroconto specchio -> personale: la riga "-100" segnalata dal bug
        { id: 'mirror-to-p', account_id: 'aurora-mirror', transfer_peer_id: 'personal-1', type: 'expense', amount: 100, date: '2026-08-06', description: 'Prelievo da specchio' },
        // giroconto personale -> conto Aurora reale: deve invece contare come entrata Aurora
        { id: 'p-to-real', account_id: 'personal-1', transfer_peer_id: 'aurora-real', type: 'transfer', amount: 75, date: '2026-08-07', description: 'Versamento verso reale' },
      ],
    })

    // patrimonio: continua a comprendere anche il saldo del conto specchio
    expect(summary.balance).toBe(7000)
    expect(summary.byAccount).toHaveLength(2)
    expect(summary.byAccount.some((account) => account.accountId === 'aurora-mirror')).toBe(true)

    // statistiche: solo il conto reale contribuisce
    expect(summary.income).toBe(200)
    expect(summary.expenses).toBe(30)
    expect(summary.transfersIn).toBe(75)
    expect(summary.transfersOut).toBe(0)

    // grafici mensili: nessuna traccia dei movimenti dello specchio
    expect(summary.monthlyTrend).toHaveLength(1)
    expect(summary.monthlyTrend[0]).toMatchObject({ income: 200, expenses: 30, transfersIn: 75, transfersOut: 0 })

    // cronologia: nessun movimento (proprio o di giroconto) dello specchio, incluse le date piu' recenti (08-05/06)
    const recentIds = summary.recentTransactions.map((tx) => tx.id)
    expect(recentIds).toEqual(['p-to-real', 'real-expense', 'real-income'])
    expect(recentIds).not.toContain('mirror-income')
    expect(recentIds).not.toContain('mirror-expense')
    expect(recentIds).not.toContain('p-to-mirror')
    expect(recentIds).not.toContain('mirror-to-p')
    expect(summary.lastMovementDate).toBe('2026-08-07')
  })

  it('calcola saldo ADI, utilizzo e sole categorie ammesse', () => {
    const summary = buildAdiSummary([
      adi({ id: 'c1', entry_type: 'credit', amount: 500, date: '2026-08-01', reference_period: '2026-08' }),
      adi({ id: 'd1', entry_type: 'debit', adi_category: 'SUPERMERCATO', amount: 120, date: '2026-08-02', reference_period: '2026-08' }),
      adi({ id: 'd2', entry_type: 'debit', adi_category: 'BENZINA', amount: 50, date: '2026-08-03', reference_period: '2026-08' }),
      adi({ id: 'd3', entry_type: 'debit', adi_category: 'ABBIGLIAMENTO_AURORA', amount: 40, date: '2026-08-04', reference_period: '2026-08' }),
    ])

    expect(summary.received).toBe(500)
    expect(summary.spent).toBe(210)
    expect(summary.balance).toBe(290)
    expect(summary.utilizationRate).toBe(42)
    expect(summary.byCategory.SUPERMERCATO).toBe(120)
    expect(summary.byCategory.BENZINA).toBe(50)
    expect(summary.byCategory.ABBIGLIAMENTO_AURORA).toBe(40)
  })

  it('blocca una spesa ADI superiore al saldo disponibile', () => {
    expect(canRegisterAdiDebit(100, 99.99)).toBe(true)
    expect(canRegisterAdiDebit(100, 100)).toBe(true)
    expect(canRegisterAdiDebit(100, 100.01)).toBe(false)
    expect(canRegisterAdiDebit(100, 0)).toBe(false)
  })
})

function adi(overrides: Partial<AdiEntry>): Pick<AdiEntry, 'entry_type' | 'adi_category' | 'amount' | 'date' | 'reference_period'> {
  return {
    entry_type: 'credit',
    adi_category: null,
    amount: 0,
    date: '2026-08-01',
    reference_period: null,
    ...overrides,
  }
}
