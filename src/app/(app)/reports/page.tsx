'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Landmark,
  PieChart as PieChartIcon,
  Printer,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency } from '@/lib/utils'
import { downloadExcel } from '@/lib/reports/excel'
import { buildReportFilename } from '@/lib/reports/filename'
import { csvCell } from '@/lib/reports/csv'
import { resolveTemplate } from '@/lib/reports/registry'
import {
  getActiveSections,
  getAvailableTableViews,
  getCategoryMode,
  hasSection,
  resolveDefaultTableView,
  resolveInitialFilters,
} from '@/lib/reports/template-view'
import type { ReportDetailTableView, ReportPayload, ReportRange, ReportTransactionTypeFilter } from '@/lib/reports/types'

// Every ReportSection in the registry maps to exactly one block below:
//   kpi-income/kpi-expenses/kpi-cashflow/kpi-net-worth -> the 4 KPI cards
//   monthly-series   -> trend LineChart + income/expenses/cashflow lines + "Mesi" table tab
//   expense-categories / income-categories -> category BarChart + "Categorie" table tab
//     (getCategoryMode: 'income'/'expense' pick one side; 'both' — CATEGORIES only,
//     no dedicated KPI row — shows an inner Uscite/Entrate tab for both sides)
//   fixed-variable   -> "Fisse e variabili" card
//   net-worth        -> net worth evolution LineChart
//   transfers-summary-> "Trasferimenti interni" card
//   comparison       -> "Tasso di risparmio" card
//   insights         -> "Insight" card
//   accounts         -> "Conti" table tab
// No template (tpl missing/unknown) -> sections === null -> every block shown (legacy behavior).

const RANGE_OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: 'current-month', label: 'Mese corrente' },
  { value: 'previous-month', label: 'Mese precedente' },
  { value: 'last-3-months', label: 'Ultimi 3 mesi' },
  { value: 'last-6-months', label: 'Ultimi 6 mesi' },
  { value: 'current-year', label: 'Anno corrente' },
  { value: 'previous-year', label: 'Anno precedente' },
  { value: 'last-12-months', label: 'Ultimi 12 mesi' },
  { value: 'custom', label: 'Personalizzato' },
]

const TYPE_OPTIONS: Array<{ value: ReportTransactionTypeFilter; label: string }> = [
  { value: 'both', label: 'Entrate e uscite' },
  { value: 'income', label: 'Solo entrate' },
  { value: 'expense', label: 'Solo uscite' },
  { value: 'all', label: 'Tutto' },
]

const TABLE_VIEW_LABELS: Record<ReportDetailTableView, string> = {
  monthly: 'Mesi',
  categories: 'Categorie',
  accounts: 'Conti',
}

function initialParams() {
  if (typeof window === 'undefined') return resolveInitialFilters(new URLSearchParams())
  return resolveInitialFilters(new URLSearchParams(window.location.search))
}

function chartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-[#e5e7f0] bg-white px-4 py-3 text-sm shadow-xl">
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-8">
            <span className="flex items-center gap-2 text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(Number(item.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function trendIcon(trend: string) {
  if (trend === 'UP') return <ArrowUp className="h-3.5 w-3.5" />
  if (trend === 'DOWN') return <ArrowDown className="h-3.5 w-3.5" />
  return <ArrowRight className="h-3.5 w-3.5" />
}

