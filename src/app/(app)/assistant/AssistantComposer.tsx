'use client'

import { Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AssistantComposer({
  value,
  disabled,
  loading,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string
  disabled?: boolean
  loading?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <form
      className="sticky bottom-20 rounded-3xl border border-[#e5e7f0] bg-white p-3 shadow-xl shadow-slate-200/70 md:bottom-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!loading) onSubmit()
      }}
    >
      <label htmlFor="assistant-message" className="sr-only">Domanda per Aurora</label>
      <div className="flex gap-2">
        <textarea
          id="assistant-message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (!loading) onSubmit()
            }
          }}
          disabled={disabled}
          rows={2}
          className="min-h-14 flex-1 resize-none rounded-2xl border border-[#e5e7f0] bg-[#f8f9fc] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          placeholder="Es. Quanto ho speso questo mese?"
        />
        {loading ? (
          <Button type="button" variant="outline" className="h-14 w-14 rounded-2xl" onClick={onCancel} aria-label="Annulla analisi">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={disabled || !value.trim()} className="h-14 w-14 rounded-2xl" aria-label="Invia domanda">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 px-1 text-xs text-slate-400">Invio per mandare, Shift+Invio per andare a capo. Questa conversazione non viene ancora salvata.</p>
    </form>
  )
}
