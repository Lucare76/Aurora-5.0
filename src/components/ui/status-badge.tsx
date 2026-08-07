import { AlertTriangle, CheckCircle2, Circle, Info, ShieldAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatusTone = 'info' | 'warning' | 'critical' | 'success' | 'neutral'

type StatusBadgeConfig = {
  label: string
  icon: LucideIcon
  className: string
}

export const STATUS_BADGE_CONFIG: Record<StatusTone, StatusBadgeConfig> = {
  info: {
    label: 'Informazione',
    icon: Info,
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  warning: {
    label: 'Da controllare',
    icon: AlertTriangle,
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  critical: {
    label: 'Critico',
    icon: ShieldAlert,
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  success: {
    label: 'Tutto ok',
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  neutral: {
    label: 'Neutro',
    icon: Circle,
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
}

export function statusToneFromSeverity(severity: 'CRITICAL' | 'WARNING' | 'INFO'): StatusTone {
  if (severity === 'CRITICAL') return 'critical'
  if (severity === 'WARNING') return 'warning'
  return 'info'
}

export function statusToneFromIssueStatus(status: 'open' | 'acknowledged' | 'ignored' | 'resolved' | 'stale'): StatusTone {
  if (status === 'resolved') return 'success'
  if (status === 'ignored' || status === 'stale') return 'neutral'
  if (status === 'acknowledged') return 'warning'
  return 'info'
}

export function issueStatusLabel(status: 'open' | 'acknowledged' | 'ignored' | 'resolved' | 'stale'): string {
  const labels = {
    open: 'Aperta',
    acknowledged: 'Riconosciuta',
    ignored: 'Ignorata',
    resolved: 'Risolta',
    stale: 'Non più rilevata',
  } satisfies Record<typeof status, string>
  return labels[status]
}

export function severityLabel(severity: 'CRITICAL' | 'WARNING' | 'INFO'): string {
  const labels = {
    CRITICAL: 'Critico',
    WARNING: 'Da controllare',
    INFO: 'Informazione',
  } satisfies Record<typeof severity, string>
  return labels[severity]
}

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: StatusTone
  label?: string
  className?: string
}) {
  const config = STATUS_BADGE_CONFIG[tone]
  const Icon = config.icon
  const text = label ?? config.label
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
        config.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{text}</span>
    </span>
  )
}
