'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Download, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  calculateCategoryTotals,
  calculateExpenseTotal,
  calculateIncomeTotal,
  calculateNetTotal,
  isCountableExpense,
  isCountableIncome,
} from '@/domain/accounting/aggregations'
import { adaptTransactionRows } from '@/domain/accounting/transaction-adapter'
import { useCategories } from '@/hooks/use-categories'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types/database'

type Period = 'this-month' | 'last-month' | 'last-3-months' | 'last-year' | 'custom'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'this-month', label: 'Questo mese' },
  { value: 'last-month', label: 'Mese scorso' },
  { value: 'last-3-months', label: 'Ultimi 3 mesi' },
  { value: 'last-year', label: 'Ultimo anno' },
  { value: 'custom', label: 'Personalizzato' },
]

const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#84cc16', '#f97316',
]
const TRANSACTION_SELECT = 'id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at'

function getDateRange(
  period: Period,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  const now = new Date()
  switch (period) {
    case 'this-month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: start.toLocaleDateString('en-CA'), to: end.toLocaleDateString('en-CA') }
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: start.toLocaleDateString('en-CA'), to: end.toLocaleDateString('en-CA') }
    }
    case 'last-3-months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: start.toLocaleDateString('en-CA'), to: end.toLocaleDateString('en-CA') }
    }
    case 'last-year': {
      const start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: start.toLocaleDateString('en-CA'), to: end.toLocaleDateString('en-CA') }
    }
    case 'custom':
      return { from: customFrom, to: customTo }
  }
}

function getDaysBetween(from: string, to: string): number {
  const diff = new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-8">
            <span className="flex items-center gap-2 text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatCurrency(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <p className="font-semibold text-slate-900">{entry.name}</p>
      <p className="mt-1 text-slate-500">
        {formatCurrency(entry.value)} · {entry.payload.percent?.toFixed(1)}%
      </p>
    </div>
  )
}

