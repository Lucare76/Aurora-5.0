'use client'

import { Loader2 } from 'lucide-react'

export default function ComparisonLoadingState() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-500 motion-reduce:animate-none" aria-hidden="true" />
      <p className="text-sm text-slate-600">Confronto in corso… stiamo calcolando i punteggi per ogni scenario.</p>
    </div>
  )
}
