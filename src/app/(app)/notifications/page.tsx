'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlarmClock, Bell, BellOff, CheckCheck, RefreshCw, Settings } from 'lucide-react'
import Link from 'next/link'
import { NotificationItem } from '@/components/notifications/notification-item'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  Notification,
  NotificationListResult,
  NotificationSeverity,
  NotificationStatusFilter,
  NotificationType,
} from '@/lib/notifications/types'

// ── Tabs ────────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'unread' | 'critical' | 'snoozed' | 'archived' | 'resolved'

const TABS: {
  id: TabKey
  label: string
  status: NotificationStatusFilter
  severity?: NotificationSeverity
}[] = [
  { id: 'all',      label: 'Tutti',         status: 'all' },
  { id: 'unread',   label: 'Non letti',     status: 'unread' },
  { id: 'critical', label: 'Critici',       status: 'all', severity: 'CRITICAL' },
  { id: 'snoozed',  label: 'Posticipati',   status: 'snoozed' },
  { id: 'archived', label: 'Archiviati',    status: 'archived' },
  { id: 'resolved', label: 'Risolti',       status: 'resolved' },
]

const LIMIT = 20

const EMPTY_LABEL: Record<TabKey, string> = {
  all:      'Tutto in ordine, nessun avviso attivo.',
  unread:   'Hai letto tutti gli avvisi.',
  critical: 'Nessun avviso critico.',
  snoozed:  'Nessun avviso posticipato.',
  archived: 'Nessun avviso archiviato.',
  resolved: 'Nessun avviso risolto.',
}

// ── Mute dialog ─────────────────────────────────────────────────────────────

function MuteConfirmDialog({
  notification,
  onConfirm,
  onCancel,
}: {
  notification: Notification
  onConfirm: (allTypes: boolean) => Promise<void>
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function doMute(allTypes: boolean) {
    setBusy(true)
    try { await onConfirm(allTypes) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-[#e5e7f0] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <BellOff className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900">Silenzia avvisi simili</h2>
        </div>
        <p className="mb-5 text-sm text-slate-600">
          Vuoi silenziare tutti gli avvisi di tipo <strong>{notification.type}</strong> per questa fonte, oppure tutti i tipi?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => doMute(false)}
            className="w-full rounded-xl border border-[#e5e7f0] px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Solo avvisi "{notification.type}"
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => doMute(true)}
            className="w-full rounded-xl border border-[#e5e7f0] px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Tutti gli avvisi da questa fonte
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    }>
      <NotificationsContent />
    </Suspense>
  )
}

function NotificationsContent() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('status') as TabKey | null) ?? 'all'

  const [activeTab,  setActiveTab]  = useState<TabKey>(TABS.find(t => t.id === initialTab) ? initialTab : 'all')
  const [page,       setPage]       = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [data,       setData]       = useState<NotificationListResult | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [muteTarget, setMuteTarget] = useState<Notification | null>(null)

  useEffect(() => {
    let cancelled = false
    const tab    = TABS.find((t) => t.id === activeTab)!
    const params = new URLSearchParams({
      status: tab.status,
      page:   String(page),
      limit:  String(LIMIT),
    })
    if (tab.severity) params.set('severity', tab.severity)

    setLoading(true)
    fetch(`/api/notifications?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { data: NotificationListResult } | null) => {
        if (!cancelled && body) setData(body.data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [activeTab, page, refreshKey])

  function refetch() { setRefreshKey((k) => k + 1) }

  function switchTab(id: TabKey) {
    setActiveTab(id)
    setPage(1)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await fetch('/api/notifications/refresh', { method: 'POST' })
      setPage(1)
      setRefreshKey((k) => k + 1)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleMarkAllRead() {
    setBusy(true)
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      refetch()
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkRead(id: string, isRead: boolean) {
    await fetch(`/api/notifications/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_read: isRead }),
    })
    refetch()
  }

  async function handleArchive(id: string) {
    await fetch(`/api/notifications/${id}/archive`, { method: 'POST' })
    refetch()
  }

  async function handleRestore(id: string) {
    await fetch(`/api/notifications/${id}/restore`, { method: 'POST' })
    refetch()
  }

  async function handleResolve(id: string) {
    await fetch(`/api/notifications/${id}/resolve`, { method: 'POST' })
    refetch()
  }

  async function handleSnooze(id: string, until: Date) {
    await fetch(`/api/notifications/${id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snoozed_until: until.toISOString() }),
    })
    refetch()
  }

  async function handleUnsnooze(id: string) {
    await fetch(`/api/notifications/${id}/unsnooze`, { method: 'POST' })
    refetch()
  }

  function handleMuteRequest(id: string) {
    const n = data?.data.find((x) => x.id === id)
    if (n) setMuteTarget(n)
  }

  async function handleMuteConfirm(allTypes: boolean) {
    if (!muteTarget || !muteTarget.source_type || !muteTarget.source_id) {
      setMuteTarget(null)
      return
    }
    await fetch('/api/notification-mutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: muteTarget.source_type,
        source_id: muteTarget.source_id,
        notification_type: allTypes ? undefined : muteTarget.type,
      }),
    })
    setMuteTarget(null)
    refetch()
  }

  const totalPages   = data ? Math.ceil(data.total / LIMIT) : 1
  const isArchived   = activeTab === 'archived'
  const isResolved   = activeTab === 'resolved'
  const isSnoozedTab = activeTab === 'snoozed'

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Avvisi</h1>
              {data && (
                <p className="text-sm text-slate-500">
                  {data.total} {data.total === 1 ? 'avviso' : 'avvisi'}
                  {data.unreadCount > 0 && ` · ${data.unreadCount} non ${data.unreadCount === 1 ? 'letto' : 'letti'}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(data?.unreadCount ?? 0) > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={busy} className="gap-2">
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Segna tutti letti</span>
                <span className="sm:hidden">Tutti letti</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Aggiorna
            </Button>
            <Link
              href="/settings/notifications"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Impostazioni</span>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[#e5e7f0] bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                activeTab === t.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {t.id === 'snoozed' && <AlarmClock className="h-3.5 w-3.5" />}
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          )}

          {!loading && data?.data.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e5e7f0] bg-white py-20 text-center">
              {isSnoozedTab
                ? <AlarmClock className="mb-3 h-10 w-10 text-slate-200" />
                : <Bell className="mb-3 h-10 w-10 text-slate-200" />
              }
              <p className="text-base font-semibold text-slate-400">Nessun avviso</p>
              <p className="mt-1 text-sm text-slate-400">{EMPTY_LABEL[activeTab]}</p>
            </div>
          )}

          {!loading && data?.data.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={!isArchived && !isResolved && !isSnoozedTab ? handleMarkRead : undefined}
              onArchive={!isArchived && !isSnoozedTab ? handleArchive : undefined}
              onRestore={isArchived ? handleRestore : undefined}
              onResolve={!isResolved && !isSnoozedTab ? handleResolve : undefined}
              onSnooze={!isArchived && !isResolved && !isSnoozedTab ? handleSnooze : undefined}
              onUnsnooze={isSnoozedTab ? handleUnsnooze : undefined}
              onMute={n.source_type && n.source_id ? handleMuteRequest : undefined}
            />
          ))}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Precedente
            </Button>
            <span className="text-sm text-slate-500">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Successiva
            </Button>
          </div>
        )}
      </div>

      {/* Mute confirm dialog */}
      {muteTarget && (
        <MuteConfirmDialog
          notification={muteTarget}
          onConfirm={handleMuteConfirm}
          onCancel={() => setMuteTarget(null)}
        />
      )}
    </>
  )
}
