'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle, Archive, Calculator, ChevronDown, ChevronUp,
  Copy, FlaskConical, Loader2, RefreshCw, Star, StarOff, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { DISCLAIMER_TEXT, SIMULATION_BADGE } from '@/lib/scenarios/constants'
import type { FinancialScenario, ScenarioEngineResult } from '@/lib/scenarios/types'
import { ScenarioResults } from '@/components/scenarios/scenario-results'
import { ScenarioChart } from '@/components/scenarios/scenario-chart'
import { ScenarioEditor } from '@/components/scenarios/scenario-editor'

export default function ScenarioDetailPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const id      = params.id

  const [scenario,    setScenario]    = useState<FinancialScenario | null>(null)
  const [result,      setResult]      = useState<ScenarioEngineResult | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [showEditor,  setShowEditor]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scenarios/${id}`, { cache: 'no-store' })
      if (res.status === 404) { router.replace('/scenarios'); return }
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setScenario(data)
    } catch {
      setError('Impossibile caricare lo scenario.')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { void load() }, [load])

  const handleCalculate = async () => {
    if (!scenario) return
    setCalculating(true)
    try {
      const res = await fetch(`/api/scenarios/${id}/calculate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setResult(data)
      setScenario(data.scenario)
      toast.success('Calcolo completato.')
    } catch {
      toast.error('Errore durante il calcolo.')
    } finally {
      setCalculating(false)
    }
  }

  const handleSave = async (updated: FinancialScenario) => {
    const res = await fetch(`/api/scenarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updated.name,
        description: updated.description,
        horizon_months: updated.horizon_months,
        actions: updated.actions,
        assumptions: updated.assumptions,
      }),
    })
    if (!res.ok) throw new Error()
    const { data } = await res.json()
    setScenario(data)
    setResult(null)
    setShowEditor(false)
    toast.success('Scenario aggiornato.')
  }

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/scenarios/${id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      toast.success('Scenario duplicato.')
      router.push(`/scenarios/${data.id}`)
    } catch {
      toast.error('Errore durante la duplicazione.')
    }
  }

  const handleArchive = async () => {
    if (!confirm('Archiviare questo scenario?')) return
    try {
      await fetch(`/api/scenarios/${id}/archive`, { method: 'POST' })
      toast.success('Scenario archiviato.')
      router.push('/scenarios')
    } catch {
      toast.error('Errore durante l\'archiviazione.')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Eliminare definitivamente questo scenario?')) return
    try {
      await fetch(`/api/scenarios/${id}`, { method: 'DELETE' })
      toast.success('Scenario eliminato.')
      router.push('/scenarios')
    } catch {
      toast.error('Errore durante l\'eliminazione.')
    }
  }

  const handleToggleFavorite = async () => {
    if (!scenario) return
    const newFav = !scenario.is_favorite
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newFav }),
      })
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setScenario(data)
    } catch {
      toast.error('Errore.')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    )
  }

  if (error || !scenario) {
    return (
      <Card className="border-[#e5e7f0] bg-white">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center p-8">
          <AlertTriangle className="h-10 w-10 text-red-300" />
          <p className="text-slate-500">{error ?? 'Scenario non trovato.'}</p>
          <Button variant="outline" onClick={() => router.push('/scenarios')}>
            Torna agli scenari
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-indigo-500 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 truncate">
              {scenario.name}
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">{SIMULATION_BADGE}</p>
          {scenario.description && (
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">{scenario.description}</p>
          )}
        </div>

        {/* Icon actions — always visible, compact on mobile */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleToggleFavorite}
            className="p-2 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"
            title={scenario.is_favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            {scenario.is_favorite
              ? <StarOff className="h-4 w-4" />
              : <Star className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDuplicate}
            className="p-2 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors"
            title="Duplica"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={handleArchive}
            className="p-2 rounded-lg text-slate-400 hover:text-amber-600 transition-colors"
            title="Archivia"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
            title="Elimina"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Meta strip ── */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          {scenario.horizon_months} {scenario.horizon_months === 1 ? 'mese' : 'mesi'}
        </span>
        <span>·</span>
        <span>
          {scenario.actions.filter((a) => a.enabled).length} azioni attive
          {scenario.actions.length !== scenario.actions.filter((a) => a.enabled).length
            ? ` (${scenario.actions.length - scenario.actions.filter((a) => a.enabled).length} disabilitate)`
            : ''}
        </span>
        {scenario.last_calculated_at && (
          <>
            <span>·</span>
            <span>Calcolato {new Date(scenario.last_calculated_at).toLocaleDateString('it-IT')}</span>
          </>
        )}
      </div>

      {/* ── Primary actions ── */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={handleCalculate}
          disabled={calculating}
          className="gap-2 sm:flex-none"
        >
          {calculating
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Calculator className="h-4 w-4" />}
          {calculating ? 'Calcolo in corso...' : 'Calcola proiezione'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowEditor((v) => !v)}
          className="gap-2 sm:flex-none"
        >
          {showEditor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showEditor ? 'Chiudi editor' : 'Modifica azioni'}
        </Button>
      </div>

      {/* ── Editor (collapsible) ── */}
      {showEditor && (
        <ScenarioEditor
          scenario={scenario}
          onSave={handleSave}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {/* ── Results ── */}
      {result ? (
        <div className="space-y-5">
          <ScenarioChart projection={result.projection} />
          <ScenarioResults result={result} />
        </div>
      ) : scenario.result_summary ? (
        <Card className="border-dashed border-slate-200 bg-slate-50">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500 mb-4 text-center">
              Risultato del {new Date(scenario.last_calculated_at!).toLocaleDateString('it-IT')}.
              Ricalcola per aggiornare.
            </p>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Delta saldo finale',
                  value: (scenario.result_summary.finalBalance.delta >= 0 ? '+' : '') +
                    formatCurrency(scenario.result_summary.finalBalance.delta),
                  highlight: scenario.result_summary.finalBalance.delta >= 0,
                },
                {
                  label: 'Saldo baseline',
                  value: formatCurrency(scenario.result_summary.finalBalance.baseline),
                  highlight: null,
                },
                {
                  label: 'Saldo scenario',
                  value: formatCurrency(scenario.result_summary.finalBalance.scenario),
                  highlight: null,
                },
                {
                  label: 'Mesi negativi',
                  value: String(scenario.result_summary.negativeMonths.scenario),
                  highlight: scenario.result_summary.negativeMonths.scenario === 0,
                },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="rounded-xl bg-white border border-slate-100 p-3 text-center">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className={cn('font-semibold text-sm mt-0.5', highlight === true ? 'text-emerald-600' : highlight === false ? 'text-red-500' : 'text-slate-700')}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {scenario.result_summary.summary && (
              <p className="mt-4 text-sm text-slate-600 text-center">{scenario.result_summary.summary}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-slate-200">
          <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Calculator className="h-10 w-10 text-slate-200" />
            <div>
              <p className="font-medium text-slate-600">Nessuna proiezione disponibile</p>
              <p className="mt-1 text-sm text-slate-400">
                Clicca "Calcola proiezione" per visualizzare il confronto con la baseline.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Disclaimer ── */}
      <p className="text-xs text-slate-400 text-center pb-4">{DISCLAIMER_TEXT}</p>
    </div>
  )
}
