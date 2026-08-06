import { MessageCircle } from 'lucide-react'
import { AssistantSuggestions } from './AssistantSuggestions'

export function AssistantEmptyState({ suggestions, onPick }: { suggestions: string[]; onPick: (suggestion: string) => void }) {
  return (
    <section className="rounded-3xl border border-[#e5e7f0] bg-white p-5 shadow-sm md:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-950">Da dove vuoi iniziare?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Scegli un esempio oppure scrivi una domanda. Le risposte restano nel browser fino al refresh.</p>
        </div>
      </div>
      <AssistantSuggestions suggestions={suggestions} onPick={onPick} />
    </section>
  )
}
