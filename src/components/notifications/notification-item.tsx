'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlarmClock,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCircle2,
  Circle,
  ExternalLink,
  RefreshCw,
  Repeat,
  Target,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from '@/lib/notifications/types'
import { tomorrowAt9 } from '@/lib/notifications/preferences-defaults'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Type icons ─────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  negative_projected_balance: Wallet,
  budget_threshold:           Target,
  overdue_recurrence:         Repeat,
  upcoming_recurrence:        Repeat,
  upcoming_loan_payment:      RefreshCw,
  overdue_loan_payment:       RefreshCw,
  loan_due_soon:              RefreshCw,
  goal_behind_schedule:       Target,
  automation_failure:         Zap,
  automation_conflict:        Zap,
  possible_duplicate:         AlertTriangle,
}

const SEVERITY_COLORS = {
  INFO:     'bg-blue-50 text-blue-600 border-blue-200',
  WARNING:  'bg-amber-50 text-amber-600 border-amber-200',
  CRITICAL: 'bg-red-50 text-red-600 border-red-200',
}

const SEVERITY_DOT = {
  INFO:     'bg-blue-400',
  WARNING:  'bg-amber-400',
  CRITICAL: 'bg-red-500',
}

const SEVERITY_LABEL = {
  INFO:     'Info',
  WARNING:  'Avviso',
  CRITICAL: 'Critico',
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'Adesso'
  if (mins < 60)  return `${mins} min fa`
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`
  return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`
}

