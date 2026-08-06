import type { AssistantCitation } from '@/lib/financial-assistant/types'

export function AssistantCitations({ citations }: { citations: AssistantCitation[] }) {
  if (citations.length === 0) return null
  return (
    <section className="mt-4 rounded-2xl border border-[#e5e7f0] bg-[#f8f9fc] p-4" aria-label="Citazioni">
      <h4 className="text-sm font-bold text-slate-900">Citazioni</h4>
      <ol className="mt-3 space-y-2 text-sm text-slate-600">
        {citations.map((citation) => (
          <li key={citation.id}>
            <span className="font-semibold text-slate-900">[{citation.id}]</span> {citation.label}: {citation.rowCount} record, campi {citation.fields.join(', ')}.
          </li>
        ))}
      </ol>
    </section>
  )
}
