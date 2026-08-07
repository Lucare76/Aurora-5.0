import { BadgeCheck, ShieldCheck } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'

export function AssistantHeader() {
  return (
    <header className="rounded-3xl border border-[#e5e7f0] bg-white p-5 shadow-sm md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3"><StatusBadge tone="info" label="Aurora 6.0" /></div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Chiedi ad Aurora</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Fai domande in italiano sui dati del gestionale. Le risposte sono deterministiche, motivate da evidenze e sempre in sola lettura.
          </p>
        </div>
        <div className="grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2 md:w-80">
          <span className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7f0] bg-[#f8f9fc] px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Solo lettura
          </span>
          <span className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7f0] bg-[#f8f9fc] px-3 py-2">
            <BadgeCheck className="h-4 w-4 text-indigo-600" />
            Nessun modello esterno
          </span>
        </div>
      </div>
    </header>
  )
}
