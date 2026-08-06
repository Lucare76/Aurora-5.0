import type { AssistantEvidence } from '@/lib/financial-assistant/types'

function formatValue(value: AssistantEvidence['value'], unit?: AssistantEvidence['unit']) {
  if (typeof value === 'number' && unit === 'EUR') return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
  if (typeof value === 'number' && unit === 'PERCENT') return `${value.toLocaleString('it-IT')}%`
  if (typeof value === 'number') return value.toLocaleString('it-IT')
  if (value === null) return 'n.d.'
  return String(value)
}

export function AssistantEvidence({ evidence }: { evidence: AssistantEvidence[] }) {
  if (evidence.length === 0) return null
  return (
    <section className="mt-4" aria-label="Dati utilizzati">
      <h4 className="text-sm font-bold text-slate-900">Dati utilizzati</h4>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {evidence.map((item) => (
          <div key={`${item.metric}-${item.citationIds.join('-')}`} className="rounded-2xl border border-[#e5e7f0] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.metric.replace(/_/g, ' ')}</p>
            <p className="mt-1 text-base font-bold tabular-nums text-slate-950">{formatValue(item.value, item.unit)}</p>
            {item.citationIds.length > 0 && <p className="mt-1 text-xs text-slate-500">Fonte: {item.citationIds.map((id) => `[${id}]`).join(', ')}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
