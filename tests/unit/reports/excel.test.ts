import { describe, expect, it, vi } from 'vitest'
import { buildExcelWorkbook, downloadExcel } from '@/lib/reports/excel'
import type { ReportPayload } from '@/lib/reports/types'

const writeFileMock = vi.fn()
vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx')
  return { ...actual, writeFile: (...args: unknown[]) => writeFileMock(...args) }
})

function makePayload(overrides: Partial<ReportPayload> = {}): ReportPayload {
  const base: ReportPayload = {
    filters: {
      range: 'current-month',
      from: '2026-07-01',
      to: '2026-07-31',
      account: null,
      category: null,
      type: 'both',
      includeTransfers: false,
      includeArchivedAccounts: false,
    },
    period: { from: '2026-07-01', to: '2026-07-31', label: 'Luglio 2026', days: 31 },
    previousPeriod: { from: '2026-06-01', to: '2026-06-30', label: 'Giugno 2026', days: 30 },
    summary: {
      totalIncome: 2000,
      totalExpenses: 1200,
      netCashFlow: 800,
      savingsRate: 40,
      averageMonthlyIncome: 2000,
      averageMonthlyExpenses: 1200,
      averageMonthlyCashFlow: 800,
      highestExpense: 700,
      highestIncome: 2000,
      transactionCount: 5,
      activeAccountsCount: 2,
      netWorthStart: 3000,
      netWorthEnd: 3800,
      netWorthChange: 800,
      netWorthChangePercentage: 26.67,
      internalTransfersAmount: 300,
    },
    comparison: {
      totalIncome: { currentValue: 2000, previousValue: 1500, absoluteChange: 500, percentageChange: 33.33, trend: 'UP', interpretation: 'positive' },
      totalExpenses: { currentValue: 1200, previousValue: 1100, absoluteChange: 100, percentageChange: 9.09, trend: 'UP', interpretation: 'negative' },
      netCashFlow: { currentValue: 800, previousValue: 400, absoluteChange: 400, percentageChange: 100, trend: 'UP', interpretation: 'positive' },
      savingsRate: { currentValue: 40, previousValue: 26.67, absoluteChange: 13.33, percentageChange: 50, trend: 'UP', interpretation: 'positive' },
      netWorthEnd: { currentValue: 3800, previousValue: 3200, absoluteChange: 600, percentageChange: 18.75, trend: 'UP', interpretation: 'positive' },
    },
    monthlySeries: [
      { key: '2026-07', month: 'lug', from: '2026-07-01', to: '2026-07-31', income: 2000, expenses: 1200, cashFlow: 800, savingsRate: 40, transactionCount: 5, cumulativeCashFlow: 800, netWorth: 3800 },
    ],
    expenseCategories: [
      { categoryId: 'cat-1', categoryName: 'Casa', parentCategory: null, color: '#6366f1', icon: null, amount: 700, percentage: 58.33, transactionCount: 1, averageTransaction: 700, previousAmount: 650, changeAmount: 50, changePercentage: 7.69, rank: 1, children: [] },
    ],
    incomeCategories: [
      { categoryId: 'cat-2', categoryName: 'Stipendio', parentCategory: null, color: '#10b981', icon: null, amount: 2000, percentage: 100, transactionCount: 1, averageTransaction: 2000, previousAmount: 1500, changeAmount: 500, changePercentage: 33.33, rank: 1, children: [] },
    ],
    fixedVariable: {
      fixedExpenses: 700,
      variableExpenses: 500,
      unclassifiedExpenses: 0,
      fixedExpensePercentage: 58.33,
      variableExpensePercentage: 41.67,
      recurringTransactionsCount: 2,
      activeRecurringRulesCount: 3,
      averageFixedMonthlyExpense: 700,
      classificationNote: 'I movimenti con regola ricorrente sono classificati come fissi.',
    },
    netWorth: {
      start: 3000,
      end: 3800,
      change: 800,
      changePercentage: 26.67,
      highestNetWorth: 3800,
      lowestNetWorth: 3000,
      monthlySeries: [{ key: '2026-07', month: 'lug', netWorth: 3800 }],
    },
    records: {
      bestIncomeMonth: null,
      highestExpenseMonth: null,
      bestCashFlowMonth: null,
      worstCashFlowMonth: null,
      topExpenseCategory: null,
      biggestCategoryIncrease: null,
      biggestCategoryReduction: null,
      highestTransaction: null,
      highestExpenseDay: null,
      positiveCashFlowStreak: 1,
      negativeCashFlowStreak: 0,
    },
    insights: [
      { type: 'INCOME_INCREASED', severity: 'SUCCESS', title: 'Entrate in aumento', message: 'Le entrate sono aumentate del 33%.' },
    ],
    accounts: [
      {
        accountId: 'acc-1',
        accountName: 'Banca',
        type: 'checking',
        currency: 'EUR',
        color: '#6366f1',
        isActive: true,
        isHidden: false,
        startingBalance: 2200,
        income: 2000,
        expenses: 1200,
        transfers: 300,
        endingBalance: 3000,
        change: 800,
        transactionCount: 5,
      },
    ],
    metadata: {
      generatedAt: '2026-07-27T00:00:00Z',
      queryCount: 4,
      truncated: false,
      dataCompleteness: 'complete',
      warnings: [],
    },
  }
  return { ...base, ...overrides }
}

