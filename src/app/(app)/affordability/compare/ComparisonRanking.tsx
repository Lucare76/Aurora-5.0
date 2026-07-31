'use client'

import { DOMAIN_LABELS } from './types'
import { fmtScore } from './format'
import type { DecisionComparisonResult } from '@/lib/decision-comparison/types'

const TYPE_TO_DOMAIN = {
  GENERIC_PURCHASE: 'generic',
  CAR_PURCHASE: 'car',
  HOME_PURCHASE: 'home',
  TRAVEL_PURCHASE: 'travel',
} as const

export default function ComparisonRanking({ result }: { result: DecisionComparisonResult }) {
  const sorted = [...result.ranking].sort((a, b) => a.rank - b.rank)
  const scenarioById = new Map(result.scenarios.map((s) => [s.id, s]))
  const dominatedIds = new Set(result.dominance.map((d) => d.dominatedScenarioId))
  const dominantIds = new Set(result.dominance.map((d) => d.dominantScenarioId))

  return (
    <section aria-labelledby="comparison-ranking-heading" className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
      <h2 id="comparison-ranking-heading" className="mb-3 text-base font-semibold text-slate-900">
        Classifica
      </h2>
      <ol className="space-y-2">
        {sorted.map((r) => {
          const scenario = scenarioById.get(r.scenarioId)
          if (!scenario) return null
          return (
            <li key={r.scenarioId} className="flex flex-col gap-1 rounded-xl border border-[#e5e7f0] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700" aria-hidden="true">
                  {r.rank}
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-900">
                    {scenario.name}
                    <span className="ml-2 text-xs font-normal text-slate-400">({DOMAIN_LABELS[TYPE_TO_DOMAIN[scenario.type]]})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.isTie && 'In parità con altri scenari · '}
                    {dominantIds.has(r.scenarioId) && 'Non è mai peggiore di almeno un altro scenario · '}
                    {dominatedIds.has(r.scenarioId) && 'Dominato da un altro scenario su tutti i criteri considerati'}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {fmtScore(r.finalScore)}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
