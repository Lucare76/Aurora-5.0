import Link from 'next/link'
import { CheckCircle2, Circle, LayoutDashboard } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type FirstUseChecklistStatus = {
  hasAccount: boolean
  hasCategory: boolean
  hasMovement: boolean
  hasBudget?: boolean
}

const steps = [
  {
    key: 'hasAccount',
    label: 'Crea il primo conto',
    description: 'Indica dove si trova il tuo denaro.',
    href: '/accounts',
    action: 'Vai ai conti',
    required: true,
  },
  {
    key: 'hasCategory',
    label: 'Verifica o crea le categorie',
    description: 'Servono per leggere meglio entrate e uscite.',
    href: '/categories',
    action: 'Vai alle categorie',
    required: true,
  },
  {
    key: 'hasMovement',
    label: 'Inserisci il primo movimento',
    description: 'Registra un’entrata, un’uscita o un trasferimento.',
    href: '/transactions',
    action: 'Nuovo movimento',
    required: true,
  },
  {
    key: 'dashboard',
    label: 'Esplora la Dashboard',
    description: 'Qui trovi patrimonio, andamento e prossime scadenze.',
    href: '/dashboard',
    action: 'Sei qui',
    required: true,
  },
  {
    key: 'hasBudget',
    label: 'Crea il primo budget',
    description: 'Facoltativo: ti aiuta a monitorare gli obiettivi di spesa.',
    href: '/budgets',
    action: 'Vai ai budget',
    required: false,
  },
] as const

export function isFirstUseChecklistComplete(status: FirstUseChecklistStatus): boolean {
  return status.hasAccount && status.hasCategory && status.hasMovement
}

export function FirstUseChecklist({ status }: { status: FirstUseChecklistStatus }) {
  if (isFirstUseChecklistComplete(status)) return null

  const completed = {
    hasAccount: status.hasAccount,
    hasCategory: status.hasCategory,
    hasMovement: status.hasMovement,
    hasBudget: Boolean(status.hasBudget),
    dashboard: true,
  }

  return (
    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Benvenuto in Aurora</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Completa i primi passi</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Per iniziare crea un conto, verifica le categorie e registra il tuo primo movimento.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white px-3 py-2 text-sm font-medium text-indigo-700">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard pronta
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((step) => {
            const done = completed[step.key]
            return (
              <Link
                key={step.key}
                href={step.href}
                className={cn(
                  'rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm',
                  done ? 'border-emerald-100' : 'border-[#e5e7f0] hover:border-indigo-200',
                )}
                aria-label={`${done ? 'Completato' : 'Da completare'}: ${step.label}`}
              >
                <div className="flex items-start gap-3">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                    <p className={cn('mt-3 text-xs font-semibold', done ? 'text-emerald-600' : 'text-indigo-600')}>
                      {done ? 'Completato' : step.action}
                      {!step.required && !done ? ' (facoltativo)' : ''}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
