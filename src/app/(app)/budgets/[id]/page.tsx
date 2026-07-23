'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, BarChart2, ChevronDown, ChevronUp,
  Lightbulb, TrendingDown, TrendingUp,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type {
  BudgetAlert,
  BudgetDetailPayload,
  BudgetHistoryPoint,
  BudgetInsight,
  BudgetStatus,
} from '@/lib/budgets/service'

// ── Helpers ────────────────────────────────────────────────────────────────

function statusTone(status: BudgetStatus) {
  switch (status) {
    case 'exceeded': return { bar: 'bg-red-500',    text: 'text-red-600',    badge: 'bg-red-100 text-red-700',      label: 'Sforato' }
    case 'critical': return { bar: 'bg-orange-500', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', label: 'Critico' }
    case 'warning':  return { bar: 'bg-amber-500',  text: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700',  label: 'Attenzione' }
    default:         return { bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Ok' }
  }
}

function shortMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('it-IT', { month: 'short' })
}

// ── Tooltip ────────────────────────────────────────────────────────────────

function HistoryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const spent  = payload.find((p: any) => p.dataKey === 'spent')?.value as number | undefined
  const budget = payload.find((p: any) => p.dataKey === 'budgetAmount')?.value as number | undefined
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      {spent  != null && <p className="text-red-600">Speso: {formatCurrency(spent)}</p>}
      {budget != null && budget > 0 && <p className="text-indigo-600">Budget: {formatCurrency(budget)}</p>}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MiniStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#e5e7f0] bg-white p-3 sm:p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 truncate font-bold tabular-nums', accent ?? 'text-slate-950')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function AlertCard({ alert }: { alert: BudgetAlert }) {
  const isHigh = alert.priority <= 2
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm', isHigh ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{alert.message}</span>
    </div>
  )
}

function InsightCard({ insight }: { insight: BudgetInsight }) {
  const isPositive = ['spending_down_vs_last_month', 'consistently_within_budget', 'best_month_in_period'].includes(insight.type)
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm', isPositive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{insight.message}</span>
    </div>
  )
}

