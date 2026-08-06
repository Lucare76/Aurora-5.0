'use client'

export function AssistantSuggestions({ suggestions, onPick }: { suggestions: string[]; onPick: (suggestion: string) => void }) {
  if (suggestions.length === 0) return null
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion)}
          className="rounded-2xl border border-[#e5e7f0] bg-white p-4 text-left text-sm font-semibold leading-6 text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700 hover:shadow-sm"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
