import Link from 'next/link'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import type { AssistantResult as AssistantResultType } from '@/lib/financial-assistant/types'
import { AssistantCitations } from './AssistantCitations'
import { AssistantEvidence } from './AssistantEvidence'

export function AssistantResult({ result }: { result: AssistantResultType }) {
  const isSafeHref = result.navigation?.href?.startsWith('/')
  return (
    <article className="rounded-3xl border border-[#e5e7f0] bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge tone="success" label="Solo lettura" />
        {result.scope && <StatusBadge tone="neutral" label={`Perimetro ${result.scope}`} />}
        <StatusBadge tone="info" label="Dati del gestionale" />
      </div>
      <h3 className="text-lg font-bold text-slate-950">{result.status === 'NEEDS_INPUT' ? 'Servono alcuni dettagli' : 'Risposta di Aurora'}</h3>
      <p className="mt-2 leading-7 text-slate-700">{result.answer}</p>
      {result.summary.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {result.summary.map((item) => (
            <li key={item} className="rounded-2xl bg-[#f8f9fc] px-4 py-3 text-sm font-semibold text-slate-700">{item}</li>
          ))}
        </ul>
      )}
      {result.insights.length > 0 && (
        <div className="mt-4 grid gap-2">
          {result.insights.map((insight) => (
            <div key={insight.title} className="rounded-2xl border border-[#e5e7f0] bg-white p-3">
              <p className="text-sm font-bold text-slate-950">{insight.title}</p>
              <p className="mt-1 text-sm text-slate-600">{insight.detail}</p>
            </div>
          ))}
        </div>
      )}
      {result.missingInputs.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="mb-2"><StatusBadge tone="warning" label="Servono dettagli" /></div>
          <p className="font-bold">Per completare la valutazione mi servono ancora:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.missingInputs.map((input) => <li key={input.field}>{input.label}: {input.reason}</li>)}
          </ul>
        </div>
      )}
      <AssistantEvidence evidence={result.evidence} />
      <AssistantCitations citations={result.citations} />
      {result.warnings.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <div className="mb-2"><StatusBadge tone="warning" label="Da controllare" /></div>
          {result.warnings.join(' ')}
        </div>
      )}
      {isSafeHref && result.navigation && (
        <Link href={result.navigation.href} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          {result.navigation.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
        <LockKeyhole className="h-3.5 w-3.5" />
        Aurora non modifica i tuoi dati e non salva questa conversazione.
      </p>
    </article>
  )
}
