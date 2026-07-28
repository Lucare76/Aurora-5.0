import * as XLSX from 'xlsx'
import type { ReportPayload } from './types'

type SheetRow = (string | number | null)[]

function sheetSummary(report: ReportPayload): SheetRow[] {
  return [
    [`Riepilogo — Periodo: ${report.period.label}`],
    [],
    ['Voce', 'Importo', 'Unità'],
    ['Entrate totali', report.summary.totalIncome, 'EUR'],
    ['Uscite totali', report.summary.totalExpenses, 'EUR'],
    ['Cash flow netto', report.summary.netCashFlow, 'EUR'],
    ['Tasso di risparmio', report.summary.savingsRate, '%'],
    ['Patrimonio netto iniziale', report.summary.netWorthStart, 'EUR'],
    ['Patrimonio netto finale', report.summary.netWorthEnd, 'EUR'],
    ['Variazione patrimonio', report.summary.netWorthChange, 'EUR'],
    ['Numero movimenti', report.summary.transactionCount, ''],
    ['Trasferimenti interni', report.summary.internalTransfersAmount, 'EUR'],
    ['Media mensile entrate', report.summary.averageMonthlyIncome, 'EUR'],
    ['Media mensile uscite', report.summary.averageMonthlyExpenses, 'EUR'],
    ['Media mensile cash flow', report.summary.averageMonthlyCashFlow, 'EUR'],
    [],
    ['Periodo corrente', report.period.from, report.period.to],
    ['Periodo precedente', report.previousPeriod.from, report.previousPeriod.to],
    [],
    ['Confronto', 'Valore corrente', 'Valore precedente', 'Variazione assoluta', 'Variazione %', 'Trend'],
    ['Entrate', report.comparison.totalIncome.currentValue, report.comparison.totalIncome.previousValue, report.comparison.totalIncome.absoluteChange, report.comparison.totalIncome.percentageChange, report.comparison.totalIncome.trend],
    ['Uscite', report.comparison.totalExpenses.currentValue, report.comparison.totalExpenses.previousValue, report.comparison.totalExpenses.absoluteChange, report.comparison.totalExpenses.percentageChange, report.comparison.totalExpenses.trend],
    ['Cash flow', report.comparison.netCashFlow.currentValue, report.comparison.netCashFlow.previousValue, report.comparison.netCashFlow.absoluteChange, report.comparison.netCashFlow.percentageChange, report.comparison.netCashFlow.trend],
    ['Patrimonio', report.comparison.netWorthEnd.currentValue, report.comparison.netWorthEnd.previousValue, report.comparison.netWorthEnd.absoluteChange, report.comparison.netWorthEnd.percentageChange, report.comparison.netWorthEnd.trend],
  ]
}

function sheetMonthlySeries(report: ReportPayload): SheetRow[] {
  if (report.monthlySeries.length === 0) return []
  return [
    ['Mese', 'Da', 'A', 'Entrate', 'Uscite', 'Cash flow', 'Tasso risparmio (%)', 'Movimenti', 'Cash flow cumulativo', 'Patrimonio netto'],
    ...report.monthlySeries.map((row) => [
      row.key,
      row.from,
      row.to,
      row.income,
      row.expenses,
      row.cashFlow,
      row.savingsRate ?? null,
      row.transactionCount,
      row.cumulativeCashFlow,
      row.netWorth ?? null,
    ]),
  ]
}

function sheetExpenseCategories(report: ReportPayload): SheetRow[] {
  if (report.expenseCategories.length === 0) return []
  return [
    ['Categoria', 'Categoria padre', 'Importo', '% sul totale', 'Movimenti', 'Media movimento', 'Confronto', 'Variazione %'],
    ...report.expenseCategories.map((row) => [
      row.categoryName,
      row.parentCategory ?? null,
      row.amount,
      row.percentage,
      row.transactionCount,
      row.averageTransaction,
      row.changeAmount,
      row.changePercentage ?? null,
    ]),
  ]
}

