import { describe, expect, it } from 'vitest'
import { buildReportPeriods, compareMetric, computeAdvancedReport } from '@/lib/reports/calculations'
import { parseReportFilters } from '@/lib/reports/service'
import type { ReportAccountInput, ReportCategoryInput, ReportTransactionInput } from '@/lib/reports/types'

const accounts: ReportAccountInput[] = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Banca', type: 'checking', balance: 2200, currency: 'EUR', color: '#6366f1', is_active: true, is_hidden: false },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'Risparmio', type: 'savings', balance: 1000, currency: 'EUR', color: '#10b981', is_active: true, is_hidden: false },
]

const categories: ReportCategoryInput[] = [
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', name: 'Stipendio', type: 'income', color: '#10b981', icon: '💰', parent_id: null },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', name: 'Casa', type: 'expense', color: '#6366f1', icon: '🏠', parent_id: null },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', name: 'Affitto', type: 'expense', color: '#818cf8', icon: '🔑', parent_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', name: 'Alimentari', type: 'expense', color: '#ef4444', icon: '🛒', parent_id: null },
]

const transactions: ReportTransactionInput[] = [
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 2000, description: 'Stipendio luglio', date: '2026-07-05', transfer_peer_id: null, recurring_id: null },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', account_id: accounts[0].id, category_id: categories[2].id, type: 'expense', amount: 700, description: 'Affitto', date: '2026-07-10', transfer_peer_id: null, recurring_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 180, description: 'Spesa', date: '2026-07-12', transfer_peer_id: null, recurring_id: null },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4', account_id: accounts[0].id, category_id: null, type: 'transfer', amount: 300, description: 'Giroconto', date: '2026-07-20', transfer_peer_id: accounts[1].id, recurring_id: null },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 1500, description: 'Stipendio giugno', date: '2026-06-05', transfer_peer_id: null, recurring_id: null },
  { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc6', account_id: accounts[0].id, category_id: categories[2].id, type: 'expense', amount: 650, description: 'Affitto giugno', date: '2026-06-10', transfer_peer_id: null, recurring_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
]

function report() {
  const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
  return computeAdvancedReport({
    accounts,
    categories,
    transactions,
    activeRecurringRulesCount: 1,
    period,
    previousPeriod,
    accountFilter: null,
    categoryFilter: null,
    typeFilter: 'both',
    includeTransfers: true,
    includeArchivedAccounts: false,
  })
}

describe('financial reports calculations', () => {
  it('calcola entrate, uscite e cash flow escludendo i trasferimenti interni', () => {
    const payload = report()
    expect(payload.summary.totalIncome).toBe(2000)
    expect(payload.summary.totalExpenses).toBe(880)
    expect(payload.summary.netCashFlow).toBe(1120)
    expect(payload.summary.internalTransfersAmount).toBe(300)
    expect(payload.summary.savingsRate).toBe(56)
  })

  it('restituisce savingsRate null quando le entrate sono zero', () => {
    const { period, previousPeriod } = buildReportPeriods('2026-08-01', '2026-08-31')
    const payload = computeAdvancedReport({
      accounts,
      categories,
      transactions: [{ ...transactions[2], date: '2026-08-12' }],
      activeRecurringRulesCount: 0,
      period,
      previousPeriod,
      accountFilter: null,
      categoryFilter: null,
      typeFilter: 'both',
      includeTransfers: false,
      includeArchivedAccounts: false,
    })
    expect(payload.summary.totalIncome).toBe(0)
    expect(payload.summary.savingsRate).toBeNull()
  })

  it('calcola il periodo precedente equivalente', () => {
    const { previousPeriod } = buildReportPeriods('2026-03-10', '2026-04-25')
    expect(previousPeriod).toMatchObject({ from: '2026-01-22', to: '2026-03-09' })
  })

  it('gestisce cambio anno e anno bisestile nei filtri', () => {
    const previousYear = parseReportFilters(new URLSearchParams('range=previous-year'), new Date('2026-07-24T00:00:00'))
    expect(previousYear.from).toBe('2025-01-01')
    expect(previousYear.to).toBe('2025-12-31')

    const leap = parseReportFilters(new URLSearchParams('range=custom&from=2024-02-01&to=2024-02-29'))
    expect(leap.from).toBe('2024-02-01')
    expect(leap.to).toBe('2024-02-29')
  })

  it('rifiuta intervalli personalizzati superiori a 5 anni', () => {
    expect(() => parseReportFilters(new URLSearchParams('range=custom&from=2020-01-01&to=2026-01-02'))).toThrow('Intervallo massimo')
  })

  it('produce serie mensile con mesi vuoti e cumulativo ordinato', () => {
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-09-30')
    const payload = computeAdvancedReport({
      accounts,
      categories,
      transactions,
      activeRecurringRulesCount: 1,
      period,
      previousPeriod,
      accountFilter: null,
      categoryFilter: null,
      typeFilter: 'both',
      includeTransfers: false,
      includeArchivedAccounts: false,
    })
    expect(payload.monthlySeries.map((row) => row.key)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(payload.monthlySeries[1]).toMatchObject({ income: 0, expenses: 0, cashFlow: 0 })
    expect(payload.monthlySeries[0].cumulativeCashFlow).toBe(1120)
  })

  it('aggrega sottocategorie nella categoria padre', () => {
    const payload = report()
    const home = payload.expenseCategories.find((row) => row.categoryName === 'Casa')
    expect(home?.amount).toBe(700)
    expect(home?.children[0]).toMatchObject({ categoryName: 'Affitto', amount: 700 })
  })

  it('classifica spese fisse solo con recurring_id affidabile', () => {
    const payload = report()
    expect(payload.fixedVariable.fixedExpenses).toBe(700)
    expect(payload.fixedVariable.variableExpenses).toBe(180)
    expect(payload.fixedVariable.recurringTransactionsCount).toBe(1)
  })

  it('calcola confronto stabile e divisione per zero senza percentuali fuorvianti', () => {
    expect(compareMetric(100, 100.5, 'up').trend).toBe('STABLE')
    expect(compareMetric(100, 0, 'up')).toMatchObject({ trend: 'NOT_AVAILABLE', percentageChange: null })
  })

  it('limita gli insight a massimo 5 e senza duplicati', () => {
    const payload = report()
    expect(payload.insights.length).toBeLessThanOrEqual(5)
    expect(new Set(payload.insights.map((item) => item.type)).size).toBe(payload.insights.length)
  })
})