function HistoryChart({ history }: { history: BudgetHistoryPoint[] }) {
  const data = history.map((h) => ({
    name:         shortMonth(h.year, h.month),
    spent:        h.spent,
    budgetAmount: h.hadBudget ? h.budgetAmount : 0,
    status:       h.status,
  }))

  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={10} />
          <YAxis
            axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={10} width={68}
            tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '').replace('€ ', '€')}
          />
          <Tooltip content={<HistoryTooltip />} cursor={{ fill: '#f8f9fc' }} />
          <ReferenceLine y={0} stroke="#e5e7f0" />
          <Bar dataKey="spent" name="Speso" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.status === 'exceeded' ? '#ef4444' : d.status === 'critical' ? '#f97316' : d.status === 'warning' ? '#f59e0b' : '#10b981'}
              />
            ))}
          </Bar>
          <Bar dataKey="budgetAmount" name="Budget" fill="#6366f120" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [detail, setDetail]       = useState<BudgetDetailPayload | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [showAllTx, setShowAllTx] = useState(false)

  useEffect(() => {
    fetch(`/api/budgets/${id}`, { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 404) { setError('Budget non trovato.'); return }
        if (!res.ok) { setError('Errore di caricamento.'); return }
        const body = await res.json() as { data: BudgetDetailPayload }
        setDetail(body.data)
      })
      .catch(() => setError('Errore di rete.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-slate-500">{error ?? 'Budget non trovato.'}</p>
        <Link href="/budgets">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Torna ai budget
          </Button>
        </Link>
      </div>
    )
  }

  const { budget, forecast, comparison, history, alerts, insights, transactions } = detail
  const tone = statusTone(budget.status)
  const monthName = new Date(budget.year, budget.month - 1, 1)
    .toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  const visibleTx = showAllTx ? transactions : transactions.slice(0, 10)

  return (
    <div className="space-y-6">

      {/* Back + Header */}
      <div className="space-y-4">
        <Link href="/budgets" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Budget
        </Link>

        <div className="rounded-[2rem] border border-[#e5e7f0] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium capitalize text-slate-500">{monthName}</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950 sm:text-3xl">
                {budget.categoryIcon && <span>{budget.categoryIcon}</span>}
                {budget.categoryName}
              </h1>
              {budget.parentCategoryName && (
                <p className="mt-0.5 text-sm text-slate-400">Sottocategoria di {budget.parentCategoryName}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={cn('rounded-full px-3 py-1 text-sm font-semibold', tone.badge)}>
                {tone.label}
              </span>
              <p className="text-sm text-slate-500">Budget: <span className="font-bold text-slate-900">{formatCurrency(budget.amount)}</span></p>
            </div>
          </div>

          {/* Main progress bar */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
              </span>
              <span className={cn('font-bold', tone.text)}>{budget.percentage}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full transition-all', tone.bar)}
                style={{ width: `${Math.min(budget.percentage, 100)}%` }}
              />
            </div>
            {budget.remaining < 0 ? (
              <p className="text-xs text-red-600">Sforato di {formatCurrency(Math.abs(budget.remaining))}</p>
            ) : (
              <p className="text-xs text-slate-400">{formatCurrency(budget.remaining)} rimanenti</p>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => <AlertCard key={i} alert={alert} />)}
        </div>
      )}

      {/* Riepilogo stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <MiniStat
          label="Spesa media/giorno"
          value={forecast.hasEnoughData ? formatCurrency(forecast.dailyAvgSpend) : '—'}
          sub={forecast.hasEnoughData ? `su ${forecast.daysElapsed} giorni` : 'Dati insufficienti'}
        />
        <MiniStat
          label="Previsione fine mese"
          value={forecast.hasEnoughData ? formatCurrency(forecast.projectedSpent) : '—'}
          sub={forecast.hasEnoughData ? `${forecast.projectedPercentage}% del budget` : 'Dati insufficienti'}
          accent={forecast.hasEnoughData && forecast.projectedOverrun > 0 ? 'text-amber-600' : undefined}
        />
        <MiniStat
          label="Superamento previsto"
          value={forecast.hasEnoughData && forecast.projectedOverrun > 0 ? formatCurrency(forecast.projectedOverrun) : '—'}
          accent={forecast.projectedOverrun > 0 ? 'text-red-600' : undefined}
        />

        {/* Comparison */}
        <MiniStat
          label="Mese scorso"
          value={comparison.prevMonthSpent > 0 ? formatCurrency(comparison.prevMonthSpent) : '—'}
        />
        <MiniStat
          label="Variazione"
          value={comparison.trend === 'unavailable' || comparison.prevMonthSpent === 0
            ? '—'
            : `${comparison.absoluteDiff >= 0 ? '+' : ''}${formatCurrency(comparison.absoluteDiff)}`}
          sub={comparison.trend === 'unavailable'
            ? 'Nessun dato precedente'
            : comparison.trend === 'stable' ? 'Stabile'
            : comparison.trend === 'up' ? `+${comparison.percentageDiff}%`
            : `${comparison.percentageDiff}%`}
          accent={comparison.trend === 'down' ? 'text-emerald-600' : comparison.trend === 'up' ? 'text-red-600' : undefined}
        />
        <MiniStat
          label="Trend vs mese scorso"
          value={
            comparison.trend === 'up'         ? '↑ In aumento' :
            comparison.trend === 'down'        ? '↓ In calo' :
            comparison.trend === 'stable'      ? '→ Stabile' :
                                                 '— N/D'
          }
          accent={
            comparison.trend === 'down' ? 'text-emerald-600' :
            comparison.trend === 'up'   ? 'text-red-600' :
            comparison.trend === 'stable' ? 'text-slate-500' : undefined
          }
        />
      </section>

      {/* Insights */}
      {insights.length > 0 && (
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-slate-950">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Insight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
          </CardContent>
        </Card>
      )}

      {/* Storico 12 mesi */}
      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
            <BarChart2 className="h-5 w-5 text-indigo-500" />
            Andamento ultimi 12 mesi
          </CardTitle>
          <p className="text-sm text-slate-500">Spesa reale vs. budget per mese.</p>
        </CardHeader>
        <CardContent>
          {history.every((h) => h.spent === 0 && !h.hadBudget) ? (
            <p className="text-sm text-slate-400">Nessun dato storico disponibile.</p>
          ) : (
            <>
              <HistoryChart history={history} />
              <div className="mt-3 flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                  Speso (ok)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-3 w-3 rounded-sm bg-amber-500" />
                  Attenzione / Critico
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-3 w-3 rounded-sm bg-red-500" />
                  Sforato
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-3 w-3 rounded-sm bg-indigo-100" />
                  Budget
                </div>
              </div>

              {/* History table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="pb-2 font-medium">Mese</th>
                      <th className="pb-2 font-medium tabular-nums">Budget</th>
                      <th className="pb-2 font-medium tabular-nums">Speso</th>
                      <th className="pb-2 font-medium tabular-nums">Residuo</th>
                      <th className="pb-2 font-medium">%</th>
                      <th className="pb-2 font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...history].reverse().map((h, i) => {
                      const t = statusTone(h.status)
                      return (
                        <tr key={i} className="text-slate-700">
                          <td className="py-2 font-medium capitalize">
                            {new Date(h.year, h.month - 1, 1).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })}
                          </td>
                          <td className="py-2 tabular-nums text-slate-500">
                            {h.hadBudget ? formatCurrency(h.budgetAmount) : '—'}
                          </td>
                          <td className="py-2 tabular-nums">{h.spent > 0 ? formatCurrency(h.spent) : '—'}</td>
                          <td className={cn('py-2 tabular-nums', h.remaining < 0 ? 'text-red-600' : 'text-slate-700')}>
                            {h.hadBudget ? formatCurrency(h.remaining) : '—'}
                          </td>
                          <td className="py-2 tabular-nums">
                            {h.hadBudget && h.spent > 0 ? `${h.percentage}%` : '—'}
                          </td>
                          <td className="py-2">
                            {h.hadBudget ? (
                              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', t.badge)}>
                                {t.label}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Nessun budget</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transazioni del mese */}
      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-950">Transazioni di questo mese</CardTitle>
          <p className="text-sm text-slate-500">
            {transactions.length === 0 ? 'Nessuna spesa registrata.' : `${transactions.length} operazion${transactions.length === 1 ? 'e' : 'i'}.`}
          </p>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-400">Nessuna spesa per questa categoria questo mese.</p>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {visibleTx.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg sm:h-10 sm:w-10 sm:rounded-2xl">
                      {tx.categoryIcon ?? '📦'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {tx.description || tx.categoryName}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span>{formatDate(tx.date)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{tx.accountName}</span>
                        {tx.isSubcategory && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="italic">{tx.categoryName}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <AmountDisplay amount={tx.amount} type="expense" className="shrink-0 text-sm font-bold" />
                  </div>
                ))}
              </div>
              {transactions.length > 10 && (
                <Button
                  variant="ghost" size="sm"
                  className="mt-4 w-full gap-1.5 text-slate-500"
                  onClick={() => setShowAllTx((v) => !v)}
                >
                  {showAllTx
                    ? <><ChevronUp className="h-4 w-4" /> Mostra meno</>
                    : <><ChevronDown className="h-4 w-4" /> Mostra tutte ({transactions.length})</>}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
