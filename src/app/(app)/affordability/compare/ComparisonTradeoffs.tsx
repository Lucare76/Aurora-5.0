'use client'

import { ArrowRight, AlertTriangle } from 'lucide-react'
import { CRITERION_LABELS } from './format'
import type { DecisionComparisonResult } from '@/lib/decision-comparison/types'

export default function ComparisonTradeoffs({ result }: { result: DecisionComparisonResult }) {
  const scenarioName = (id: string) => result.scenarios.find((s) => s.id === id)?.name ?? id
  const relevantTradeoffs = result.tradeoffs.filter((t) => !t.isDominance && (t.aWinsOn.length > 0 || t.bWinsOn.length > 0))

  return (
    <section aria-labelledby="tradeoffs-heading" className="space-y-4">
      <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
        <h2 id="tradeoffs-heading" className="mb-3 text-base font-semibold text-slate-900">
          Compromessi tra scenari
        </h2>
        {relevantTradeoffs.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun compromesso significativo: gli scenari non presentano differenze rilevanti sui criteri confrontati.</p>
        ) : (
          <ul className="space-y-3">
            {relevantTradeoffs.map((t) => (
              <li key={`${t.scenarioAId}-${t.scenarioBId}`} className="rounded-xl border border-[#e5e7f0] p-3 text-sm">
                <p className="font-medium text-slate-800">
                  {scenarioName(t.scenarioAId)} <ArrowRight className="mx-1 inline h-3.5 w-3.5 text-slate-400" aria-hidden="true" /> {scenarioName(t.scenarioBId)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t.aWinsOn.length > 0 && (
                    <>
                      {scenarioName(t.scenarioAId)} è preferibile su: {t.aWinsOn.map((k) => CRITERION_LABELS[k]).join(', ')}.{' '}
                    </>
                  )}
                  {t.bWinsOn.length > 0 && (
                    <>
                      {scenarioName(t.scenarioBId)} è preferibile su: {t.bWinsOn.map((k) => CRITERION_LABELS[k]).join(', ')}.{' '}
                    </>
                  )}
                  {t.tiedOn.length > 0 && <>{t.tiedOn.length} criteri in parità.</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.dominance.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Scenari dominati</p>
              <ul className="mt-1 space-y-1">
                {result.dominance.map((d) => (
                  <li key={`${d.dominantScenarioId}-${d.dominatedScenarioId}`} className="text-xs text-amber-700">
                    {scenarioName(d.dominantScenarioId)} non è mai peggiore di {scenarioName(d.dominatedScenarioId)} ed è preferibile su {d.marginCriteria.length} criteri.
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
