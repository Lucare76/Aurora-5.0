'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Database, Loader2, Save, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency } from '@/lib/utils'
import type { FinancialHealthResult, HealthComponentKey } from '@/lib/financial-health/types'
import type { FinancialHealthSnapshot } from '@/lib/financial-health/snapshot-service'

const componentLabels: Record<HealthComponentKey, string> = {
  liquidity: 'Liquidità e saldi previsti',
  savings: 'Capacità di risparmio',
  budgets: 'Rispetto dei budget',
  debt: 'Sostenibilità del debito',
  deadlines: 'Regolarità delle scadenze',
  goals: 'Progresso degli obiettivi',
  alerts: 'Avvisi finanziari critici',
}

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value == null) return 'Non disponibile'
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

export default function FinancialHealthPage() {
  const [data, setData] = useState<FinancialHealthResult | null>(null)
  const [history, setHistory] = useState<FinancialHealthSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [healthRes, historyRes] = await Promise.all([
        fetch('/api/financial-health', { cache: 'no-store' }),
        fetch('/api/financial-health/history', { cache: 'no-store' }),
      ])
      if (!healthRes.ok) throw new Error('HEALTH_FAILED')
      const health = await healthRes.json()
      const historyPayload = historyRes.ok ? await historyRes.json() : { snapshots: [] }
      setData(health)
      setHistory(historyPayload.snapshots ?? [])
    } catch {
      setError('Salute finanziaria non disponibile. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const factors = useMemo(() => ({
    positive: data?.positiveFactors ?? [],
    negative: data?.negativeFactors ?? [],
  }), [data])

  const saveSnapshot = async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/financial-health/snapshot', { method: 'POST' })
      if (!res.ok) throw new Error('SNAPSHOT_FAILED')
      setSaveMessage('Snapshot salvato.')
      await load()
    } catch {
      setSaveMessage('Snapshot non salvato. Verifica che la migration locale sia applicata all’ambiente in uso.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-[#e5e7f0] bg-white">
        <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h1 className="text-xl font-bold text-slate-950">Salute finanziaria non disponibile</h1>
          <p className="max-w-md text-sm text-slate-500">{error}</p>
          <Button type="button" onClick={() => void load()}>Riprova</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Motore dati Sprint 14A</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Salute finanziaria</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Questo indicatore è una sintesi dei dati registrati in Aurora e non costituisce una valutazione creditizia o una consulenza finanziaria.
          </p>
        </div>
        <Button type="button" onClick={saveSnapshot} disabled={saving} aria-label="Salva snapshot del mese">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salva snapshot
        </Button>
      </header>

      {saveMessage && <p className="rounded-2xl border border-[#e5e7f0] bg-white px-4 py-3 text-sm font-medium text-slate-600">{saveMessage}</p>}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{data.period.label}</p>
                <p className="mt-2 text-6xl font-bold tabular-nums text-slate-950" aria-label={`Punteggio salute finanziaria ${data.totalScore ?? 'non disponibile'} su 100`}>
                  {data.totalScore ?? '—'}
                  <span className="text-2xl text-slate-400">/100</span>
                </p>
                <p className="mt-3 text-lg font-semibold text-indigo-700">{data.levelLabel}</p>
              </div>
              <div className="rounded-3xl bg-indigo-50 p-5 text-indigo-700">
                <Activity className="h-12 w-12" />
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600">{data.summary}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f8f9fc] p-4">
                <p className="text-xs font-semibold text-slate-500">Qualità dati</p>
                <p className="mt-1 font-bold text-slate-950">{data.dataQuality.level}</p>
              </div>
              <div className="rounded-2xl bg-[#f8f9fc] p-4">
                <p className="text-xs font-semibold text-slate-500">Confidenza</p>
                <p className="mt-1 font-bold tabular-nums text-slate-950">{data.confidencePercentage}%</p>
              </div>
              <div className="rounded-2xl bg-[#f8f9fc] p-4">
                <p className="text-xs font-semibold text-slate-500">Peso osservato</p>
                <p className="mt-1 font-bold tabular-nums text-slate-950">{data.observedWeight}/{data.observedWeight + data.missingWeight}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Metriche principali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-slate-500">Posizione finanziaria netta</span><strong>{formatCurrency(data.metrics.currentFinancialPosition)}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-slate-500">Liquidità corrente</span><strong>{formatCurrency(data.metrics.currentLiquidity)}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-slate-500">Saldo previsto 30 giorni</span><strong>{formatCurrency(data.metrics.projectedLiquidity30d)}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-slate-500">Margine mensile</span><strong>{formatCurrency(data.metrics.monthlyMargin)}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-slate-500">Tasso di risparmio</span><strong>{formatNumber(data.metrics.savingsRate, '%')}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-slate-500">Copertura spese stimata</span><strong>{formatNumber(data.metrics.expenseCoverageMonths, ' mesi')}</strong></div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(data.componentScores) as Array<[HealthComponentKey, FinancialHealthResult['componentScores'][HealthComponentKey]]>).map(([key, component]) => (
          <Card key={key} className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{componentLabels[key]}</p>
                  <p className="mt-1 text-xs text-slate-500">{component.availability === 'AVAILABLE' ? `Peso ${component.weight}` : 'Non applicabile'}</p>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', component.status === 'good' ? 'bg-emerald-50 text-emerald-700' : component.status === 'risk' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>
                  {component.score ?? '—'}
                </span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={component.score ?? 0}>
                <div className="h-full rounded-full bg-indigo-600" style={{ width: `${component.score ?? 0}%` }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader><CardTitle>Fattori positivi</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {factors.positive.slice(0, 5).map((factor) => (
                <li key={factor.id} className="flex gap-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /><span><strong>{factor.title}</strong><br /><span className="text-slate-500">{factor.description}</span></span></li>
              ))}
              {factors.positive.length === 0 && <li className="text-sm text-slate-500">Nessun fattore positivo specifico ancora disponibile.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader><CardTitle>Fattori da verificare</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {factors.negative.slice(0, 5).map((factor) => (
                <li key={factor.id} className="flex gap-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" /><span><strong>{factor.title}</strong><br /><span className="text-slate-500">{factor.description}</span></span></li>
              ))}
              {factors.negative.length === 0 && <li className="text-sm text-slate-500">Nessun fattore critico attivo nei dati caricati.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader><CardTitle>Azioni suggerite</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.recommendations.map((item) => (
                <li key={item.id} className="text-sm"><strong>{item.title}</strong><p className="mt-1 text-slate-500">{item.description}</p></li>
              ))}
              {data.recommendations.length === 0 && <li className="text-sm text-slate-500">Nessuna azione prioritaria determinata dalle regole attuali.</li>}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Trend</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.trends.slice(0, 6).map((trend) => (
              <div key={trend.metric} className="flex justify-between gap-4 rounded-2xl bg-[#f8f9fc] px-3 py-2">
                <span className="text-slate-600">{trend.metric}</span>
                <strong>{trend.direction} · {trend.interpretation}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Storico snapshot</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {history.map((snapshot) => (
                <li key={snapshot.id} className="flex justify-between gap-4 rounded-2xl bg-[#f8f9fc] px-3 py-2">
                  <span>{snapshot.period_key} · {snapshot.data_quality}</span>
                  <strong>{snapshot.total_score ?? '—'}/100</strong>
                </li>
              ))}
              {history.length === 0 && <li className="text-sm text-slate-500">Nessuno snapshot salvato.</li>}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
