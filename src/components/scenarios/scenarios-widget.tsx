'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FlaskConical, Plus, ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import type { FinancialScenario } from '@/lib/scenarios/types'
import { SIMULATION_BADGE } from '@/lib/scenarios/constants'

export function ScenariosWidget() {
  const [scenarios, setScenarios] = useState<FinancialScenario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/scenarios?limit=5&status=ready', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : { data: [] })
      .then(({ data }) => setScenarios(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const top = scenarios.slice(0, 3)

  return (
    <div className="space-y-3">
      {/* Simulation badge */}
      <p className="text-xs text-slate-400">{SIMULATION_BADGE}</p>

      {loading ? (
        <div className="py-4 text-center text-xs text-slate-400">Caricamento…</div>
      ) : top.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <FlaskConical className="h-8 w-8 text-slate-200" />
          <p className="text-sm text-slate-500">Nessuno scenario pronto.</p>
          <Link href="/scenarios/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}>
            <Plus className="h-3.5 w-3.5" />Crea
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {top.map((s) => {
            const delta = s.result_summary?.finalBalance?.delta
            return (
              <Link
                key={s.id}
                href={`/scenarios/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-[#e5e7f0] bg-slate-50 px-3 py-2.5 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                  <p className="text-xs text-slate-400">
                    {s.horizon_months}m · {s.actions.filter((a) => a.enabled).length} azioni
                  </p>
                </div>
                {delta !== undefined && (
                  <span className={cn('shrink-0 text-sm font-semibold ml-3', delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}

      {/* Footer link */}
      <div className="flex items-center justify-between pt-1">
        <Link href="/scenarios" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
          Tutti gli scenari <ArrowRight className="h-3 w-3" />
        </Link>
        <Link href="/scenarios/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs gap-1')}>
          <Plus className="h-3 w-3" />Nuovo
        </Link>
      </div>
    </div>
  )
}
