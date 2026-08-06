'use client'

import type { FinancialAssistantScope } from '@/lib/financial-assistant/types'
import { cn } from '@/lib/utils'

const LABELS: Record<FinancialAssistantScope, string> = {
  PERSONAL: 'Personale',
  AURORA: 'Aurora',
  ADI: 'ADI',
}

export function AssistantScopeSelector({
  scopes,
  value,
  onChange,
}: {
  scopes: FinancialAssistantScope[]
  value: FinancialAssistantScope
  onChange: (scope: FinancialAssistantScope) => void
}) {
  if (scopes.length <= 1) return null
  return (
    <div className="flex flex-wrap gap-2" aria-label="Perimetro dati">
      {scopes.map((scope) => (
        <button
          key={scope}
          type="button"
          onClick={() => onChange(scope)}
          className={cn(
            'h-10 rounded-2xl border px-4 text-sm font-semibold transition',
            value === scope
              ? 'border-indigo-200 bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'border-[#e5e7f0] bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700',
          )}
          aria-pressed={value === scope}
        >
          {LABELS[scope]}
        </button>
      ))}
    </div>
  )
}
