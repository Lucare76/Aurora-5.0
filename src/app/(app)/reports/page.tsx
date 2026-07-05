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
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] }
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] }
    }
    case 'last-3-months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] }
    }
    case 'last-year': {
      const start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] }
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
    return d.toISOString().split('T')[0]
  })
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])
  const { categories } = useCategories()

  const dateRange = useMemo(
    () => getDateRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from('transactions')
      .select('*')
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

  const expenseTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'expense' && !t.transfer_peer_id),
    [transactions],
  )
  const incomeTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'income' && !t.transfer_peer_id),
    [transactions],
  )

  const totalExpense = useMemo(
    () => expenseTransactions.reduce((sum, t) => sum + t.amount, 0),
    [expenseTransactions],
  )
  const totalIncome = useMemo(
    () => incomeTransactions.reduce((sum, t) => sum + t.amount, 0),
    [incomeTransactions],
  )
  const netSavings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  const categoryExpenses = useMemo(() => {
    const map = new Map<string, { name: string; color: string; amount: number; count: number }>()

    for (const t of expenseTransactions) {
      const cat = t.category_id ? categoryById.get(t.category_id) : null
      const parentCat = cat?.parent_id ? categoryById.get(cat.parent_id) : cat
      const key = parentCat?.id ?? 'no-category'
      const existing = map.get(key)
      if (existing) {
        existing.amount += t.amount
        existing.count += 1
      } else {
        map.set(key, {
          name: parentCat?.name ?? 'Senza categoria',
          color: parentCat?.color ?? '#94a3b8',
          amount: t.amount,
          count: 1,
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }, [expenseTransactions, categoryById])

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
        const k = weekStart.toISOString().split('T')[0]
        return { key: k, label: format(weekStart, 'd MMM', { locale: it }) }
      }
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return { key: k, label: format(d, 'MMM yy', { locale: it }) }
    }

    for (const t of transactions) {
      if (t.transfer_peer_id) continue
      const { key, label } = getKey(t.date)
      const bucket = buckets.get(key) ?? { label, income: 0, expense: 0 }
      if (t.type === 'income') bucket.income += t.amount
      if (t.type === 'expense') bucket.expense += t.amount
      buckets.set(key, bucket)
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
  }, [transactions, dateRange.from, dateRange.to])

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

  const exportCSV = () => {
    const header = ['Data', 'Tipo', 'Descrizione', 'Categoria', 'Importo (EUR)']
    const rows = transactions
      .filter((t) => !t.transfer_peer_id)
      .map((t) => {
        const cat = t.category_id ? categoryById.get(t.category_id) : null
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

            {transactions.filter((t) => !t.transfer_peer_id).length === 0 ? (
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
      </div>
    </div>
  )
}
