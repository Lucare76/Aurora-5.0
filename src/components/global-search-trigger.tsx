'use client'

import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function GlobalSearchTrigger({
  onClick,
  compact = false,
  className,
}: {
  onClick: () => void
  compact?: boolean
  className?: string
}) {
  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-10 w-10 text-slate-600 hover:bg-slate-100', className)}
        onClick={onClick}
        aria-label="Apri ricerca globale"
      >
        <Search className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <button
      type="button"
      className={cn('mx-3 mb-3 flex h-11 items-center gap-3 rounded-xl border border-[#e5e7f0] bg-[#f8f9fc] px-3 text-sm text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700', className)}
      onClick={onClick}
      aria-label="Apri ricerca globale"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 text-left">Cerca o esegui...</span>
      <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
        Ctrl K
      </kbd>
    </button>
  )
}
