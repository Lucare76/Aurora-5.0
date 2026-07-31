'use client'

import { CRITERIA } from '@/lib/decision-comparison/constants'
import { CRITERION_LABELS, fmtCriterionValue } from './format'
import type { DecisionComparisonResult } from '@/lib/decision-comparison/types'

export default function ComparisonCriteriaBreakdown({ result }: { result: DecisionComparisonResult }) {
  const currency = result.compatibility.currency
  const scenarios = result.scenarios
  const scoresByScenario = new Map(result.scores.map((s) => [s.scenarioId, s]))

  return (
    <section aria-labelledby="criteria-breakdown-heading" className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
      <h2 id="criteria-breakdown-heading" className="mb-3 text-base font-semibold text-slate-900">
        Dettaglio criteri
      </h2>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Punteggio normalizzato e valore grezzo per ciascun criterio e scenario</caption>
          <thead>
            <tr className="border-b border-[#e5e7f0] text-left text-xs text-slate-500">
              <th scope="col" className="py-2 pr-3 font-medium">Criterio</th>
              <th scope="col" className="py-2 pr-3 font-medium">Peso</th>
              {scenarios.map((s) => (
                <th key={s.id} scope="col" className="py-2 pr-3 font-medium">{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((criterion) => (
              <tr key={criterion.key} className="border-b border-[#f1f5f9]">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-slate-700">{CRITERION_LABELS[criterion.key]}</th>
                <td className="py-2 pr-3 text-slate-500">{Math.round((result.weightsUsed[criterion.key] ?? 0) * 100)}%</td>
                {scenarios.map((s) => {
                  const score = scoresByScenario.get(s.id)
                  const cs = score?.criterionScores.find((c) => c.criterion === criterion.key)
                  return (
                    <td key={s.id} className="py-2 pr-3">
                      <span className="block text-slate-900">{fmtCriterionValue(cs?.rawValue ?? null, criterion.key, currency)}</span>
                      <span className="block text-xs text-slate-400">
                        {cs?.isMissing ? 'dato mancante' : `${cs?.normalizedScore.toFixed(0)}/100`}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-4 md:hidden">
        {scenarios.map((s) => {
          const score = scoresByScenario.get(s.id)
          return (
            <div key={s.id} className="rounded-xl border border-[#e5e7f0] p-3">
              <p className="mb-2 text-sm font-semibold text-slate-900">{s.name}</p>
              <dl className="space-y-1.5">
                {CRITERIA.map((criterion) => {
                  const cs = score?.criterionScores.find((c) => c.criterion === criterion.key)
                  return (
                    <div key={criterion.key} className="flex items-start justify-between gap-3 text-xs">
                      <dt className="min-w-0 text-slate-500">{CRITERION_LABELS[criterion.key]}</dt>
                      <dd className="min-w-0 break-words text-right text-slate-800">
                        {fmtCriterionValue(cs?.rawValue ?? null, criterion.key, currency)}
                        <span className="ml-1 text-slate-400">
                          ({cs?.isMissing ? 'mancante' : `${cs?.normalizedScore.toFixed(0)}/100`})
                        </span>
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          )
        })}
      </div>
    </section>
  )
}
