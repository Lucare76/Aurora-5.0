'use client'

import { Info } from 'lucide-react'
import { CRITERION_LABELS } from './format'
import type { DecisionComparisonResult } from '@/lib/decision-comparison/types'

export default function ComparisonWarnings({ result }: { result: DecisionComparisonResult }) {
  const scenariosWithMissingData = result.scenarios.filter((s) => s.missingMetrics.length > 0)
  const negligibleCriteria = result.criterionWinners.filter((w) => w.isNegligibleDifference)

  const hasWarnings = result.compatibility.level !== 'FULL' || scenariosWithMissingData.length > 0 || negligibleCriteria.length > 0

  if (!hasWarnings) return null

  return (
    <section aria-labelledby="comparison-warnings-heading" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <div className="space-y-1.5">
          <h2 id="comparison-warnings-heading" className="text-xs font-semibold text-slate-700">
            Compatibilità e avvisi
          </h2>
          <ul className="space-y-1 text-xs text-slate-600">
            {result.compatibility.level !== 'FULL' && (
              <li>Confronto tra domini diversi: il confronto usa solo le metriche finanziarie comuni, non quelle specifiche di ciascun dominio.</li>
            )}
            {scenariosWithMissingData.map((s) => (
              <li key={s.id}>
                &quot;{s.name}&quot;: dati non disponibili per {s.missingMetrics.map((k) => CRITERION_LABELS[k]).join(', ')} (valori esclusi dal punteggio).
              </li>
            ))}
            {negligibleCriteria.length > 0 && (
              <li>
                Differenze trascurabili su: {negligibleCriteria.map((w) => CRITERION_LABELS[w.criterion]).join(', ')} — non sono state considerate un vantaggio significativo.
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
