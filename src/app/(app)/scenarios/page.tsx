'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Archive, FlaskConical, Plus, RefreshCw, Star, StarOff, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { cn, formatCurrency } from '@/lib/utils'
import { SIMULATION_BADGE, DISCLAIMER_TEXT } from '@/lib/scenarios/constants'
import type { FinancialScenario } from '@/lib/scenarios/types'

function statusPresentation(status: FinancialScenario['status']): { label: string; tone: StatusTone } {
  switch (status) {
    case 'ready':    return { label: 'Pronto', tone: 'success' }
    case 'draft':    return { label: 'Bozza', tone: 'neutral' }
    case 'outdated': return { label: 'Da aggiornare', tone: 'warning' }
    case 'archived': return { label: 'Archiviato', tone: 'neutral' }
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
  const status = statusPresentation(scenario.status)
  const summary = scenario.result_summary

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={status.tone} label={status.label} />
            {scenario.is_favorite && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600" aria-label="Scenario preferito">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                <span className="sr-only">Preferito</span>
              </span>
            )}
          </div>
          {summary && (
            <span
              className={cn('shrink-0 text-sm font-semibold tabular-nums', summary.finalBalance.delta >= 0 ? 'text-emerald-600' : 'text-red-500')}
              aria-label={`Differenza finale ${formatCurrency(summary.finalBalance.delta)}`}
            >
              {summary.finalBalance.delta >= 0 ? '+' : ''}{formatCurrency(summary.finalBalance.delta)}
            </span>
          )}
        </div>

        <Link href={`/scenarios/${scenario.id}`} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
          <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 hover:text-indigo-600">
            {scenario.name}
          </h3>
        </Link>

        {scenario.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{scenario.description}</p>
        )}

        <p className="mt-1.5 text-xs text-slate-400">
          {scenario.horizon_months} {scenario.horizon_months === 1 ? 'mese' : 'mesi'}
          {' · '}
          {scenario.actions.length} {scenario.actions.length === 1 ? 'azione' : 'azioni'}
        </p>

        <div className="mt-3 flex items-center gap-1.5">
          <Link
            href={`/scenarios/${scenario.id}`}
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'flex-1 justify-center')}
          >
            Apri
          </Link>
          <button
            type="button"
            onClick={() => onToggleFavorite(scenario.id, !scenario.is_favorite)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title={scenario.is_favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            aria-label={scenario.is_favorite ? `Rimuovi ${scenario.name} dai preferiti` : `Aggiungi ${scenario.name} ai preferiti`}
          >
            {scenario.is_favorite
              ? <StarOff className="h-4 w-4" aria-hidden="true" />
              : <Star className="h-4 w-4" aria-hidden="true" />}
          </button>
          {scenario.status !== 'archived' && (
            <button
              type="button"
              onClick={() => onArchive(scenario.id)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              title="Archivia"
              aria-label={`Archivia ${scenario.name}`}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(scenario.id)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            title="Elimina"
            aria-label={`Elimina ${scenario.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
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
      const res = await fetch(`/api/scenarios/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
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
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 shrink-0 text-indigo-500" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Scenari finanziari</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {SIMULATION_BADGE}. Confronta ipotesi senza modificare movimenti, saldi o budget reali.
          </p>
        </div>
        <Link
          href="/scenarios/new"
          className={cn(buttonVariants(), 'gap-1.5 self-start shrink-0')}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuovo scenario
        </Link>
      </header>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filtra scenari">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              filter === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400" role="status" aria-live="polite">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          Caricamento scenari…
        </div>
      ) : visible.length === 0 ? (
        <Card className="border-[#e5e7f0] bg-white">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
            <FlaskConical className="h-12 w-12 text-slate-200" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-700">Nessuno scenario trovato</p>
              <p className="mt-1 text-sm text-slate-500">
                {filter === 'favorite'
                  ? 'Nessuno scenario preferito. Aggiungi la stella a uno scenario per trovarlo qui.'
                  : filter === 'archived'
                    ? 'Nessuno scenario archiviato.'
                    : 'Crea il tuo primo scenario per simulare “cosa succederebbe se…” senza cambiare i dati reali.'}
              </p>
            </div>
            {filter === 'all' && (
              <Link href="/scenarios/new" className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Crea il primo scenario
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
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

      <p className="pb-4 text-center text-xs leading-5 text-slate-400">{DISCLAIMER_TEXT}</p>
    </div>
  )
}