function snoozedUntilLabel(iso: string): string {
  const d = new Date(iso)
  return `Posticipata fino al ${d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
}

// ── Snooze dialog ──────────────────────────────────────────────────────────

const SNOOZE_PRESETS = [
  { label: 'Tra 1 ora',     getDate: () => new Date(Date.now() + 3_600_000) },
  { label: 'Domani alle 09:00', getDate: () => tomorrowAt9() },
  { label: 'Tra 3 giorni',  getDate: () => new Date(Date.now() + 3 * 86_400_000) },
  { label: 'Tra 1 settimana', getDate: () => new Date(Date.now() + 7 * 86_400_000) },
]

function SnoozeDialog({
  open,
  onClose,
  onSnooze,
  isCritical,
}: {
  open: boolean
  onClose: () => void
  onSnooze: (until: Date) => Promise<void>
  isCritical: boolean
}) {
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  async function doSnooze(until: Date) {
    setBusy(true)
    try { await onSnooze(until); onClose() } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm border-[#e5e7f0] bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <AlarmClock className="h-5 w-5 text-indigo-600" />
            Posticipa avviso
          </DialogTitle>
        </DialogHeader>
        {isCritical && (
          <p className="mt-1 rounded-lg bg-red-50 p-3 text-xs text-red-700" role="alert">
            Questo è un avviso critico. Durante il posticipo non comparirà nel badge principale.
          </p>
        )}
        <div className="mt-2 space-y-2">
          {SNOOZE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={busy}
              onClick={() => doSnooze(p.getDate())}
              className="w-full rounded-xl border border-[#e5e7f0] px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              type="datetime-local"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              className="h-10 flex-1 rounded-xl border border-[#e5e7f0] px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Data e ora personalizzata"
            />
            <button
              type="button"
              disabled={busy || !custom}
              onClick={() => custom && doSnooze(new Date(custom))}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Annulla
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification
  compact?: boolean
  onMarkRead?: (id: string, isRead: boolean) => void
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  onResolve?: (id: string) => void
  onSnooze?: (id: string, until: Date) => Promise<void>
  onUnsnooze?: (id: string) => Promise<void>
  onMute?: (id: string) => void
}

export function NotificationItem({
  notification: n,
  compact = false,
  onMarkRead,
  onArchive,
  onRestore,
  onResolve,
  onSnooze,
  onUnsnooze,
  onMute,
}: NotificationItemProps) {
  const [busy, setBusy] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const Icon = TYPE_ICONS[n.type] ?? Bell

  const isArchived = n.archived_at !== null
  const isResolved = n.resolved_at !== null
  const isSnoozed  = n.snoozed_until !== null && new Date(n.snoozed_until).getTime() > Date.now()

  async function handle(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await action() } finally { setBusy(false) }
  }

  if (compact) {
    return (
      <div className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50',
        !n.is_read && 'bg-indigo-50/40',
      )}>
        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border', SEVERITY_COLORS[n.severity])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium text-slate-900', !n.is_read && 'font-semibold')}>
            {n.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
          <p className="mt-1 text-xs text-slate-400">{relativeTime(n.created_at)}</p>
        </div>
        {!n.is_read && (
          <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', SEVERITY_DOT[n.severity])} aria-hidden="true" />
        )}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'group relative rounded-2xl border p-4 transition-all',
          !n.is_read && !isArchived && !isResolved && !isSnoozed
            ? 'border-indigo-100 bg-indigo-50/30'
            : 'border-[#e5e7f0] bg-white',
          isResolved && 'opacity-60',
          isSnoozed && 'border-amber-100 bg-amber-50/20',
        )}
        role="article"
        aria-label={`Avviso: ${n.title}`}
      >
        <div className="flex items-start gap-3">
          {/* Severity icon */}
          <div className={cn(
            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            SEVERITY_COLORS[n.severity],
          )}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                SEVERITY_COLORS[n.severity],
              )}>
                <span className="sr-only">Severità: </span>
                {SEVERITY_LABEL[n.severity]}
              </span>
              {!n.is_read && !isArchived && !isResolved && !isSnoozed && (
                <span className={cn('h-2 w-2 rounded-full', SEVERITY_DOT[n.severity])} aria-label="Non letto" />
              )}
              {isResolved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Risolto
                </span>
              )}
              {isArchived && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  <Archive className="h-3 w-3" aria-hidden="true" /> Archiviato
                </span>
              )}
              {isSnoozed && n.snoozed_until && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <AlarmClock className="h-3 w-3" aria-hidden="true" />
                  {snoozedUntilLabel(n.snoozed_until)}
                </span>
              )}
            </div>

            <h3 className={cn('mt-1 text-sm font-semibold text-slate-900', !n.is_read && !isArchived && !isSnoozed && 'font-bold')}>
              {n.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{n.message}</p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400">{relativeTime(n.created_at)}</span>
              {n.source_url && (
                <Link
                  href={n.source_url}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Vai al dettaglio
                </Link>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {!isArchived && !isResolved && !isSnoozed && onMarkRead && (
              <button
                type="button"
                onClick={() => handle(() => Promise.resolve(onMarkRead(n.id, !n.is_read)))}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={n.is_read ? 'Segna come non letto' : 'Segna come letto'}
                title={n.is_read ? 'Segna come non letto' : 'Segna come letto'}
              >
                {n.is_read ? <Circle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </button>
            )}
            {!isArchived && !isResolved && onSnooze && !isSnoozed && (
              <button
                type="button"
                onClick={() => setSnoozeOpen(true)}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                aria-label="Posticipa"
                title="Posticipa"
              >
                <AlarmClock className="h-4 w-4" />
              </button>
            )}
            {isSnoozed && onUnsnooze && (
              <button
                type="button"
                onClick={() => handle(() => onUnsnooze(n.id))}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-700"
                aria-label="Mostra ora (annulla posticipo)"
                title="Mostra ora"
              >
                <AlarmClock className="h-4 w-4" />
              </button>
            )}
            {onMute && !isResolved && (
              <button
                type="button"
                onClick={() => onMute(n.id)}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Silenzia avvisi simili"
                title="Silenzia avvisi simili"
              >
                <BellOff className="h-4 w-4" />
              </button>
            )}
            {!isArchived && onArchive && (
              <button
                type="button"
                onClick={() => handle(() => Promise.resolve(onArchive(n.id)))}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Archivia"
                title="Archivia"
              >
                <Archive className="h-4 w-4" />
              </button>
            )}
            {isArchived && onRestore && (
              <button
                type="button"
                onClick={() => handle(() => Promise.resolve(onRestore(n.id)))}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Ripristina"
                title="Ripristina"
              >
                <ArchiveRestore className="h-4 w-4" />
              </button>
            )}
            {!isResolved && onResolve && !isSnoozed && (
              <button
                type="button"
                onClick={() => handle(() => Promise.resolve(onResolve(n.id)))}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                aria-label="Segna come risolto"
                title="Segna come risolto"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Snooze dialog */}
      {onSnooze && (
        <SnoozeDialog
          open={snoozeOpen}
          onClose={() => setSnoozeOpen(false)}
          onSnooze={(until) => onSnooze(n.id, until)}
          isCritical={n.severity === 'CRITICAL'}
        />
      )}
    </>
  )
}
