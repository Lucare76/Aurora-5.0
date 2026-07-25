'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  HandCoins,
  Loader2,
  Plus,
  Printer,
  Repeat,
  Target,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency } from '@/lib/utils'
import type { CalendarDay, FinancialCalendarEvent, FinancialCalendarPayload } from '@/lib/financial-calendar/types'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function todayKey() {
  return new Date().toLocaleDateString('en-CA')
}

function currentMonth() {
  return todayKey().slice(0, 7)
}

function initialParams() {
  if (typeof window === 'undefined') return new URLSearchParams(`view=month&month=${currentMonth()}&threshold=0`)
  const params = new URLSearchParams(window.location.search)
  if (!params.get('view')) params.set('view', 'month')
  if (!params.get('month')) params.set('month', currentMonth())
  if (!params.get('threshold')) params.set('threshold', '0')
  return params
}

function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function EventPill({ event }: { event: FinancialCalendarEvent }) {
  const tone = event.direction === 'INCOME' ? 'text-emerald-700 bg-emerald-50' : event.direction === 'EXPENSE' ? 'text-red-700 bg-red-50' : 'text-indigo-700 bg-indigo-50'
  return (
    <Link href={event.href} className={cn('block truncate rounded-lg px-2 py-1 text-[11px] font-semibold', tone)}>
      {event.title}
    </Link>
  )
}

function EventCard({ event }: { event: FinancialCalendarEvent }) {
  const Icon = event.sourceType === 'RECURRING' ? Repeat : event.sourceType === 'LOAN' ? HandCoins : event.sourceType === 'BUDGET' || event.sourceType === 'SAVINGS_GOAL' ? Target : event.direction === 'INCOME' ? ArrowDownLeft : ArrowUpRight
  return (
    <Link href={event.href} className="flex items-start gap-3 rounded-2xl border border-[#e5e7f0] bg-white p-3 transition hover:border-indigo-200 hover:shadow-sm">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', event.direction === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : event.direction === 'EXPENSE' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600')}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-slate-950">{event.title}</p>
          {event.amount !== null && <span className={cn('shrink-0 text-sm font-bold tabular-nums', event.direction === 'INCOME' ? 'text-emerald-600' : event.direction === 'EXPENSE' ? 'text-red-600' : 'text-slate-500')}>{formatCurrency(event.amount)}</span>}
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{[event.accountName, event.categoryName, event.status].filter(Boolean).join(' · ')}</p>
      </div>
    </Link>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-[#e5e7f0] bg-white px-4 py-3 text-sm shadow-xl">
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      {payload.map((item: any) => (
        <div key={item.dataKey} className="flex justify-between gap-8">
          <span className="text-slate-500">{item.name}</span>
          <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(Number(item.value ?? 0))}</span>
        </div>
      ))}
    </div>
  )
}

function Kpi({ label, value, hint, tone = 'slate' }: { label: string; value: string; hint: string; tone?: 'slate' | 'green' | 'red' | 'indigo' }) {
  const text = tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : tone === 'indigo' ? 'text-indigo-600' : 'text-slate-950'
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={cn('mt-3 text-2xl font-bold tabular-nums', text)}>{value}</p>
        <p className="mt-3 text-xs text-slate-400">{hint}</p>
      </CardContent>
    </Card>
  )
}

