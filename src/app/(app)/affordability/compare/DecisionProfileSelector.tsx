'use client'

import { cn } from '@/lib/utils'
import { BUILTIN_PROFILES, PROFILE_INFO } from './format'
import type { ComparisonProfile } from '@/lib/decision-comparison/types'

export default function DecisionProfileSelector({
  profile,
  onChange,
}: {
  profile: ComparisonProfile
  onChange: (next: ComparisonProfile) => void
}) {
  const allProfiles: ComparisonProfile[] = [...BUILTIN_PROFILES, 'CUSTOM']

  return (
    <section aria-labelledby="profile-selector-heading" className="space-y-3">
      <div>
        <h2 id="profile-selector-heading" className="text-base font-semibold text-slate-900">
          Profilo decisionale
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">Determina come vengono pesati i criteri di confronto. Non è una raccomandazione finanziaria.</p>
      </div>

      <div role="radiogroup" aria-labelledby="profile-selector-heading" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {allProfiles.map((p) => {
          const info = PROFILE_INFO[p]
          const selected = profile === p
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(p)}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                selected ? 'border-indigo-300 bg-indigo-50' : 'border-[#e5e7f0] bg-white hover:bg-slate-50',
              )}
            >
              <span className={cn('block text-sm font-semibold', selected ? 'text-indigo-700' : 'text-slate-800')}>{info.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{info.description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
