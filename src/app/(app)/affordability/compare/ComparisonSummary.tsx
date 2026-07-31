'use client'

import { BadgeCheck, Scale } from 'lucide-react'
import { fmtScore } from './format'
import { PROFILE_INFO } from './format'
import type { DecisionComparisonResult } from '@/lib/decision-comparison/types'

export default function ComparisonSummary({ result }: { result: DecisionComparisonResult }) {
  const winners = result.ranking.filter((r) => r.rank === 1)
  const isTie = winners.length > 1
  const scenarioName = (id: string) => result.scenarios.find((s) => s.id === id)?.name ?? id

  return (
    <section aria-labelledby="comparison-summary-heading" className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        {isTie ? <Scale className="mt-0.5 h-6 w-6 shrink-0 text-indigo-600" aria-hidden="true" /> : <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-indigo-600" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <h2 id="comparison-summary-heading" className="text-lg font-bold text-indigo-800">
            {isTie ? 'Parità tra più scenari' : `Scenario più adatto: ${scenarioName(winners[0].scenarioId)}`}
          </h2>
          <p className="mt-1 text-sm text-indigo-700">
            {isTie
              ? `${winners.map((w) => scenarioName(w.scenarioId)).join(', ')} ottengono un punteggio equivalente (${fmtScore(winners[0].finalScore)}) con il profilo "${PROFILE_INFO[result.profile].label}".`
              : `Punteggio ${fmtScore(winners[0].finalScore)} con il profilo "${PROFILE_INFO[result.profile].label}".`}
          </p>
          <p className="mt-2 text-xs text-indigo-600">
            Con i criteri selezionati, {isTie ? 'questi scenari risultano ugualmente adatti' : 'questo scenario risulta il più adatto'} tra quelli confrontati. Non è una raccomandazione finanziaria assoluta.
          </p>
        </div>
      </div>
    </section>
  )
}