function sheetIncomeCategories(report: ReportPayload): SheetRow[] {
  if (report.incomeCategories.length === 0) return []
  return [
    ['Categoria', 'Categoria padre', 'Importo', '% sul totale', 'Movimenti', 'Media movimento', 'Confronto', 'Variazione %'],
    ...report.incomeCategories.map((row) => [
      row.categoryName,
      row.parentCategory ?? null,
      row.amount,
      row.percentage,
      row.transactionCount,
      row.averageTransaction,
      row.changeAmount,
      row.changePercentage ?? null,
    ]),
  ]
}

function sheetAccounts(report: ReportPayload): SheetRow[] {
  if (report.accounts.length === 0) return []
  return [
    ['Conto', 'Tipo', 'Valuta', 'Attivo', 'Saldo iniziale', 'Entrate', 'Uscite', 'Trasferimenti', 'Saldo finale', 'Variazione', 'Movimenti'],
    ...report.accounts.map((row) => [
      row.accountName,
      row.type,
      row.currency,
      row.isActive ? 'Sì' : 'No',
      row.startingBalance,
      row.income,
      row.expenses,
      row.transfers,
      row.endingBalance,
      row.change,
      row.transactionCount,
    ]),
  ]
}

function sheetFixedVariable(report: ReportPayload): SheetRow[] {
  const fv = report.fixedVariable
  return [
    ['Voce', 'Importo', 'Percentuale'],
    ['Uscite fisse', fv.fixedExpenses, fv.fixedExpensePercentage ?? null],
    ['Uscite variabili', fv.variableExpenses, fv.variableExpensePercentage ?? null],
    ['Uscite non classificate', fv.unclassifiedExpenses, null],
    [],
    ['Media mensile spese fisse', fv.averageFixedMonthlyExpense, 'EUR'],
    ['Movimenti ricorrenti', fv.recurringTransactionsCount, ''],
    ['Regole ricorrenti attive', fv.activeRecurringRulesCount, ''],
    [],
    ['Nota', fv.classificationNote],
  ]
}

function sheetInsights(report: ReportPayload): SheetRow[] {
  if (report.insights.length === 0) return []
  return [
    ['Tipo', 'Severità', 'Titolo', 'Messaggio'],
    ...report.insights.map((item) => [item.type, item.severity, item.title, item.message]),
  ]
}

function applyColumnWidths(sheet: XLSX.WorkSheet): void {
  const ref = sheet['!ref']
  if (!ref) return
  const range = XLSX.utils.decode_range(ref)
  const widths: XLSX.ColInfo[] = []
  for (let col = range.s.c; col <= range.e.c; col++) {
    let max = 8
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })]
      if (cell?.v) {
        const len = String(cell.v).length
        if (len > max) max = len
      }
    }
    widths.push({ wch: Math.min(max + 2, 42) })
  }
  sheet['!cols'] = widths
}

export function buildExcelWorkbook(report: ReportPayload): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  const sheets: Array<{ name: string; data: SheetRow[] }> = [
    { name: 'Riepilogo', data: sheetSummary(report) },
    { name: 'Andamento mensile', data: sheetMonthlySeries(report) },
    { name: 'Uscite per categoria', data: sheetExpenseCategories(report) },
    { name: 'Entrate per categoria', data: sheetIncomeCategories(report) },
    { name: 'Conti', data: sheetAccounts(report) },
    { name: 'Fisse e variabili', data: sheetFixedVariable(report) },
    { name: 'Insight', data: sheetInsights(report) },
  ]

  for (const { name, data } of sheets) {
    if (data.length === 0) continue
    const ws = XLSX.utils.aoa_to_sheet(data)
    applyColumnWidths(ws)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  return wb
}

export function downloadExcel(report: ReportPayload, filename?: string): void {
  const wb = buildExcelWorkbook(report)
  const name = filename ?? `aurora-report-${report.period.from}-${report.period.to}.xlsx`
  XLSX.writeFile(wb, name)
}
