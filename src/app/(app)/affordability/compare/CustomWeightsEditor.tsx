'use client'

import { CRITERIA } from '@/lib/decision-comparison/constants'
import type { CriterionKey } from '@/lib/decision-comparison/types'
import { validateCustomWeights } from './types'

export default function CustomWeightsEditor({
  weights,
  onChange,
}: {
  weights: Partial<Record<CriterionKey, number>>
  onChange: (next: Partial<Record<CriterionKey, number>>) => void
}) {
  const error = validateCustomWeights(weights)
  const sum = Object.values(weights).reduce((s, v) => s + (v ?? 0), 0)

  function setWeight(key: CriterionKey, raw: string) {
    const value = raw === '' ? undefined : Number(raw)
    onChange({ ...weights, [key]: value })
  }

  return (
    <section aria-labelledby="custom-weights-heading" className="space-y-3 rounded-xl border border-[#e5e7f0] bg-slate-50 p-4">
      <div>
        <h3 id="custom-weights-heading" className="text-sm font-semibold text-slate-900">
          Pesi personalizzati (0-100 per criterio)
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          I pesi vengono normalizzati proporzionalmente dal motore di confronto: non serve che la somma faccia esattamente 100.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CRITERIA.map((c) => (
          <div key={c.key}>
            <label htmlFor={`weight-${c.key}`} className="block text-xs font-medium text-slate-600">
              {c.label}
            </label>
            <input
              id={`weight-${c.key}`}
              type="number"
              min={0}
              max={100}
              step={1}
              value={weights[c.key] ?? ''}
              onChange={(e) => setWeight(c.key, e.target.value)}
              aria-describedby={error ? 'custom-weights-error' : 'custom-weights-sum'}
              className="mt-1 block w-full rounded-lg border border-[#e5e7f0] bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        ))}
      </div>

      <p id="custom-weights-sum" className="text-xs text-slate-500">
        Somma attuale: {sum}
      </p>

      {error && (
        <p id="custom-weights-error" role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </section>
  )
}
