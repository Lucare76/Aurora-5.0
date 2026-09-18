import type { LucideIcon } from 'lucide-react'

export function PageLoadingState({ label = 'Caricamento dati…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white motion-reduce:animate-none" />
      ))}
    </div>
  )
}

export function InlineEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d8dceb] bg-[#f8f9fc] px-5 py-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <Icon className="h-5 w-5 text-indigo-500" aria-hidden="true" />
      </div>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
