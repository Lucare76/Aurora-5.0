import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-2xl py-16 text-center">
      <div className="relative mb-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <Icon className="h-8 w-8 text-slate-400" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-indigo-100/50 blur-xl" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 mb-5 max-w-sm">{description}</p>
      {action}
    </div>
  )
}
