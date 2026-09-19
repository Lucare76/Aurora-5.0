'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowUpRight,
  BookCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Landmark,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency } from '@/lib/utils'
import type { FinancialJournalPayload, JournalInsightTone } from '@/lib/financial-journal/types'

const toneStyles: Record<JournalInsightTone, string> = {
  POSITIVE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-900',
  INFO: 'border-indigo-200 bg-indigo-50 text-indigo-900',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date(value))
}

function formatPeriod(period: string) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

export default function FinancialJournalPage() {
  const [payload, setPayload] = useState<FinancialJournalPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/financial-journal', { cache: 'no-store' })
      if (!response.ok) throw new Error('LOAD_FAILED')
      setPayload(await response.json() as FinancialJournalPayload)
    } catch (error) {
      console.error('[financial-journal]', error)
      toast.error('Impossibile caricare il bilancio finanziario.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const closeMonth = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/financial-journal', { method: 'POST' })
      if (!response.ok) throw new Error('SAVE_FAILED')
      toast.success('Chiusura mensile salvata. Puoi aggiornarla fino alla fine del mese.')
      await load()
    } catch (error) {
      console.error('[financial-journal:save]', error)
      toast.error('Chiusura mensile non riuscita.')
    } finally {
      setSaving(false)
    }
  }

  const currentAlreadyClosed = payload?.closures.some((item) => item.period_key === payload.preview.period_key) ?? false

  if (loading && !payload) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}</div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    )
  }

  if (!payload) return null
  const { preview } = payload
  const cards = [
    { label: 'Entrate', value: preview.income, icon: ArrowUpRight, className: 'bg-emerald-50 text-emerald-700' },
    { label: 'Uscite', value: preview.expenses, icon: ArrowDownRight, className: 'bg-rose-50 text-rose-700' },
    { label: 'Risparmio', value: preview.savings, icon: WalletCards, className: preview.savings >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700' },
    { label: 'Patrimonio', value: preview.consolidated_net_worth, icon: Landmark, className: 'bg-violet-50 text-violet-700' },
  ]

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-xl shadow-indigo-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-200"><Sparkles className="h-4 w-4" /> Aurora Financial Journal</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Il mese, spiegato bene.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">Chiudi il mese con una fotografia permanente, scopri cosa è cambiato e ricostruisci gli eventi che hanno mosso il patrimonio.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />Aggiorna</Button>
            <Button onClick={closeMonth} disabled={saving} className="gap-2 bg-white text-indigo-900 hover:bg-indigo-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : currentAlreadyClosed ? <CheckCircle2 className="h-4 w-4" /> : <BookCheck className="h-4 w-4" />}
              {currentAlreadyClosed ? 'Aggiorna chiusura' : 'Salva chiusura'}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div><p className="text-sm font-medium text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{formatCurrency(card.value)}</p></div>
              <span className={cn('rounded-2xl p-3', card.className)}><card.icon className="h-5 w-5" /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /> Insight automatici</CardTitle>
            <CardDescription>Le variazioni che meritano davvero la tua attenzione.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload.insights.map((insight) => (
              <Link key={insight.id} href={insight.href} className={cn('block rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm', toneStyles[insight.tone])}>
                <p className="font-semibold">{insight.title}</p>
                <p className="mt-1 text-sm leading-5 opacity-80">{insight.message}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookCheck className="h-5 w-5 text-indigo-600" /> Anteprima chiusura</CardTitle>
            <CardDescription>{formatPeriod(preview.period_key)} · aggiornabile fino a fine mese</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Tasso di risparmio</span><strong>{preview.savings_rate == null ? '—' : `${preview.savings_rate.toFixed(1).replace('.', ',')}%`}</strong></div>
            <div className="flex justify-between gap-4 rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Investimenti censiti</span><strong>{formatCurrency(preview.investment_value)}</strong></div>
            <div className="flex justify-between gap-4 rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Movimenti del mese</span><strong>{preview.transaction_count}</strong></div>
            <div className="flex justify-between gap-4 rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Categoria principale</span><strong className="text-right">{preview.top_expense_category ?? 'Nessuna'}{preview.top_expense_category ? ` · ${formatCurrency(preview.top_expense_amount)}` : ''}</strong></div>
            <p className="pt-2 text-xs leading-5 text-slate-400">La chiusura salva una fotografia: non crea movimenti e non modifica saldi.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-indigo-600" /> Timeline finanziaria</CardTitle><CardDescription className="mt-1">Il perché dietro alle variazioni del patrimonio.</CardDescription></div>
            <Link href="/calendar" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}><CalendarDays className="h-4 w-4" />Apri calendario</Link>
          </div>
        </CardHeader>
        <CardContent>
          {payload.timeline.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center"><Clock3 className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 font-medium text-slate-700">La timeline si sta costruendo</p><p className="mt-1 text-sm text-slate-500">Aggiorna il patrimonio e salva la prima chiusura mensile.</p></div>
          ) : (
            <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-slate-200">
              {payload.timeline.map((event) => (
                <li key={event.id} className="relative grid grid-cols-[24px_1fr] gap-4 py-3">
                  <span className={cn('relative z-10 mt-1 h-6 w-6 rounded-full border-4 border-white', event.tone === 'POSITIVE' ? 'bg-emerald-500' : event.tone === 'WARNING' ? 'bg-amber-500' : 'bg-indigo-500')} />
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="font-semibold text-slate-900">{event.title}</p><p className="text-sm text-slate-500">{event.description}</p><p className="mt-1 text-xs text-slate-400">{formatDate(event.date)}</p></div>
                    {event.amount != null && <span className={cn('mt-1 font-semibold tabular-nums', event.tone === 'POSITIVE' ? 'text-emerald-700' : 'text-amber-700')}>{event.amount > 0 && event.type === 'PATRIMONY' ? '+' : ''}{formatCurrency(event.amount)}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {payload.closures.length > 0 && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-indigo-600" /> Storico chiusure</CardTitle><CardDescription>Il bilancio mensile resta confrontabile nel tempo.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500"><tr><th className="pb-3 font-medium">Mese</th><th className="pb-3 font-medium">Entrate</th><th className="pb-3 font-medium">Uscite</th><th className="pb-3 font-medium">Risparmio</th><th className="pb-3 font-medium">Patrimonio</th><th className="pb-3 font-medium">Salvata</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{payload.closures.map((closure) => <tr key={closure.id}><td className="py-3 font-semibold capitalize">{formatPeriod(closure.period_key)}</td><td className="py-3 tabular-nums">{formatCurrency(closure.income)}</td><td className="py-3 tabular-nums">{formatCurrency(closure.expenses)}</td><td className={cn('py-3 font-semibold tabular-nums', closure.savings >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{formatCurrency(closure.savings)}</td><td className="py-3 tabular-nums">{formatCurrency(closure.consolidated_net_worth)}</td><td className="py-3 text-slate-500">{formatDate(closure.closed_at)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
