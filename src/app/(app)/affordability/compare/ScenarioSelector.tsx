'use client'

import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import ScenarioForm from './ScenarioForm'
import {
  DOMAIN_LABELS,
  SCENARIO_DOMAINS,
  createEmptyDraft,
  generateScenarioId,
  isDraftComplete,
  validateScenarioCount,
  type ScenarioDraft,
  type ScenarioDomain,
} from './types'
import { MAX_SCENARIOS, MIN_SCENARIOS } from '@/lib/decision-comparison/constants'

export default function ScenarioSelector({
  drafts,
  onChange,
}: {
  drafts: ScenarioDraft[]
  onChange: (next: ScenarioDraft[]) => void
}) {
  const countCheck = validateScenarioCount(drafts.length)

  function addScenario() {
    if (drafts.length >= MAX_SCENARIOS) return
    onChange([...drafts, createEmptyDraft(generateScenarioId(), 'generic')])
  }

  function removeScenario(id: string) {
    onChange(drafts.filter((d) => d.id !== id))
  }

  function changeDomain(id: string, domain: ScenarioDomain) {
    onChange(drafts.map((d) => (d.id === id ? createEmptyDraft(id, domain) : d)))
  }

  function updateDraft(next: ScenarioDraft) {
    onChange(drafts.map((d) => (d.id === next.id ? next : d)))
  }

  return (
    <section aria-labelledby="scenario-selector-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="scenario-selector-heading" className="text-base font-semibold text-slate-900">
          Scenari da confrontare
        </h2>
        <span className="text-xs text-slate-500">
          {drafts.length}/{MAX_SCENARIOS} scenari (minimo {MIN_SCENARIOS})
        </span>
      </div>

      {!countCheck.ok && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {countCheck.reason}
        </p>
      )}

      <ul className="space-y-4">
        {drafts.map((draft, index) => (
          <li key={draft.id} className="rounded-2xl border border-[#e5e7f0] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Dominio scenario ${index + 1}`}>
                {SCENARIO_DOMAINS.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => changeDomain(draft.id, domain)}
                    aria-pressed={draft.domain === domain}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                      draft.domain === domain
                        ? 'border-indigo-300 bg-indigo-600 text-white'
                        : 'border-[#e5e7f0] bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {DOMAIN_LABELS[domain]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => removeScenario(draft.id)}
                disabled={drafts.length <= MIN_SCENARIOS}
                aria-label={`Rimuovi scenario ${index + 1}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e7f0] text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <ScenarioForm draft={draft} onChange={updateDraft} />

            {!isDraftComplete(draft) && (
              <p className="mt-2 text-xs text-slate-400">Completa i campi obbligatori (*) per includere questo scenario nel confronto.</p>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addScenario}
        disabled={drafts.length >= MAX_SCENARIOS}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#e5e7f0] px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Aggiungi scenario
      </button>
    </section>
  )
}
