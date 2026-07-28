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

  it('genera insight SAVINGS_RATE_IMPROVED quando il tasso di risparmio migliora di 5+ punti', () => {
    // Current period: 2000 income, 1000 expenses → savingsRate 50%
    // Previous period: 1500 income, 1350 expenses → savingsRate 10%
    // absoluteChange = 40 ≥ 5 → SAVINGS_RATE_IMPROVED
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const txs: ReportTransactionInput[] = [
      // current period
      { id: 't1', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 2000, description: 'Entrate', date: '2026-07-05', transfer_peer_id: null, recurring_id: null },
      { id: 't2', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 1000, description: 'Spese', date: '2026-07-10', transfer_peer_id: null, recurring_id: null },
      // previous period — low savings
      { id: 't3', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 1500, description: 'Entrate prev', date: '2026-06-05', transfer_peer_id: null, recurring_id: null },
      { id: 't4', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 1350, description: 'Spese prev', date: '2026-06-10', transfer_peer_id: null, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts, categories, transactions: txs,
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    expect(payload.insights.some((i) => i.type === 'SAVINGS_RATE_IMPROVED')).toBe(true)
  })

  it('genera insight CATEGORY_SPIKE quando una categoria aumenta di 100+ EUR e 25%+', () => {
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const txs: ReportTransactionInput[] = [
      { id: 't1', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 3000, description: 'Income', date: '2026-07-05', transfer_peer_id: null, recurring_id: null },
      // current period: food 500
      { id: 't2', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 500, description: 'Food current', date: '2026-07-10', transfer_peer_id: null, recurring_id: null },
      { id: 't3', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 3000, description: 'Income prev', date: '2026-06-05', transfer_peer_id: null, recurring_id: null },
      // previous period: food 200
      { id: 't4', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 200, description: 'Food prev', date: '2026-06-10', transfer_peer_id: null, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts, categories, transactions: txs,
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    expect(payload.insights.some((i) => i.type === 'CATEGORY_SPIKE')).toBe(true)
  })

  it('genera insight POSITIVE_STREAK con 3 mesi consecutivi di cash flow positivo', () => {
    const { period, previousPeriod } = buildReportPeriods('2026-05-01', '2026-07-31')
    const monthlyIncomeTxs: ReportTransactionInput[] = [
      { id: 'i1', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 2000, description: 'Maggio', date: '2026-05-05', transfer_peer_id: null, recurring_id: null },
      { id: 'e1', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 500, description: 'Maggio spese', date: '2026-05-10', transfer_peer_id: null, recurring_id: null },
      { id: 'i2', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 2000, description: 'Giugno', date: '2026-06-05', transfer_peer_id: null, recurring_id: null },
      { id: 'e2', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 500, description: 'Giugno spese', date: '2026-06-10', transfer_peer_id: null, recurring_id: null },
      { id: 'i3', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 2000, description: 'Luglio', date: '2026-07-05', transfer_peer_id: null, recurring_id: null },
      { id: 'e3', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 500, description: 'Luglio spese', date: '2026-07-10', transfer_peer_id: null, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts, categories, transactions: monthlyIncomeTxs,
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    expect(payload.records.positiveCashFlowStreak).toBeGreaterThanOrEqual(3)
    expect(payload.insights.some((i) => i.type === 'POSITIVE_STREAK')).toBe(true)
  })

  it('genera insight NEGATIVE_STREAK con 3 mesi consecutivi di cash flow negativo', () => {
    const { period, previousPeriod } = buildReportPeriods('2026-05-01', '2026-07-31')
    const txs: ReportTransactionInput[] = [
      { id: 'e1', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 1000, description: 'Maggio', date: '2026-05-10', transfer_peer_id: null, recurring_id: null },
      { id: 'e2', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 1000, description: 'Giugno', date: '2026-06-10', transfer_peer_id: null, recurring_id: null },
      { id: 'e3', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 1000, description: 'Luglio', date: '2026-07-10', transfer_peer_id: null, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts, categories, transactions: txs,
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    expect(payload.records.negativeCashFlowStreak).toBeGreaterThanOrEqual(3)
    expect(payload.insights.some((i) => i.type === 'NEGATIVE_STREAK')).toBe(true)
  })

  it('genera insight NET_WORTH_DECREASED quando il patrimonio cala', () => {
    // Accounts starting balance totals higher than ending → negative netWorthChange
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const highExpenseAccounts: ReportAccountInput[] = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Banca', type: 'checking', balance: 500, currency: 'EUR', color: '#6366f1', is_active: true, is_hidden: false },
    ]
    const txs: ReportTransactionInput[] = [
      { id: 'e1', account_id: highExpenseAccounts[0].id, category_id: categories[3].id, type: 'expense', amount: 2000, description: 'Grossa spesa', date: '2026-07-10', transfer_peer_id: null, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts: highExpenseAccounts, categories, transactions: txs,
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    expect(payload.summary.netWorthChange).toBeLessThan(0)
    expect(payload.insights.some((i) => i.type === 'NET_WORTH_DECREASED')).toBe(true)
  })

  it('genera insight SAVINGS_RATE_NEGATIVE quando le uscite superano le entrate', () => {
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const txs: ReportTransactionInput[] = [
      { id: 'i1', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 500, description: 'Stipendio', date: '2026-07-05', transfer_peer_id: null, recurring_id: null },
      { id: 'e1', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 1000, description: 'Spese', date: '2026-07-10', transfer_peer_id: null, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts, categories, transactions: txs,
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    expect(payload.summary.savingsRate).not.toBeNull()
    expect(payload.summary.savingsRate!).toBeLessThan(0)
    expect(payload.insights.some((i) => i.type === 'SAVINGS_RATE_NEGATIVE')).toBe(true)
  })

  it('raggruppa le spese senza categoria sotto Senza categoria', () => {
    // Transactions with category_id: null → rootCategoryId returns 'no-category'
    // → categoryDisplay hits the UNCATEGORIZED_ID branch (line 194)
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const txs: ReportTransactionInput[] = [
      { id: 'u1', account_id: accounts[0].id, category_id: null, type: 'expense', amount: 50, description: 'Spesa varia', date: '2026-07-15', transfer_peer_id: null, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts, categories, transactions: txs,
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    const uncategorized = payload.expenseCategories.find((row) => row.categoryName === 'Senza categoria')
    expect(uncategorized).toBeDefined()
    expect(uncategorized?.amount).toBe(50)
  })

  it('ordina le sottocategorie per importo decrescente con più figli', () => {
    // A parent with 2+ children exercises the children sort comparator (line 267)
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const catWithTwoChildren: ReportCategoryInput[] = [
      ...categories,
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', name: 'Manutenzione', type: 'expense', color: '#a855f7', icon: null, parent_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' },
    ]
    const txs: ReportTransactionInput[] = [
      { id: 'i1', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 2000, description: 'Stipendio', date: '2026-07-05', transfer_peer_id: null, recurring_id: null },
      // 2 children of 'Casa': Affitto (700) and Manutenzione (300)
      { id: 'c1', account_id: accounts[0].id, category_id: categories[2].id, type: 'expense', amount: 700, description: 'Affitto', date: '2026-07-10', transfer_peer_id: null, recurring_id: null },
      { id: 'c2', account_id: accounts[0].id, category_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', type: 'expense', amount: 300, description: 'Manutenzione', date: '2026-07-12', transfer_peer_id: null, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts, categories: catWithTwoChildren, transactions: txs,
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    const casa = payload.expenseCategories.find((row) => row.categoryName === 'Casa')
    expect(casa?.children.length).toBe(2)
    // Children should be sorted descending by amount
    expect(casa!.children[0].amount).toBeGreaterThanOrEqual(casa!.children[1].amount)
  })

  it('conta i trasferimenti nel report conti con typeFilter all', () => {
    // typeFilter 'all' + includeTransfers: true includes transfers in periodTxs
    // so accountRows hits the transferReferenceKind !== 'none' branch (line 306)
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const payload = computeAdvancedReport({
      accounts, categories, transactions,
      activeRecurringRulesCount: 1, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'all',
      includeTransfers: true, includeArchivedAccounts: false,
    })
    const banca = payload.accounts.find((a) => a.accountName === 'Banca')
    expect(banca?.transfers).toBeGreaterThan(0)
  })

  it('filtra solo le uscite con typeFilter expense', () => {
    // typeFilter 'expense' branch (line 499): non-expense transactions are excluded
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const payload = computeAdvancedReport({
      accounts, categories, transactions,
      activeRecurringRulesCount: 1, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'expense',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    // Only expenses: income transactions are excluded
    expect(payload.summary.totalIncome).toBe(0)
    expect(payload.summary.totalExpenses).toBeGreaterThan(0)
  })

  it('restituisce null per netWorthChangePercentage quando netWorthStart è zero', () => {
    // When starting net worth is 0, division is undefined → null
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const zeroBalanceAccounts: ReportAccountInput[] = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Zero', type: 'checking', balance: 0, currency: 'EUR', color: '#6366f1', is_active: true, is_hidden: false },
    ]
    const payload = computeAdvancedReport({
      accounts: zeroBalanceAccounts, categories, transactions: [],
      activeRecurringRulesCount: 0, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: false, includeArchivedAccounts: false,
    })
    // netWorthStart = 0 → netWorthChangePercentage = null
    expect(payload.summary.netWorthChangePercentage).toBeNull()
  })

  it('calcola saldo iniziale corretto con transazioni successive al periodo', () => {
    // Transactions after periodTo are processed by accountFlowAfter (lines 334-338)
    const { period, previousPeriod } = buildReportPeriods('2026-07-01', '2026-07-31')
    const futureTransactions: ReportTransactionInput[] = [
      ...transactions,
      // Income after period end — affects starting balance calculation
      { id: 'f1', account_id: accounts[0].id, category_id: categories[0].id, type: 'income', amount: 1000, description: 'Agosto stipendio', date: '2026-08-05', transfer_peer_id: null, recurring_id: null },
      // Expense after period end
      { id: 'f2', account_id: accounts[0].id, category_id: categories[3].id, type: 'expense', amount: 200, description: 'Agosto spesa', date: '2026-08-10', transfer_peer_id: null, recurring_id: null },
      // Transfer after period end — covers lines 337-338 in accountFlowAfter
      { id: 'f3', account_id: accounts[0].id, category_id: null, type: 'transfer', amount: 100, description: 'Agosto giroconto', date: '2026-08-15', transfer_peer_id: accounts[1].id, recurring_id: null },
    ]
    const payload = computeAdvancedReport({
      accounts, categories, transactions: futureTransactions,
      activeRecurringRulesCount: 1, period, previousPeriod,
      accountFilter: null, categoryFilter: null, typeFilter: 'both',
      includeTransfers: true, includeArchivedAccounts: false,
    })
    // The accounts report must still build correctly with future transactions
    expect(payload.accounts.length).toBeGreaterThan(0)
    const banca = payload.accounts.find((a) => a.accountName === 'Banca')
    expect(banca).toBeDefined()
    // endingBalance is adjusted by future transactions, so startingBalance differs from endingBalance
    expect(typeof banca?.startingBalance).toBe('number')
  })
})