function StatCard({
  title,
  value,
  detail,
  colorClass,
  icon,
}: {
  title: string
  value: string
  detail: string
  colorClass: string
  icon: React.ReactNode
}) {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-3 truncate text-2xl font-bold tabular-nums text-slate-950">{value}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', colorClass)}>
            {icon}
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-400">{detail}</p>
      </CardContent>
    </Card>
  )
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('this-month')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toLocaleDateString('en-CA')
  })
  const [customTo, setCustomTo] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])
  const currentYear = new Date().getFullYear()
  const availableYears = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i)
  const [yearA, setYearA] = useState(currentYear)
  const [yearB, setYearB] = useState(currentYear - 1)
  const [yoyTransA, setYoyTransA] = useState<Transaction[]>([])
  const [yoyTransB, setYoyTransB] = useState<Transaction[]>([])
  const [yoyLoading, setYoyLoading] = useState(false)
  const { categories } = useCategories()

  const dateRange = useMemo(
    () => getDateRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  const fetchYoy = useCallback(async () => {
    setYoyLoading(true)
    const [resA, resB] = await Promise.all([
      supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .eq('type', 'expense')
        .is('transfer_peer_id', null)
        .gte('date', `${yearA}-01-01`)
        .lte('date', `${yearA}-12-31`),
      supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .eq('type', 'expense')
        .is('transfer_peer_id', null)
        .gte('date', `${yearB}-01-01`)
        .lte('date', `${yearB}-12-31`),
    ])
    if (!resA.error && resA.data) setYoyTransA(resA.data as Transaction[])
    if (!resB.error && resB.data) setYoyTransB(resB.data as Transaction[])
    setYoyLoading(false)
  }, [supabase, yearA, yearB])

  useEffect(() => { fetchYoy() }, [fetchYoy])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .gte('date', dateRange.from)
      .lte('date', dateRange.to)
      .order('date', { ascending: true })

    if (!error && data) setTransactions(data as Transaction[])
    else if (error) toast.error('Errore nel caricamento dei dati')
    setLoading(false)
  }, [supabase, dateRange.from, dateRange.to])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const appTransactions = useMemo(
    () => adaptTransactionRows(transactions),
    [transactions],
  )
  const yoyAppTransA = useMemo(() => adaptTransactionRows(yoyTransA), [yoyTransA])
  const yoyAppTransB = useMemo(() => adaptTransactionRows(yoyTransB), [yoyTransB])
  const expenseTransactions = useMemo(
    () => appTransactions.filter(isCountableExpense),
    [appTransactions],
  )
  const incomeTransactions = useMemo(
    () => appTransactions.filter(isCountableIncome),
    [appTransactions],
  )

  const totalExpense = useMemo(
    () => calculateExpenseTotal(appTransactions),
    [appTransactions],
  )
  const totalIncome = useMemo(
    () => calculateIncomeTotal(appTransactions),
    [appTransactions],
  )
  const netSavings = useMemo(() => calculateNetTotal(appTransactions), [appTransactions])
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  const categoryExpenses = useMemo(() => {
    return calculateCategoryTotals(appTransactions, categories).map((entry) => {
      const category = categoryById.get(entry.categoryId)
      return {
        name: category?.name ?? 'Senza categoria',
        color: category?.color ?? '#94a3b8',
        amount: entry.amount,
        count: entry.count,
      }
    })
  }, [appTransactions, categories, categoryById])

  const pieData = useMemo(
    () =>
      categoryExpenses.map((entry, i) => ({
        ...entry,
        percent: totalExpense > 0 ? (entry.amount / totalExpense) * 100 : 0,
        fill: entry.color !== '#94a3b8' ? entry.color : CHART_COLORS[i % CHART_COLORS.length],
      })),
    [categoryExpenses, totalExpense],
  )

  const topCategories = pieData.slice(0, 10)

  const timeSeries = useMemo(() => {
    const days = getDaysBetween(dateRange.from, dateRange.to)
    const buckets = new Map<string, { label: string; income: number; expense: number }>()

    const getKey = (dateStr: string): { key: string; label: string } => {
      const d = new Date(`${dateStr}T00:00:00`)
      if (days <= 31) {
        return { key: dateStr, label: format(d, 'd MMM', { locale: it }) }
      }
      if (days <= 92) {
        const weekStart = new Date(d)
        const dayOfWeek = d.getDay()
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        weekStart.setDate(d.getDate() + diff)
        const k = weekStart.toLocaleDateString('en-CA')
        return { key: k, label: format(weekStart, 'd MMM', { locale: it }) }
      }
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return { key: k, label: format(d, 'MMM yy', { locale: it }) }
    }

    for (const t of appTransactions) {
      const { key, label } = getKey(t.date)
      const bucket = buckets.get(key) ?? { label, income: 0, expense: 0 }
      if (isCountableIncome(t)) bucket.income += t.amount
      if (isCountableExpense(t)) bucket.expense += t.amount
      buckets.set(key, bucket)
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
  }, [appTransactions, dateRange.from, dateRange.to])

  const tableData = useMemo(
    () =>
      categoryExpenses.map((entry) => ({
        ...entry,
        average: entry.count > 0 ? entry.amount / entry.count : 0,
        percent: totalExpense > 0 ? (entry.amount / totalExpense) * 100 : 0,
        fill:
          entry.color !== '#94a3b8'
            ? entry.color
            : CHART_COLORS[categoryExpenses.indexOf(entry) % CHART_COLORS.length],
      })),
    [categoryExpenses, totalExpense],
  )

  const yoyTableData = useMemo(() => {
    const map = new Map<string, { name: string; amtA: number; amtB: number }>()

    const addTxs = (txs: typeof yoyAppTransA, key: 'amtA' | 'amtB') => {
      for (const t of txs) {
        if (!isCountableExpense(t)) continue
        const cat = t.categoryId ? categoryById.get(t.categoryId) : null
        const parent = cat?.parent_id ? categoryById.get(cat.parent_id) : cat
        const k = parent?.id ?? 'no-category'
        const existing = map.get(k) ?? { name: parent?.name ?? 'Senza categoria', amtA: 0, amtB: 0 }
        existing[key] += t.amount
        map.set(k, existing)
      }
    }

    addTxs(yoyAppTransA, 'amtA')
    addTxs(yoyAppTransB, 'amtB')

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        diff: row.amtA - row.amtB,
        pct: row.amtB > 0 ? ((row.amtA - row.amtB) / row.amtB) * 100 : null,
      }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  }, [yoyAppTransA, yoyAppTransB, categoryById])

  const yoyChartData = useMemo(() => {
    return [...yoyTableData]
      .sort((a, b) => (b.amtA + b.amtB) - (a.amtA + a.amtB))
      .slice(0, 8)
      .map((row) => ({
        name: row.name.length > 14 ? `${row.name.slice(0, 13)}…` : row.name,
        [String(yearA)]: Math.round(row.amtA * 100) / 100,
        [String(yearB)]: Math.round(row.amtB * 100) / 100,
      }))
  }, [yoyTableData, yearA, yearB])

  const exportCSV = () => {
    const header = ['Data', 'Tipo', 'Descrizione', 'Categoria', 'Importo (EUR)']
    const rows = appTransactions
      .filter((t) => isCountableIncome(t) || isCountableExpense(t))
      .map((t) => {
        const cat = t.categoryId ? categoryById.get(t.categoryId) : null
        return [
          t.date,
          t.type === 'income' ? 'Entrata' : 'Uscita',
          `"${(t.description ?? '').replace(/"/g, '""')}"`,
          `"${(cat?.name ?? 'Senza categoria').replace(/"/g, '""')}"`,
          t.amount.toFixed(2),
        ]
      })
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aurora-report-${dateRange.from}-${dateRange.to}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('CSV esportato')
  }

  const periodLabel = `${format(new Date(`${dateRange.from}T00:00:00`), 'd MMM yyyy', { locale: it })} – ${format(new Date(`${dateRange.to}T00:00:00`), 'd MMM yyyy', { locale: it })}`
  const days = getDaysBetween(dateRange.from, dateRange.to)
  const granularityLabel = days <= 31 ? 'Giornaliero' : days <= 92 ? 'Settimanale' : 'Mensile'

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-indigo-600">Analisi</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Report</h1>
            {!loading && <p className="mt-1 text-sm text-slate-500">{periodLabel}</p>}
          </div>
          <Button
            variant="outline"
            className="h-11 gap-2 self-start sm:self-auto"
            onClick={exportCSV}
            disabled={loading || transactions.length === 0}
          >
            <Download className="h-4 w-4" />
            Esporta CSV
          </Button>
        </header>

        {/* Selettore periodo */}
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={cn(
                    'h-9 rounded-xl px-4 text-sm font-medium transition',
                    period === opt.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {period === 'custom' && (
                <div className="ml-2 flex items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-3xl" />
            <Skeleton className="h-80 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        ) : (
          <>
            {/* Riepilogo */}
            <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard
                title="Entrate totali"
                value={formatCurrency(totalIncome)}
                detail={`${incomeTransactions.length} transazioni`}
                colorClass="bg-emerald-100 text-emerald-600"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <StatCard
                title="Uscite totali"
                value={formatCurrency(totalExpense)}
                detail={`${expenseTransactions.length} transazioni`}
                colorClass="bg-red-100 text-red-600"
                icon={<TrendingDown className="h-5 w-5" />}
              />
              <StatCard
                title="Risparmio netto"
                value={formatCurrency(netSavings)}
                detail={netSavings >= 0 ? 'Periodo positivo' : 'Periodo negativo'}
                colorClass="bg-indigo-100 text-indigo-600"
                icon={<PiggyBank className="h-5 w-5" />}
              />
              <StatCard
                title="Tasso di risparmio"
                value={totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : '—'}
                detail={totalIncome > 0 ? 'risparmio / entrate' : 'Nessuna entrata nel periodo'}
                colorClass="bg-violet-100 text-violet-600"
                icon={<Wallet className="h-5 w-5" />}
              />
            </section>

            {appTransactions.filter((t) => isCountableIncome(t) || isCountableExpense(t)).length === 0 ? (
              <Card className="border-[#e5e7f0] bg-white shadow-sm">
                <CardContent className="p-12 text-center">
                  <p className="font-semibold text-slate-900">Nessuna transazione</p>
                  <p className="mt-2 text-sm text-slate-500">Nessun movimento nel periodo selezionato.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Torta + Barre orizzontali */}
                <section className="grid gap-6 xl:grid-cols-2">
                  <Card className="border-[#e5e7f0] bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg text-slate-950">Spese per categoria</CardTitle>
                      <p className="text-sm text-slate-500">Distribuzione uscite per categoria padre</p>
                    </CardHeader>
                    <CardContent>
                      {pieData.length === 0 ? (
                        <p className="py-10 text-center text-sm text-slate-500">Nessuna spesa categorizzata</p>
                      ) : (
                        <div className="h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                dataKey="amount"
                                nameKey="name"
                                cx="50%"
                                cy="44%"
                                outerRadius={100}
                                innerRadius={55}
                                paddingAngle={2}
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={index} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip content={<PieTooltip />} />
                              <Legend
                                iconType="circle"
                                iconSize={8}
                                formatter={(value: string, entry: any) => (
                                  <span style={{ color: '#475569', fontSize: 12 }}>
                                    {value} ({entry.payload?.percent?.toFixed(1)}%)
                                  </span>
                                )}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-[#e5e7f0] bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg text-slate-950">Top 10 categorie di spesa</CardTitle>
                      <p className="text-sm text-slate-500">Ordinate per importo decrescente</p>
                    </CardHeader>
                    <CardContent>
                      {topCategories.length === 0 ? (
                        <p className="py-10 text-center text-sm text-slate-500">Nessuna spesa nel periodo</p>
                      ) : (
                        <div className="h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={topCategories}
                              layout="vertical"
                              margin={{ left: 0, right: 24, top: 4, bottom: 4 }}
                            >
                              <CartesianGrid horizontal={false} stroke="#e5e7f0" />
                              <XAxis
                                type="number"
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '')}
                                stroke="#94a3b8"
                                fontSize={11}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={96}
                                axisLine={false}
                                tickLine={false}
                                fontSize={11}
                                tick={{ fill: '#64748b' }}
                              />
                              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8f9fc' }} />
                              <Bar dataKey="amount" name="Importo" radius={[0, 6, 6, 0]}>
                                {topCategories.map((entry, index) => (
                                  <Cell key={index} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </section>

                {/* Grafico a linee */}
                <Card className="border-[#e5e7f0] bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-950">Andamento nel tempo</CardTitle>
                    <p className="text-sm text-slate-500">{granularityLabel} — entrate vs uscite</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeSeries} margin={{ left: 8, right: 8 }}>
                          <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            stroke="#94a3b8"
                            fontSize={11}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '')}
                            stroke="#94a3b8"
                            fontSize={11}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend iconType="circle" iconSize={8} />
                          <Line
                            type="monotone"
                            dataKey="income"
                            name="Entrate"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4, fill: '#10b981' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="expense"
                            name="Uscite"
                            stroke="#ef4444"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4, fill: '#ef4444' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabella dettaglio */}
                <Card className="border-[#e5e7f0] bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-950">Dettaglio per categoria</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#e5e7f0] bg-slate-50">
                            <th className="px-6 py-3 text-left font-semibold text-slate-600">Categoria</th>
                            <th className="px-6 py-3 text-right font-semibold text-slate-600">N°</th>
                            <th className="px-6 py-3 text-right font-semibold text-slate-600">Totale</th>
                            <th className="px-6 py-3 text-right font-semibold text-slate-600">Media</th>
                            <th className="px-6 py-3 text-right font-semibold text-slate-600">% tot.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, index) => (
                            <tr
                              key={index}
                              className="border-b border-[#e5e7f0] last:border-b-0 hover:bg-slate-50/70"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-3 w-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: row.fill }}
                                  />
                                  <span className="font-medium text-slate-900">{row.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right tabular-nums text-slate-700">{row.count}</td>
                              <td className="px-6 py-4 text-right tabular-nums font-semibold text-slate-900">
                                {formatCurrency(row.amount)}
                              </td>
                              <td className="px-6 py-4 text-right tabular-nums text-slate-700">
                                {formatCurrency(row.average)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min(row.percent, 100)}%`,
                                        backgroundColor: row.fill,
                                      }}
                                    />
                                  </div>
                                  <span className="w-10 tabular-nums text-slate-700">
                                    {row.percent.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[#e5e7f0] bg-slate-50">
                            <td className="px-6 py-3 font-semibold text-slate-700">Totale</td>
                            <td className="px-6 py-3 text-right tabular-nums font-semibold text-slate-700">
                              {expenseTransactions.length}
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums font-bold text-slate-950">
                              {formatCurrency(totalExpense)}
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums text-slate-700">
                              {expenseTransactions.length > 0
                                ? formatCurrency(totalExpense / expenseTransactions.length)
                                : '—'}
                            </td>
                            <td className="px-6 py-3 text-right font-semibold text-slate-700">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* ── Confronto annuale ── */}
        <section className="space-y-5">
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-slate-950">Confronto annuale</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Spese per categoria — differenza anno su anno</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={yearA}
                    onChange={(e) => setYearA(Number(e.target.value))}
                    className="h-9 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
                  >
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className="text-sm text-slate-400">vs</span>
                  <select
                    value={yearB}
                    onChange={(e) => setYearB(Number(e.target.value))}
                    className="h-9 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
                  >
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {yoyLoading ? (
                <Skeleton className="h-48 rounded-2xl" />
              ) : yoyChartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Nessuna spesa in entrambi gli anni selezionati.</p>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyChartData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid vertical={false} stroke="#e5e7f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} stroke="#94a3b8" />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '')} fontSize={11} stroke="#94a3b8" />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8f9fc' }} />
                      <Legend iconType="circle" iconSize={8} />
                      <Bar dataKey={String(yearA)} name={String(yearA)} fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={String(yearB)} name={String(yearB)} fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {!yoyLoading && yoyTableData.length > 0 && (
            <Card className="border-[#e5e7f0] bg-white shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e5e7f0] bg-slate-50">
                        <th className="px-6 py-3 text-left font-semibold text-slate-600">Categoria</th>
                        <th className="px-6 py-3 text-right font-semibold text-slate-600">{yearA}</th>
                        <th className="px-6 py-3 text-right font-semibold text-slate-600">{yearB}</th>
                        <th className="px-6 py-3 text-right font-semibold text-slate-600">Diff. assoluta</th>
                        <th className="px-6 py-3 text-right font-semibold text-slate-600">Diff. %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yoyTableData.map((row, i) => (
                        <tr key={i} className="border-b border-[#e5e7f0] last:border-b-0 hover:bg-slate-50/70">
                          <td className="px-6 py-3 font-medium text-slate-900">{row.name}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-slate-700">{formatCurrency(row.amtA)}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-slate-700">{formatCurrency(row.amtB)}</td>
                          <td className={cn(
                            'px-6 py-3 text-right tabular-nums font-semibold',
                            row.diff > 0 ? 'text-red-600' : row.diff < 0 ? 'text-emerald-600' : 'text-slate-500',
                          )}>
                            {row.diff > 0 ? '+' : ''}{formatCurrency(row.diff)}
                          </td>
                          <td className={cn(
                            'px-6 py-3 text-right tabular-nums',
                            row.pct === null ? 'text-slate-400' : row.pct > 0 ? 'text-red-600' : 'text-emerald-600',
                          )}>
                            {row.pct === null ? '—' : `${row.pct > 0 ? '+' : ''}${row.pct.toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