export default function FinancialCalendarPage() {
  const [params, setParams] = useState(() => initialParams())
  const [payload, setPayload] = useState<FinancialCalendarPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const queryString = params.toString()
  const view = params.get('view') ?? 'month'
  const month = params.get('month') ?? currentMonth()

  const setParam = useCallback((key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (!value || value === 'ALL') next.delete(key)
      else next.set(key, value)
      if (key === 'view' && value === 'month' && !next.get('month')) next.set('month', currentMonth())
      const href = `/calendar?${next.toString()}`
      window.history.replaceState(null, '', href)
      return next
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/financial-calendar?${queryString}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error ?? 'CALENDAR_FAILED')
        setPayload(body as FinancialCalendarPayload)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setPayload(null)
        setError(err.message === 'UNAUTHORIZED' ? 'Sessione scaduta. Accedi di nuovo.' : 'Calendario finanziario non disponibile per i filtri selezionati.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [queryString])

  const selectedDay = useMemo<CalendarDay | null>(() => {
    return payload?.calendarDays.find((day) => day.date === selectedDate) ?? payload?.calendarDays.find((day) => day.isToday) ?? payload?.calendarDays[0] ?? null
  }, [payload, selectedDate])

  const paddedDays = useMemo(() => {
    if (!payload) return []
    const days = [...payload.calendarDays]
    if (days.length === 0) return days
    const first = new Date(`${days[0].date}T00:00:00`)
    const pad = (first.getDay() + 6) % 7
    return [...Array.from({ length: pad }).map((_, i) => ({ date: `pad-${i}`, day: 0, inCurrentMonth: false, isToday: false, openingBalance: 0, income: 0, expenses: 0, closingBalance: 0, eventCount: 0, events: [], warnings: [] } as CalendarDay)), ...days]
  }, [payload])

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <style jsx global>{`
        @media print {
          aside, nav, header, .aurora-no-print { display: none !important; }
          main { padding: 0 !important; }
          .aurora-print-card { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Previsioni</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Calendario finanziario</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Visualizza scadenze, ricorrenze e saldo previsto. La previsione è prudenziale, non garantita.</p>
          </div>
          <div className="aurora-no-print flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setParam('month', currentMonth())}><CalendarDays className="h-4 w-4" />Oggi</Button>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Stampa calendario</Button>
          </div>
        </header>

        <Card className="aurora-no-print border-[#e5e7f0] bg-white shadow-sm">
          <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-7">
            <select value={view} onChange={(e) => setParam('view', e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm font-medium">
              <option value="month">Calendario</option>
              <option value="agenda">Agenda</option>
            </select>
            {view === 'month' ? (
              <div className="flex items-center gap-2 xl:col-span-2">
                <Button variant="outline" size="icon" onClick={() => setParam('month', shiftMonth(month, -1))} aria-label="Mese precedente"><ArrowLeft className="h-4 w-4" /></Button>
                <input type="month" value={month} onChange={(e) => setParam('month', e.target.value)} className="h-10 min-w-44 rounded-xl border border-[#e5e7f0] px-3 text-sm font-semibold capitalize" />
                <Button variant="outline" size="icon" onClick={() => setParam('month', shiftMonth(month, 1))} aria-label="Mese successivo"><ArrowRight className="h-4 w-4" /></Button>
              </div>
            ) : (
              <select value={params.get('range') ?? '30'} onChange={(e) => setParam('range', e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm font-medium">
                <option value="30">Prossimi 30 giorni</option>
                <option value="60">Prossimi 60 giorni</option>
                <option value="90">Prossimi 90 giorni</option>
              </select>
            )}
            <select value={params.get('direction') ?? 'ALL'} onChange={(e) => setParam('direction', e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm font-medium">
              <option value="ALL">Tutte le direzioni</option>
              <option value="INCOME">Entrate</option>
              <option value="EXPENSE">Uscite</option>
              <option value="NEUTRAL">Informativi</option>
            </select>
            <select value={params.get('sourceType') ?? 'ALL'} onChange={(e) => setParam('sourceType', e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm font-medium">
              <option value="ALL">Tutte le fonti</option>
              <option value="RECURRING">Ricorrenze</option>
              <option value="LOAN">Prestiti</option>
              <option value="BUDGET">Budget</option>
              <option value="SAVINGS_GOAL">Obiettivi</option>
              <option value="EXISTING_TRANSACTION">Movimenti reali</option>
            </select>
            <input type="number" step="50" value={params.get('threshold') ?? '0'} onChange={(e) => setParam('threshold', e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm font-medium" aria-label="Soglia saldo" />
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[#e5e7f0] px-3 text-sm font-medium text-slate-600">
              <input type="checkbox" checked={params.get('includeActual') !== 'false'} onChange={(e) => setParam('includeActual', e.target.checked ? 'true' : 'false')} />
              Reali
            </label>
          </CardContent>
        </Card>

        {loading && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}</div>
            <Skeleton className="h-80 rounded-3xl" />
          </div>
        )}

        {!loading && error && (
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-10 text-center"><p className="font-semibold text-slate-900">{error}</p></CardContent></Card>
        )}

        {!loading && payload && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Saldo attuale" value={formatCurrency(payload.summary.openingBalance)} hint={`${payload.summary.activeAccountsCount} conti attivi`} tone="indigo" />
              <Kpi label="Saldo previsto" value={formatCurrency(payload.summary.projectedClosingBalance)} hint="Fine periodo selezionato" tone={payload.summary.projectedClosingBalance < payload.filters.threshold ? 'red' : 'slate'} />
              <Kpi label="Entrate previste" value={formatCurrency(payload.summary.projectedIncome)} hint={`${payload.summary.expectedEventCount} eventi previsti`} tone="green" />
              <Kpi label="Uscite previste" value={formatCurrency(payload.summary.projectedExpenses)} hint={`${payload.summary.daysBelowThreshold} giorni sotto soglia`} tone="red" />
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Saldo previsto</CardTitle>
                  <p className="text-sm text-slate-500">Minimo previsto: {payload.summary.minimumProjectedBalanceDate ?? '—'} · {formatCurrency(payload.summary.minimumProjectedBalance)}</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]" role="img" aria-label="Grafico del saldo previsto giornaliero">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={payload.dailySeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                        <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={12} />
                        <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '')} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" iconSize={8} />
                        <Line type="monotone" dataKey="totalProjectedBalance" name="Saldo previsto" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="threshold" name="Soglia" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                <CardHeader><CardTitle className="text-lg">Insight</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {payload.insights.map((insight) => (
                    <div key={insight.type} className="rounded-2xl border border-[#e5e7f0] bg-slate-50 p-4">
                      <p className={cn('font-semibold', insight.severity === 'DANGER' ? 'text-red-700' : insight.severity === 'WARNING' ? 'text-amber-700' : 'text-slate-900')}>{insight.title}</p>
                      <p className="mt-2 text-sm text-slate-500">{insight.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
              {view === 'month' ? (
                <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-lg capitalize">{monthLabel(month)}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-slate-400">{WEEKDAYS.map((day) => <div key={day}>{day}</div>)}</div>
                    <div className="mt-2 grid grid-cols-7 gap-2">
                      {paddedDays.map((day) => (
                        <button key={day.date} type="button" disabled={day.day === 0} onClick={() => setSelectedDate(day.date)} className={cn('min-h-28 rounded-2xl border border-[#e5e7f0] bg-white p-2 text-left transition focus:outline-none focus:ring-4 focus:ring-indigo-100', day.date === selectedDay?.date && 'border-indigo-400 ring-2 ring-indigo-100', day.warnings.some((warning) => warning.severity === 'DANGER') && 'border-red-200 bg-red-50/40', day.day === 0 && 'opacity-0')}>
                          <div className="flex items-center justify-between">
                            <span className={cn('text-sm font-bold', day.isToday ? 'text-indigo-600' : 'text-slate-700')}>{day.day || ''}</span>
                            {day.warnings.length > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">!</span>}
                          </div>
                          {day.day > 0 && <p className="mt-1 text-[11px] font-semibold tabular-nums text-slate-500">{formatCurrency(day.closingBalance).replace(',00', '')}</p>}
                          <div className="mt-2 space-y-1">{day.events.slice(0, 3).map((event) => <EventPill key={event.id} event={event} />)}{day.events.length > 3 && <p className="text-[11px] font-semibold text-slate-400">+{day.events.length - 3} altri</p>}</div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Agenda</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    {payload.agendaGroups.length === 0 ? (
                      <p className="py-10 text-center text-sm text-slate-500">Non ci sono eventi finanziari nel periodo selezionato. Prova ad ampliare l’intervallo o aggiungi una ricorrenza.</p>
                    ) : payload.agendaGroups.map((group) => (
                      <section key={group.key}>
                        <h2 className="mb-3 text-sm font-bold text-slate-500">{group.label}</h2>
                        <div className="space-y-3">{group.days.map((day) => <div key={day.date} className="rounded-2xl bg-slate-50 p-3"><div className="mb-3 flex justify-between text-sm"><strong>{day.date}</strong><span className="tabular-nums">{formatCurrency(day.closingBalance)}</span></div><div className="space-y-2">{day.events.map((event) => <EventCard key={event.id} event={event} />)}</div></div>)}</div>
                      </section>
                    ))}
                  </CardContent>
                </Card>
              )}

              <aside className="space-y-6">
                <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Dettaglio giorno</CardTitle><p className="text-sm text-slate-500">{selectedDay?.date}</p></CardHeader>
                  <CardContent className="space-y-4">
                    {selectedDay && (
                      <>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Entrate</p><strong className="text-emerald-600">{formatCurrency(selectedDay.income)}</strong></div>
                          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Uscite</p><strong className="text-red-600">{formatCurrency(selectedDay.expenses)}</strong></div>
                        </div>
                        {selectedDay.warnings.map((warning) => <p key={`${warning.type}-${warning.message}`} className="rounded-2xl bg-amber-50 p-3 text-sm font-medium text-amber-800">{warning.message}</p>)}
                        <div className="space-y-2">{selectedDay.events.length === 0 ? <p className="text-sm text-slate-500">Nessun evento in questo giorno.</p> : selectedDay.events.map((event) => <EventCard key={event.id} event={event} />)}</div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="aurora-no-print border-[#e5e7f0] bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Azioni rapide</CardTitle></CardHeader>
                  <CardContent className="grid gap-2">
                    <Link className="inline-flex h-10 items-center justify-start gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground" href="/transactions?action=create"><Plus className="h-4 w-4" />Nuovo movimento</Link>
                    <Link className="inline-flex h-10 items-center justify-start gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground" href="/recurring?action=create"><Repeat className="h-4 w-4" />Nuova ricorrenza</Link>
                    <Link className="inline-flex h-10 items-center justify-start gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground" href="/loans?action=create"><HandCoins className="h-4 w-4" />Nuovo prestito</Link>
                    <Link className="inline-flex h-10 items-center justify-start gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground" href="/goals?action=create"><Target className="h-4 w-4" />Nuovo obiettivo</Link>
                  </CardContent>
                </Card>

                <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-lg">Affidabilità</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-slate-950">{payload.confidence.forecastConfidence}</p>
                    <p className="mt-1 text-sm text-slate-500">{payload.confidence.completenessPercentage}% completezza</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-500">{payload.confidence.confidenceReasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
                  </CardContent>
                </Card>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
