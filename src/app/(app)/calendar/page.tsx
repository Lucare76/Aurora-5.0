'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
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
import {
  calendarDayAriaLabel,
  compactBalance,
  eventAriaLabel,
  eventDirectionSymbol,
  eventTypeLabel,
  visibleEvents,
} from '@/lib/financial-calendar/view-model'

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

function EventPill({ event, showAmount = true }: { event: FinancialCalendarEvent; showAmount?: boolean }) {
  const tone = event.direction === 'INCOME'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
    : event.direction === 'EXPENSE'
      ? 'border-red-100 bg-red-50 text-red-700'
      : 'border-indigo-100 bg-indigo-50 text-indigo-700'
  return (
    <Link
      href={event.href}
      title={event.title}
      aria-label={eventAriaLabel(event)}
      className={cn('flex h-7 w-full min-w-0 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold leading-none focus:outline-none focus:ring-2 focus:ring-indigo-200', tone)}
    >
      <span aria-hidden="true" className="shrink-0">{eventDirectionSymbol(event)}</span>
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {showAmount && event.amount !== null && <span className="hidden shrink-0 tabular-nums 2xl:inline">{compactBalance(event.amount)}</span>}
    </Link>
  )
}

function EventCard({ event }: { event: FinancialCalendarEvent }) {
  const Icon = event.sourceType === 'RECURRING' ? Repeat : event.sourceType === 'LOAN' ? HandCoins : event.sourceType === 'BUDGET' || event.sourceType === 'SAVINGS_GOAL' ? Target : event.direction === 'INCOME' ? ArrowDownLeft : ArrowUpRight
  return (
    <Link href={event.href} aria-label={eventAriaLabel(event)} className="flex items-start gap-3 rounded-2xl border border-[#e5e7f0] bg-white p-3 transition hover:border-indigo-200 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', event.direction === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : event.direction === 'EXPENSE' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600')}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold leading-5 text-slate-950">{event.title}</p>
          {event.amount !== null && <span className={cn('shrink-0 text-sm font-bold tabular-nums', event.direction === 'INCOME' ? 'text-emerald-600' : event.direction === 'EXPENSE' ? 'text-red-600' : 'text-slate-500')}>{formatCurrency(event.amount)}</span>}
        </div>
        <p className="mt-1 text-xs text-slate-500">{[eventTypeLabel(event), event.accountName, event.categoryName, event.status].filter(Boolean).join(' · ')}</p>
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

function WarningBadge({ day }: { day: CalendarDay }) {
  if (day.warnings.length === 0) return null
  const danger = day.warnings.some((warning) => warning.severity === 'DANGER')
  const label = day.warnings.map((warning) => warning.message).join('. ')
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full',
        danger ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  )
}

function CalendarDayCell({
  day,
  selected,
  onSelect,
}: {
  day: CalendarDay
  selected: boolean
  onSelect: (date: string) => void
}) {
  const { visible, hiddenCount } = visibleEvents(day.events, 'desktop')
  const isPad = day.day === 0
  return (
    <button
      key={day.date}
      type="button"
      disabled={isPad}
      onClick={() => onSelect(day.date)}
      aria-label={calendarDayAriaLabel(day)}
      aria-current={day.isToday ? 'date' : undefined}
      aria-selected={selected}
      className={cn(
        'group min-w-0 rounded-2xl border border-[#e5e7f0] bg-white p-2.5 text-left transition focus:outline-none focus:ring-4 focus:ring-indigo-100',
        'min-h-36',
        selected && 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-100',
        day.isToday && !selected && 'border-indigo-200',
        day.warnings.some((warning) => warning.severity === 'DANGER') && !selected && 'border-red-200 bg-red-50/30',
        isPad && 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className={cn(
          'flex h-7 min-w-7 items-center justify-center rounded-full text-sm font-bold',
          day.isToday ? 'bg-indigo-600 text-white' : selected ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700',
        )}>
          {day.day || ''}
        </span>
        <WarningBadge day={day} />
      </div>

      {!isPad && (
        <>
          <p className="mt-2 truncate text-[11px] font-medium tabular-nums text-slate-400" title={`Saldo previsto ${formatCurrency(day.closingBalance)}`}>
            {compactBalance(day.closingBalance)}
          </p>
          <div className="mt-2 space-y-1">
            {visible.map((event) => <EventPill key={event.id} event={event} />)}
            {hiddenCount > 0 && (
              <span className="block w-full rounded-lg bg-slate-100 px-2 py-1 text-left text-[11px] font-semibold text-slate-500" aria-label={`${hiddenCount} altri eventi nel giorno ${day.day}`}>
                +{hiddenCount} altri
              </span>
            )}
          </div>
        </>
      )}
    </button>
  )
}

function AgendaDayCard({ day }: { day: CalendarDay }) {
  const label = new Date(`${day.date}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (
    <article className="rounded-3xl border border-[#e5e7f0] bg-white p-4 shadow-sm" data-agenda-day-card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold capitalize text-slate-950">{label}</h3>
          <p className="mt-1 text-xs text-slate-500">{day.eventCount === 1 ? '1 evento' : `${day.eventCount} eventi`}</p>
        </div>
        <WarningBadge day={day} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">Saldo iniziale</dt>
          <dd className="mt-1 font-bold tabular-nums text-slate-900">{formatCurrency(day.openingBalance)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">Saldo finale</dt>
          <dd className="mt-1 font-bold tabular-nums text-indigo-600">{formatCurrency(day.closingBalance)}</dd>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3">
          <dt className="text-emerald-700">Entrate</dt>
          <dd className="mt-1 font-bold tabular-nums text-emerald-700">+{formatCurrency(day.income)}</dd>
        </div>
        <div className="rounded-2xl bg-red-50 p-3">
          <dt className="text-red-700">Uscite</dt>
          <dd className="mt-1 font-bold tabular-nums text-red-700">-{formatCurrency(day.expenses)}</dd>
        </div>
      </dl>

      {day.warnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {day.warnings.map((warning) => (
            <p key={`${day.date}-${warning.type}-${warning.message}`} className={cn('rounded-2xl p-3 text-xs font-semibold', warning.severity === 'DANGER' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
              {warning.message}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {day.events.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Nessun evento in questa giornata.</p>
        ) : day.events.map((event) => <EventCard key={event.id} event={event} />)}
      </div>
    </article>
  )
}

function AgendaView({ payload }: { payload: FinancialCalendarPayload }) {
  return (
    <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm" data-calendar-agenda>
      <CardHeader>
        <CardTitle className="text-lg">Agenda</CardTitle>
        <p className="text-sm text-slate-500">Giornate ordinate cronologicamente con saldo iniziale, movimenti previsti e saldo finale.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {payload.agendaGroups.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Non ci sono eventi finanziari nel periodo selezionato. Prova ad ampliare l'intervallo o aggiungi una ricorrenza.</p>
        ) : payload.agendaGroups.map((group) => (
          <section key={group.key}>
            <h2 className="mb-3 text-sm font-bold text-slate-500">{group.label}</h2>
            <div className="space-y-3">{group.days.map((day) => <AgendaDayCard key={day.date} day={day} />)}</div>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}

function SelectedDayPanel({ selectedDay }: { selectedDay: CalendarDay | null }) {
  if (!selectedDay) return null
  const criticalTitle = selectedDay.warnings.length === 0 ? 'Nessuna criticità' : `${selectedDay.warnings.length} criticità`
  return (
    <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Dettaglio giorno</CardTitle>
        <p className="text-sm text-slate-500">
          {new Date(`${selectedDay.date}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Saldo iniziale</p><strong className="tabular-nums text-slate-950">{formatCurrency(selectedDay.openingBalance)}</strong></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Saldo finale</p><strong className="tabular-nums text-indigo-600">{formatCurrency(selectedDay.closingBalance)}</strong></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Entrate</p><strong className="tabular-nums text-emerald-600">{formatCurrency(selectedDay.income)}</strong></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Uscite</p><strong className="tabular-nums text-red-600">{formatCurrency(selectedDay.expenses)}</strong></div>
        </div>

        <section>
          <h3 className="text-sm font-bold text-slate-700">{criticalTitle}</h3>
          <div className="mt-2 space-y-2">
            {selectedDay.warnings.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Il saldo previsto resta entro i parametri selezionati.</p>
            ) : selectedDay.warnings.map((warning) => (
              <p key={`${warning.type}-${warning.message}`} className={cn('rounded-2xl p-3 text-sm font-medium', warning.severity === 'DANGER' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
                {warning.message}
              </p>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-slate-700">Eventi</h3>
          <div className="mt-2 space-y-2">
            {selectedDay.events.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Nessun evento in questo giorno.</p>
            ) : selectedDay.events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        </section>
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDate(todayKey())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
      <div className="mx-auto w-full max-w-[1600px] space-y-7">
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
          <CardContent className="p-4">
            <div className="grid gap-3 lg:hidden">
              {view === 'agenda' ? (
                <select value={params.get('range') ?? '30'} onChange={(e) => setParam('range', e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm font-medium">
                  <option value="30">Prossimi 30 giorni</option>
                  <option value="60">Prossimi 60 giorni</option>
                  <option value="90">Prossimi 90 giorni</option>
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setParam('month', shiftMonth(month, -1))} aria-label="Mese precedente"><ArrowLeft className="h-4 w-4" /></Button>
                  <input type="month" value={month} onChange={(e) => setParam('month', e.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-[#e5e7f0] px-3 text-sm font-semibold capitalize" />
                  <Button variant="outline" size="icon" onClick={() => setParam('month', shiftMonth(month, 1))} aria-label="Mese successivo"><ArrowRight className="h-4 w-4" /></Button>
                </div>
              )}
              <details className="rounded-2xl border border-[#e5e7f0] bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">Filtri agenda</summary>
                <div className="mt-3 grid gap-3">
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
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm font-medium text-slate-600">
                    <input type="checkbox" checked={params.get('includeActual') !== 'false'} onChange={(e) => setParam('includeActual', e.target.checked ? 'true' : 'false')} />
                    Movimenti reali
                  </label>
                </div>
              </details>
            </div>

            <div className="hidden gap-3 lg:grid lg:grid-cols-7">
              <select value={view} onChange={(e) => setParam('view', e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm font-medium">
                <option value="month">Calendario</option>
                <option value="agenda">Agenda</option>
              </select>
              {view === 'month' ? (
                <div className="flex items-center gap-2 lg:col-span-2">
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
            </div>
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

            <section>
              <div className="block lg:hidden">
                <AgendaView payload={payload} />
              </div>

              {view === 'month' && (
                <div className="hidden space-y-6 lg:block">
                  <Card className="aurora-print-card border-[#e5e7f0] bg-white shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg capitalize">{monthLabel(month)}</CardTitle>
                        <p className="mt-1 text-sm text-slate-500">Celle sintetiche: seleziona un giorno per leggere tutti gli eventi.</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{payload.summary.eventCount} eventi</span>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-slate-400">{WEEKDAYS.map((day) => <div key={day} className="min-w-0">{day}</div>)}</div>
                        <div className="mt-2 grid grid-cols-7 gap-2" data-calendar-grid="desktop">
                          {paddedDays.map((day) => (
                            <CalendarDayCell
                              key={day.date}
                              day={day}
                              selected={day.date === selectedDay?.date}
                              onSelect={setSelectedDate}
                            />
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <SelectedDayPanel selectedDay={selectedDay} />
                </div>
              )}

              {view === 'agenda' && (
                <div className="hidden lg:block">
                  <AgendaView payload={payload} />
                </div>
              )}
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

              <div className="space-y-6">
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
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
