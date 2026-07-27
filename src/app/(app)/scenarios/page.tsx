'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Archive, FlaskConical, Plus, RefreshCw, Star, StarOff, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { SIMULATION_BADGE, DISCLAIMER_TEXT } from '@/lib/scenarios/constants'
import type { FinancialScenario } from '@/lib/scenarios/types'

function statusLabel(status: FinancialScenario['status']) {
  switch (status) {
    case 'ready':    return { label: 'Pronto',     cls: 'bg-emerald-100 text-emerald-700' }
    case 'draft':    return { label: 'Bozza',      cls: 'bg-slate-100 text-slate-600' }
    case 'outdated': return { label: 'Aggiornare', cls: 'bg-amber-100 text-amber-700' }
    case 'archived': return { label: 'Archiviato', cls: 'bg-slate-100 text-slate-500' }
  }
}

function ScenarioCard({
  scenario,
  onDelete,
  onToggleFavorite,
  onArchive,
}: {
  scenario: FinancialScenario
  onDelete: (id: string) => void
  onToggleFavorite: (id: string, fav: boolean) => void
  onArchive: (id: string) => void
}) {
  const { label, cls } = statusLabel(scenario.status)
  const summary = scenario.result_summary

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        {/* Top row: badge + favorite + delta */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', cls)}>{label}</span>
            {scenario.is_favorite && (
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            )}
          </div>
          {summary && (
            <span className={cn('text-sm font-semibold shrink-0', summary.finalBalance.delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {summary.finalBalance.delta >= 0 ? '+' : ''}{formatCurrency(summary.finalBalance.delta)}
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={`/scenarios/${scenario.id}`} className="block">
          <h3 className="font-semibold text-slate-900 hover:text-indigo-600 leading-snug line-clamp-2">
            {scenario.name}
          </h3>
        </Link>

        {/* Description */}
        {scenario.description && (
          <p className="mt-1 text-sm text-slate-500 line-clamp-2">{scenario.description}</p>
        )}

        {/* Meta */}
        <p className="mt-1.5 text-xs text-slate-400">
          {scenario.horizon_months} {scenario.horizon_months === 1 ? 'mese' : 'mesi'}
          {' · '}
          {scenario.actions.length} {scenario.actions.length === 1 ? 'azione' : 'azioni'}
        </p>

        {/* Action row */}
        <div className="mt-3 flex items-center gap-1.5">
          <Link
            href={`/scenarios/${scenario.id}`}
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'flex-1 justify-center')}
          >
            Apri
          </Link>
          <button
            onClick={() => onToggleFavorite(scenario.id, !scenario.is_favorite)}
            className="p-2 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"
            title={scenario.is_favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            {scenario.is_favorite
              ? <StarOff className="h-4 w-4" />
              : <Star className="h-4 w-4" />}
          </button>
          {scenario.status !== 'archived' && (
            <button
              onClick={() => onArchive(scenario.id)}
              className="p-2 rounded-lg text-slate-400 hover:text-amber-600 transition-colors"
              title="Archivia"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(scenario.id)}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
            title="Elimina"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

type Filter = 'all' | 'favorite' | 'archived'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'Attivi' },
  { key: 'favorite', label: 'Preferiti' },
  { key: 'archived', label: 'Archiviati' },
]

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<FinancialScenario[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<Filter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scenarios?limit=50', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setScenarios(data ?? [])
    } catch {
      toast.error('Impossibile caricare gli scenari.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo scenario?')) return
    try {
      await fetch(`/api/scenarios/${id}`, { method: 'DELETE' })
      setScenarios((prev) => prev.filter((s) => s.id !== id))
      toast.success('Scenario eliminato.')
    } catch {
      toast.error('Errore durante l\'eliminazione.')
    }
  }

  const handleToggleFavorite = async (id: string, fav: boolean) => {
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: fav }),
      })
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setScenarios((prev) => prev.map((s) => s.id === id ? data : s))
    } catch {
      toast.error('Errore durante l\'aggiornamento.')
    }
  }

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/scenarios/${id}/archive`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setScenarios((prev) => prev.map((s) => s.id === id ? data : s))
      toast.success('Scenario archiviato.')
    } catch {
      toast.error('Errore durante l\'archiviazione.')
    }
  }

  const visible = scenarios.filter((s) => {
    if (filter === 'favorite') return s.is_favorite
    if (filter === 'archived') return s.status === 'archived'
    return s.status !== 'archived'
  })

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-indigo-500 shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Scenari finanziari</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">{SIMULATION_BADGE}</p>
        </div>
        <Link
          href="/scenarios/new"
          className={cn(buttonVariants(), 'gap-1.5 self-start shrink-0')}
        >
          <Plus className="h-4 w-4" />
          Nuovo scenario
        </Link>
      </header>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              filter === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Caricamento...
        </div>
      ) : visible.length === 0 ? (
        <Card className="border-[#e5e7f0] bg-white">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center p-8">
            <FlaskConical className="h-12 w-12 text-slate-200" />
            <div>
              <p className="font-semibold text-slate-700">Nessuno scenario trovato</p>
              <p className="mt-1 text-sm text-slate-500">
                {filter === 'favorite'
                  ? 'Nessuno scenario preferito. Aggiungi la stella a uno scenario per trovarlo qui.'
                  : filter === 'archived'
                    ? 'Nessuno scenario archiviato.'
                    : 'Crea il tuo primo scenario per simulare "cosa succederebbe se…"'}
              </p>
            </div>
            {filter === 'all' && (
              <Link href="/scenarios/new" className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
                <Plus className="h-4 w-4" />
                Crea il primo scenario
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {/* ── Disclaimer ── */}
      <p className="text-xs text-slate-400 text-center pb-4">{DISCLAIMER_TEXT}</p>
    </div>
  )
}