describe('buildExcelWorkbook', () => {
  it('returns a workbook object', () => {
    const wb = buildExcelWorkbook(makePayload())
    expect(wb).toBeDefined()
    expect(wb.SheetNames).toBeDefined()
    expect(Array.isArray(wb.SheetNames)).toBe(true)
  })

  it('workbook has at least the Riepilogo sheet', () => {
    const wb = buildExcelWorkbook(makePayload())
    expect(wb.SheetNames).toContain('Riepilogo')
  })

  it('workbook has Andamento mensile sheet when series is non-empty', () => {
    const wb = buildExcelWorkbook(makePayload())
    expect(wb.SheetNames).toContain('Andamento mensile')
  })

  it('workbook has Uscite per categoria sheet when categories exist', () => {
    const wb = buildExcelWorkbook(makePayload())
    expect(wb.SheetNames).toContain('Uscite per categoria')
  })

  it('workbook has Entrate per categoria sheet when income categories exist', () => {
    const wb = buildExcelWorkbook(makePayload())
    expect(wb.SheetNames).toContain('Entrate per categoria')
  })

  it('workbook has Conti sheet when accounts exist', () => {
    const wb = buildExcelWorkbook(makePayload())
    expect(wb.SheetNames).toContain('Conti')
  })

  it('workbook has Fisse e variabili sheet', () => {
    const wb = buildExcelWorkbook(makePayload())
    expect(wb.SheetNames).toContain('Fisse e variabili')
  })

  it('workbook has Insight sheet when insights exist', () => {
    const wb = buildExcelWorkbook(makePayload())
    expect(wb.SheetNames).toContain('Insight')
  })

  it('skips empty sheets', () => {
    const wb = buildExcelWorkbook(makePayload({ monthlySeries: [], expenseCategories: [], incomeCategories: [], accounts: [], insights: [] }))
    expect(wb.SheetNames).toContain('Riepilogo')
    expect(wb.SheetNames).not.toContain('Andamento mensile')
    expect(wb.SheetNames).not.toContain('Uscite per categoria')
    expect(wb.SheetNames).not.toContain('Insight')
  })

  it('Riepilogo sheet has cell data', () => {
    const wb = buildExcelWorkbook(makePayload())
    const ws = wb.Sheets['Riepilogo']
    expect(ws).toBeDefined()
    expect(ws['A1']).toBeDefined()
  })

  it('Andamento mensile first data row has income value', () => {
    const wb = buildExcelWorkbook(makePayload())
    const ws = wb.Sheets['Andamento mensile']
    // Row 0 = header, Row 1 = first data row; A=0, D=4th col (income col 4) — col index 3 = D
    const incomeCell = ws['D2']
    expect(incomeCell?.v).toBe(2000)
  })

  it('handles null savingsRate and null netWorth in monthly series', () => {
    const wb = buildExcelWorkbook(makePayload({
      monthlySeries: [
        { key: '2026-07', month: 'lug', from: '2026-07-01', to: '2026-07-31', income: 2000, expenses: 0, cashFlow: 2000, savingsRate: null, transactionCount: 1, cumulativeCashFlow: 2000, netWorth: null },
      ],
    }))
    const ws = wb.Sheets['Andamento mensile']
    expect(ws).toBeDefined()
    // Row 2 = first data row; col G = savingsRate (index 6), col J = netWorth (index 9)
    const savingsCell = ws['G2']
    const netWorthCell = ws['J2']
    // Both should be null/empty, not throw
    expect(savingsCell?.v ?? null).toBeNull()
    expect(netWorthCell?.v ?? null).toBeNull()
  })

  it('handles null parentCategory and null changePercentage in expense categories', () => {
    const wb = buildExcelWorkbook(makePayload({
      expenseCategories: [
        { categoryId: 'cat-1', categoryName: 'Casa', parentCategory: null, color: '#6366f1', icon: null, amount: 700, percentage: 100, transactionCount: 1, averageTransaction: 700, previousAmount: 0, changeAmount: 0, changePercentage: null, rank: 1, children: [] },
      ],
    }))
    const ws = wb.Sheets['Uscite per categoria']
    expect(ws).toBeDefined()
    expect(ws['A2']?.v).toBe('Casa')
  })

  it('handles negative amounts in accounts sheet (credit/liability)', () => {
    const wb = buildExcelWorkbook(makePayload({
      accounts: [
        { accountId: 'acc-1', accountName: 'Credito', type: 'credit', currency: 'EUR', color: '#ef4444', isActive: true, isHidden: false, startingBalance: -500, income: 0, expenses: 200, transfers: 0, endingBalance: -700, change: -200, transactionCount: 2 },
      ],
    }))
    const ws = wb.Sheets['Conti']
    expect(ws).toBeDefined()
    // Columns: A=name B=type C=currency D=isActive E=startingBalance F=income G=expenses H=transfers I=endingBalance J=change
    expect(ws['E2']?.v).toBe(-500)
    expect(ws['I2']?.v).toBe(-700)
  })

  it('workbook without Insight sheet when insights empty', () => {
    const wb = buildExcelWorkbook(makePayload({ insights: [] }))
    expect(wb.SheetNames).not.toContain('Insight')
  })

  it('Riepilogo sheet includes net cash flow value', () => {
    const wb = buildExcelWorkbook(makePayload())
    const ws = wb.Sheets['Riepilogo']
    // Search for the net cash flow value (800) in the sheet
    const cells = Object.values(ws).filter((cell): cell is { v: unknown } => typeof cell === 'object' && cell !== null && 'v' in cell)
    expect(cells.some((c) => c.v === 800)).toBe(true)
  })

  it('shows No for inactive account', () => {
    const wb = buildExcelWorkbook(makePayload({
      accounts: [
        { accountId: 'acc-2', accountName: 'Archiviato', type: 'savings', currency: 'EUR', color: '#94a3b8', isActive: false, isHidden: false, startingBalance: 0, income: 0, expenses: 0, transfers: 0, endingBalance: 0, change: 0, transactionCount: 0 },
      ],
    }))
    const ws = wb.Sheets['Conti']
    // D2 = isActive cell — should be 'No' for inactive account
    expect(ws['D2']?.v).toBe('No')
  })

  it('handles null fixedExpensePercentage and variableExpensePercentage', () => {
    const wb = buildExcelWorkbook(makePayload({
      fixedVariable: {
        fixedExpenses: 0,
        variableExpenses: 0,
        unclassifiedExpenses: 0,
        fixedExpensePercentage: null,
        variableExpensePercentage: null,
        recurringTransactionsCount: 0,
        activeRecurringRulesCount: 0,
        averageFixedMonthlyExpense: 0,
        classificationNote: 'Nessuna spesa nel periodo.',
      },
    }))
    const ws = wb.Sheets['Fisse e variabili']
    expect(ws).toBeDefined()
    // C2 = fixedExpensePercentage (null → null in cell)
    expect(ws['C2']?.v ?? null).toBeNull()
  })

  it('downloadExcel calls writeFile with auto-generated filename when none given', () => {
    writeFileMock.mockClear()
    downloadExcel(makePayload())
    expect(writeFileMock).toHaveBeenCalledOnce()
    const filename = writeFileMock.mock.calls[0][1] as string
    expect(filename).toContain('aurora-report')
    expect(filename).toContain('.xlsx')
  })

  it('downloadExcel calls writeFile with provided filename', () => {
    writeFileMock.mockClear()
    downloadExcel(makePayload(), 'custom-export.xlsx')
    expect(writeFileMock).toHaveBeenCalledWith(expect.anything(), 'custom-export.xlsx')
  })
})