function trendText(change: number | null) {
  if (change === null) return 'Confronto non disponibile'
  const sign = change > 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}% vs periodo precedente`
}

function KpiCard({
  title,
  value,
  detail,
  tone,
  icon,
  href,
}: {
  title: string
  value: string
  detail: string
  tone: 'indigo' | 'emerald' | 'red' | 'violet'
  icon: React.ReactNode
  href?: string
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  const body = (
    <Card className="h-full border-[#e5e7f0] bg-white shadow-sm transition hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-3 truncate text-2xl font-bold tabular-nums text-slate-950">{value}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', colors[tone])}>{icon}</div>
        </div>
        <p className="mt-4 flex items-center gap-1 text-xs font-medium text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href} aria-label={`Apri movimenti per ${title}`}>{body}</Link> : body
}

function buildCsv(report: ReportPayload) {
  const lines: Array<Array<string | number | null>> = [
    ['Sezione', 'Voce', 'Periodo', 'Valore', 'Dettaglio'],
    ['Riepilogo', 'Entrate totali', report.period.label, report.summary.totalIncome, 'EUR'],
    ['Riepilogo', 'Uscite totali', report.period.label, report.summary.totalExpenses, 'EUR'],
    ['Riepilogo', 'Cash flow netto', report.period.label, report.summary.netCashFlow, 'EUR'],
    ['Riepilogo', 'Tasso di risparmio', report.period.label, report.summary.savingsRate ?? null, '%'],
    [],
    ['Mese', 'Entrate', 'Uscite', 'Cash flow', 'Movimenti'],
    ...report.monthlySeries.map((row) => [row.key, row.income, row.expenses, row.cashFlow, row.transactionCount]),
    [],
    ['Categoria uscite', 'Importo', 'Percentuale', 'Movimenti', 'Confronto'],
    ...report.expenseCategories.map((row) => [row.categoryName, row.amount, row.percentage, row.transactionCount, row.changeAmount]),
    [],
    ['Categoria entrate', 'Importo', 'Percentuale', 'Movimenti', 'Confronto'],
    ...report.incomeCategories.map((row) => [row.categoryName, row.amount, row.percentage, row.transactionCount, row.changeAmount]),
    [],
    ['Conto', 'Saldo iniziale', 'Entrate', 'Uscite', 'Saldo finale'],
    ...report.accounts.map((row) => [row.accountName, row.startingBalance, row.income, row.expenses, row.endingBalance]),
  ]
  return `﻿${lines.map((row) => row.map(csvCell).join(';')).join('\n')}`
}

function downloadCsv(report: ReportPayload) {
  const blob = new Blob([buildCsv(report)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = buildReportFilename(report.period.from, report.period.to, null, 'csv')
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function FilterSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn('h-10 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100', props.className)}
    />
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-3xl" />)}
      </div>
      <Skeleton className="h-80 rounded-3xl" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [params, setParams] = useState(() => initialParams())
  const [report, setReport] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableView, setTableView] = useState<ReportDetailTableView>('monthly')

  const tpl = params.get('tpl')
  const activeTemplate = useMemo(() => resolveTemplate(tpl), [tpl])
  const sections = useMemo(() => getActiveSections(tpl), [tpl])

  const showKpiIncome = hasSection(sections, 'kpi-income')
  const showKpiExpenses = hasSection(sections, 'kpi-expenses')
  const showKpiCashflow = hasSection(sections, 'kpi-cashflow')
  const showKpiNetWorth = hasSection(sections, 'kpi-net-worth')
  const hasAnyKpi = showKpiIncome || showKpiExpenses || showKpiCashflow || showKpiNetWorth

  const showMonthlySeries = hasSection(sections, 'monthly-series')
  const showExpenseCategories = hasSection(sections, 'expense-categories')
  const showIncomeCategories = hasSection(sections, 'income-categories')
  const showCategoriesBlock = showExpenseCategories || showIncomeCategories
  const showFixedVariable = hasSection(sections, 'fixed-variable')
  const showNetWorthChart = hasSection(sections, 'net-worth')
  const showTransfersSummary = hasSection(sections, 'transfers-summary')
  const showComparisonCard = hasSection(sections, 'comparison')
  const showInsights = hasSection(sections, 'insights')
  const showAccountsBlock = hasSection(sections, 'accounts')

  // Only INCOME/EXPENSES ask for exactly one side of the KPI trio: narrow the trend
  // chart's lines to match, everyone else (incl. no template) keeps all three.
  const chartSeriesMode: 'income-only' | 'expenses-only' | 'all' =
    showKpiIncome && !showKpiExpenses && !showKpiCashflow ? 'income-only'
      : showKpiExpenses && !showKpiIncome && !showKpiCashflow ? 'expenses-only'
        : 'all'
  const showIncomeLine = chartSeriesMode !== 'expenses-only'
  const showExpensesLine = chartSeriesMode !== 'income-only'
  const showCashflowLine = chartSeriesMode === 'all'

  const categoryMode = useMemo(() => getCategoryMode(sections), [sections])
  const availableTableViews = useMemo(() => getAvailableTableViews(sections), [sections])
  // Only meaningful when categoryMode === 'both' (CATEGORIES): which inner tab
  // (Uscite/Entrate) is active. Reset to the default whenever the template changes.
  const [categorySide, setCategorySide] = useState<'expense' | 'income'>('expense')
  const effectiveCategorySide: 'expense' | 'income' = categoryMode === 'both' ? categorySide : categoryMode

  useEffect(() => {
    setTableView((current) => resolveDefaultTableView(availableTableViews, current))
  }, [availableTableViews])

  useEffect(() => {
    setCategorySide('expense')
  }, [categoryMode])

  const queryString = params.toString()
  const customRange = params.get('range') === 'custom'

  const setParam = useCallback((key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (!value || value === 'all') next.delete(key)
      else next.set(key, value)
      const normalized = key === 'range' ? resolveInitialFilters(next) : next
      const href = `/reports?${normalized.toString()}`
      window.history.replaceState(null, '', href)
      return normalized
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    // tpl only drives which sections this page shows — the report engine has no
    // concept of it and doesn't need one, so it's stripped before the fetch.
    const fetchParams = new URLSearchParams(params)
    fetchParams.delete('tpl')
    fetch(`/api/reports?${fetchParams.toString()}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error ?? 'REPORT_FAILED')
        setReport(payload as ReportPayload)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message === 'UNAUTHORIZED' ? 'Sessione scaduta. Effettua nuovamente l’accesso.' : 'Report non disponibile per i filtri selezionati.')
        setReport(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  const transactionBase = useMemo(() => {
    if (!report) return '/transactions'
    const next = new URLSearchParams()
    next.set('from', report.period.from)
    next.set('to', report.period.to)
    return `/transactions?${next.toString()}`
  }, [report])

  const activeCategoryRows = report ? (effectiveCategorySide === 'income' ? report.incomeCategories : report.expenseCategories) : []
  const categoryChartTitle = effectiveCategorySide === 'income' ? 'Entrate per categoria' : 'Spese per categoria'
  const categoryChartColor = effectiveCategorySide === 'income' ? '#10b981' : '#6366f1'
  const netWorthSeries = report?.netWorth.monthlySeries ?? []

  // ACCOUNTS/NET_WORTH are about balances, which exist independently of whether the
  // selected period has any transactions — don't hide them behind the "no movements"
  // empty state the way a transaction-driven template (MONTHLY, INCOME, ...) should.
  const contentIsEmpty = Boolean(report) && report!.summary.transactionCount === 0 && !showAccountsBlock && !showNetWorthChart

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <style jsx global>{`
        @media print {
          aside, nav, header, .aurora-no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .aurora-print-card { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Analisi finanziaria</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-semibold tracking-tight text-slate-950">
              Report
              {activeTemplate && (
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600">{activeTemplate.label}</span>
              )}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {activeTemplate ? activeTemplate.description : 'Confronta entrate, uscite, cash flow e patrimonio usando solo i dati reali di Aurora.'}
            </p>
          </div>
          <div className="aurora-no-print flex flex-wrap gap-2">
            <Link href="/reports/new" className={buttonVariants({ variant: 'outline', className: 'h-10 gap-2' })}>
              <LayoutGrid className="h-4 w-4" />
              Template
            </Link>
            <Button variant="outline" className="h-10 gap-2" onClick={() => report && downloadCsv(report)} disabled={!report || loading}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" className="h-10 gap-2" onClick={() => report && downloadExcel(report, buildReportFilename(report.period.from, report.period.to, null, 'xlsx'))} disabled={!report || loading}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" className="h-10 gap-2" onClick={() => window.print()} disabled={!report || loading}>
              <Printer className="h-4 w-4" />
              Stampa
            </Button>
          </div>
        </header>

        <Card className="aurora-no-print border-[#e5e7f0] bg-white shadow-sm">
          <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
            <FilterSelect value={params.get('range') ?? 'current-month'} onChange={(event) => setParam('range', event.target.value)} aria-label="Periodo report">
              {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </FilterSelect>
            {customRange && (
              <>
                <input type="date" value={params.get('from') ?? ''} onChange={(event) => setParam('from', event.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" aria-label="Data iniziale" />
                <input type="date" value={params.get('to') ?? ''} onChange={(event) => setParam('to', event.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" aria-label="Data finale" />
              </>
            )}
            <FilterSelect value={params.get('type') ?? 'both'} onChange={(event) => setParam('type', event.target.value)} aria-label="Tipo movimento">
              {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </FilterSelect>
            <FilterSelect value={params.get('account') ?? 'all'} onChange={(event) => setParam('account', event.target.value)} aria-label="Filtro conto">
              <option value="all">Tutti i conti</option>
              {report?.accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.accountName}</option>)}
            </FilterSelect>
            <FilterSelect value={params.get('category') ?? 'all'} onChange={(event) => setParam('category', event.target.value)} aria-label="Filtro categoria">
              <option value="all">Tutte le categorie</option>
              {(report?.categoryOptions ?? []).map((category) => <option key={category.categoryId} value={category.categoryId}>{category.parentCategory ? `${category.parentCategory} / ${category.categoryName}` : category.categoryName}</option>)}
            </FilterSelect>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm font-medium text-slate-600">
              <input type="checkbox" checked={params.get('includeTransfers') === 'true'} onChange={(event) => setParam('includeTransfers', event.target.checked ? 'true' : '')} />
              Trasferimenti
            </label>
          </CardContent>
        </Card>

        {loading && <ReportSkeleton />}

        {!loading && error && (
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-10 text-center">
              <p className="font-semibold text-slate-900">{error}</p>
              <Button className="mt-4 gap-2" onClick={() => setParams(initialParams())}>
                <RefreshCw className="h-4 w-4" />
                Ripristina filtri
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && report && (
          <>
            {hasAnyKpi && (
              <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {showKpiIncome && <KpiCard title="Entrate" value={formatCurrency(report.summary.totalIncome)} detail={trendText(report.comparison.totalIncome.percentageChange)} tone="emerald" icon={<TrendingUp className="h-5 w-5" />} href={`${transactionBase}&type=income`} />}
                {showKpiExpenses && <KpiCard title="Uscite" value={formatCurrency(report.summary.totalExpenses)} detail={trendText(report.comparison.totalExpenses.percentageChange)} tone="red" icon={<TrendingDown className="h-5 w-5" />} href={`${transactionBase}&type=expense`} />}
                {showKpiCashflow && <KpiCard title="Cash flow" value={formatCurrency(report.summary.netCashFlow)} detail={trendText(report.comparison.netCashFlow.percentageChange)} tone="indigo" icon={<BarChart3 className="h-5 w-5" />} href={transactionBase} />}
                {showKpiNetWorth && <KpiCard title="Patrimonio netto" value={formatCurrency(report.summary.netWorthEnd)} detail={`${report.summary.netWorthChange >= 0 ? '+' : ''}${formatCurrency(report.summary.netWorthChange)} nel periodo`} tone="violet" icon={<Wallet className="h-5 w-5" />} />}
              </section>
            )}

            {contentIsEmpty ? (
              <Card className="border-[#e5e7f0] bg-white shadow-sm">
                <CardContent className="p-12 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 font-semibold text-slate-900">Non ci sono movimenti nel periodo selezionato.</p>
                  <p className="mt-2 text-sm text-slate-500">Prova ad ampliare l’intervallo o modificare i filtri.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {showMonthlySeries && (
                  <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">{report.monthlySeries[0]?.key.length === 10 ? 'Andamento giornaliero' : 'Andamento mensile'}</CardTitle>
                      <p className="text-sm text-slate-500">Entrate, uscite e cash flow cumulativo. Periodo: {report.period.label}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[330px]" role="img" aria-label="Grafico andamento mensile di entrate, uscite e cash flow">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={report.monthlySeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                            <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={12} />
                            <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={12} tickFormatter={(value) => formatCurrency(Number(value)).replace(',00', '')} />
                            <Tooltip content={chartTooltip} />
                            <Legend iconType="circle" iconSize={8} />
                            {showIncomeLine && <Line type="monotone" dataKey="income" name="Entrate" stroke="#10b981" strokeWidth={2.5} dot={false} />}
                            {showExpensesLine && <Line type="monotone" dataKey="expenses" name="Uscite" stroke="#ef4444" strokeWidth={2.5} dot={false} />}
                            {showCashflowLine && <Line type="monotone" dataKey="cashFlow" name="Cash flow" stroke="#6366f1" strokeWidth={2.5} dot={false} />}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showNetWorthChart && (
                  <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">Evoluzione patrimonio</CardTitle>
                      <p className="text-sm text-slate-500">Patrimonio netto mese per mese. Massimo: {formatCurrency(report.netWorth.highestNetWorth)} · Minimo: {formatCurrency(report.netWorth.lowestNetWorth)}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[280px]" role="img" aria-label="Grafico evoluzione del patrimonio netto">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={netWorthSeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                            <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={12} />
                            <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={12} tickFormatter={(value) => formatCurrency(Number(value)).replace(',00', '')} />
                            <Tooltip content={chartTooltip} />
                            <Line type="monotone" dataKey="netWorth" name="Patrimonio netto" stroke="#8b5cf6" strokeWidth={2.5} dot={false} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(showCategoriesBlock || showInsights) && (
                  <section className="grid gap-6 xl:grid-cols-3">
                    {showCategoriesBlock && (
                      <Card className={cn('aurora-print-card border-[#e5e7f0] bg-white shadow-sm', showInsights ? 'xl:col-span-2' : 'xl:col-span-3')}>
                        <CardHeader>
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                              <CardTitle className="text-lg">{categoryChartTitle}</CardTitle>
                              <p className="text-sm text-slate-500">Vista aggregata per categoria padre, con sottocategorie nel dettaglio.</p>
                            </div>
                            {categoryMode === 'both' && (
                              <div className="aurora-no-print flex rounded-xl bg-slate-100 p-1">
                                <button type="button" onClick={() => setCategorySide('expense')} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', effectiveCategorySide === 'expense' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500')}>Uscite</button>
                                <button type="button" onClick={() => setCategorySide('income')} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', effectiveCategorySide === 'income' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500')}>Entrate</button>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={activeCategoryRows.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 24 }}>
                                <CartesianGrid horizontal={false} stroke="#e5e7f0" />
                                <XAxis type="number" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={12} tickFormatter={(value) => formatCurrency(Number(value)).replace(',00', '')} />
                                <YAxis type="category" dataKey="categoryName" tickLine={false} axisLine={false} stroke="#64748b" fontSize={12} width={110} />
                                <Tooltip content={chartTooltip} />
                                <Bar dataKey="amount" name={effectiveCategorySide === 'income' ? 'Entrate' : 'Uscite'} fill={categoryChartColor} radius={[0, 8, 8, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {showInsights && (
                      <Card className={cn('aurora-print-card border-[#e5e7f0] bg-white shadow-sm', showCategoriesBlock ? '' : 'xl:col-span-3')}>
                        <CardHeader>
                          <CardTitle className="text-lg">Insight</CardTitle>
                          <p className="text-sm text-slate-500">Regole deterministiche, senza AI.</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {report.insights.map((item) => (
                            <div key={item.type} className="rounded-2xl border border-[#e5e7f0] bg-slate-50 p-4">
                              <div className="flex items-center gap-2">
                                <span className={cn('h-2.5 w-2.5 rounded-full', item.severity === 'SUCCESS' ? 'bg-emerald-500' : item.severity === 'DANGER' ? 'bg-red-500' : item.severity === 'WARNING' ? 'bg-amber-500' : 'bg-indigo-500')} />
                                <p className="font-semibold text-slate-900">{item.title}</p>
                              </div>
                              <p className="mt-2 text-sm text-slate-500">{item.message}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </section>
                )}

                {(showComparisonCard || showFixedVariable || showTransfersSummary) && (
                  <section className="grid gap-6 xl:grid-cols-3">
                    {showComparisonCard && (
                      <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-lg">Tasso di risparmio</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-4xl font-bold tabular-nums text-slate-950">{report.summary.savingsRate === null ? '—' : `${report.summary.savingsRate.toFixed(1)}%`}</p>
                          <p className="mt-3 flex items-center gap-1 text-sm text-slate-500">{trendIcon(report.comparison.savingsRate.trend)} {trendText(report.comparison.savingsRate.percentageChange)}</p>
                        </CardContent>
                      </Card>
                    )}
                    {showFixedVariable && (
                      <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-lg">Fisse e variabili</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Uscite fisse</span><strong>{formatCurrency(report.fixedVariable.fixedExpenses)}</strong></div>
                          <div className="flex justify-between"><span className="text-slate-500">Uscite variabili</span><strong>{formatCurrency(report.fixedVariable.variableExpenses)}</strong></div>
                          <p className="text-xs text-slate-400">{report.fixedVariable.classificationNote}</p>
                        </CardContent>
                      </Card>
                    )}
                    {showTransfersSummary && (
                      <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-lg">Trasferimenti interni</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold tabular-nums text-slate-950">{formatCurrency(report.summary.internalTransfersAmount)}</p>
                          <p className="mt-3 text-sm text-slate-500">Sono esclusi da entrate, uscite e cash flow complessivo.</p>
                        </CardContent>
                      </Card>
                    )}
                  </section>
                )}

                {availableTableViews.length > 0 && (
                  <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                    <CardHeader>
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <CardTitle className="text-lg">Tabella dati</CardTitle>
                          <p className="text-sm text-slate-500">Dataset già aggregato dal server.</p>
                        </div>
                        {availableTableViews.length > 1 && (
                          <div className="aurora-no-print flex rounded-xl bg-slate-100 p-1">
                            {availableTableViews.map((view) => (
                              <button key={view} type="button" onClick={() => setTableView(view)} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', tableView === view ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500')}>
                                {TABLE_VIEW_LABELS[view]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        {tableView === 'monthly' && (
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-slate-50 text-left text-slate-500"><th className="px-5 py-3">{report.monthlySeries[0]?.key.length === 10 ? 'Giorno' : 'Mese'}</th><th className="px-5 py-3 text-right">Entrate</th><th className="px-5 py-3 text-right">Uscite</th><th className="px-5 py-3 text-right">Cash flow</th><th className="px-5 py-3 text-right">Tasso</th><th className="px-5 py-3 text-right">Movimenti</th></tr></thead>
                            <tbody>{report.monthlySeries.map((row) => <tr key={row.key} className="border-b last:border-b-0"><td className="px-5 py-3 font-semibold text-slate-900"><Link className="hover:text-indigo-600" href={`/transactions?from=${row.from}&to=${row.to}`}>{row.key}</Link></td><td className="px-5 py-3 text-right tabular-nums text-emerald-600">{formatCurrency(row.income)}</td><td className="px-5 py-3 text-right tabular-nums text-red-600">{formatCurrency(row.expenses)}</td><td className="px-5 py-3 text-right tabular-nums font-semibold">{formatCurrency(row.cashFlow)}</td><td className="px-5 py-3 text-right tabular-nums">{row.savingsRate === null ? '—' : `${row.savingsRate.toFixed(1)}%`}</td><td className="px-5 py-3 text-right tabular-nums">{row.transactionCount}</td></tr>)}</tbody>
                          </table>
                        )}
                        {tableView === 'categories' && (
                          <>
                            {categoryMode === 'both' && (
                              <div className="aurora-no-print flex justify-end gap-1 border-b bg-slate-50 p-2">
                                <button type="button" onClick={() => setCategorySide('expense')} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', effectiveCategorySide === 'expense' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500')}>Uscite</button>
                                <button type="button" onClick={() => setCategorySide('income')} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', effectiveCategorySide === 'income' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500')}>Entrate</button>
                              </div>
                            )}
                            <table className="w-full text-sm">
                              <thead><tr className="border-b bg-slate-50 text-left text-slate-500"><th className="px-5 py-3">Categoria</th><th className="px-5 py-3 text-right">Importo</th><th className="px-5 py-3 text-right">%</th><th className="px-5 py-3 text-right">Confronto</th><th className="px-5 py-3 text-right">Movimenti</th></tr></thead>
                              <tbody>{activeCategoryRows.map((row) => <tr key={row.categoryId} className="border-b last:border-b-0"><td className="px-5 py-3"><Link className="font-semibold text-slate-900 hover:text-indigo-600" href={`${transactionBase}&category=${row.categoryId}&type=${effectiveCategorySide}`}>{row.icon} {row.categoryName}</Link>{row.children.length > 0 && <p className="mt-1 text-xs text-slate-400">{row.children.map((child) => child.categoryName).join(', ')}</p>}</td><td className="px-5 py-3 text-right tabular-nums font-semibold">{formatCurrency(row.amount)}</td><td className="px-5 py-3 text-right tabular-nums">{row.percentage.toFixed(1)}%</td><td className="px-5 py-3 text-right tabular-nums">{row.changeAmount >= 0 ? '+' : ''}{formatCurrency(row.changeAmount)}</td><td className="px-5 py-3 text-right tabular-nums">{row.transactionCount}</td></tr>)}</tbody>
                            </table>
                          </>
                        )}
                        {tableView === 'accounts' && (
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-slate-50 text-left text-slate-500"><th className="px-5 py-3">Conto</th><th className="px-5 py-3 text-right">Saldo iniziale</th><th className="px-5 py-3 text-right">Entrate</th><th className="px-5 py-3 text-right">Uscite</th><th className="px-5 py-3 text-right">Trasferimenti</th><th className="px-5 py-3 text-right">Saldo finale</th></tr></thead>
                            <tbody>{report.accounts.map((row) => <tr key={row.accountId} className="border-b last:border-b-0"><td className="px-5 py-3"><Link className="font-semibold text-slate-900 hover:text-indigo-600" href={`${transactionBase}&account=${row.accountId}`}>{row.accountName}</Link><p className="text-xs text-slate-400">{row.type}</p></td><td className="px-5 py-3 text-right tabular-nums">{formatCurrency(row.startingBalance)}</td><td className="px-5 py-3 text-right tabular-nums text-emerald-600">{formatCurrency(row.income)}</td><td className="px-5 py-3 text-right tabular-nums text-red-600">{formatCurrency(row.expenses)}</td><td className="px-5 py-3 text-right tabular-nums">{formatCurrency(row.transfers)}</td><td className="px-5 py-3 text-right tabular-nums font-semibold">{formatCurrency(row.endingBalance)}</td></tr>)}</tbody>
                          </table>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                  <CardContent className="grid gap-4 p-5 text-sm text-slate-600 md:grid-cols-3">
                    <div className="flex gap-3"><Landmark className="h-5 w-5 text-indigo-500" /><span>Patrimonio: somma dei saldi dei conti attivi, coerente con la Dashboard.</span></div>
                    <div className="flex gap-3"><PieChartIcon className="h-5 w-5 text-indigo-500" /><span>Categorie: sottocategorie aggregate nella categoria padre, con dettaglio disponibile.</span></div>
                    <div className="flex gap-3"><BarChart3 className="h-5 w-5 text-indigo-500" /><span>Query server: {report.metadata.queryCount}, cache disabilitata, dati isolati da RLS Supabase.</span></div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
