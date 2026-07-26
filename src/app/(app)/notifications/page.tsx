'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { NotificationItem } from '@/components/notifications/notification-item'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  NotificationListResult,
  NotificationSeverity,
  NotificationStatusFilter,
} from '@/lib/notifications/types'

// ── Tabs ────────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'unread' | 'critical' | 'archived' | 'resolved'

const TABS: {
  id: TabKey
  label: string
  status: NotificationStatusFilter
  severity?: NotificationSeverity
}[] = [
  { id: 'all',      label: 'Tutti',      status: 'all' },
  { id: 'unread',   label: 'Non letti',  status: 'unread' },
  { id: 'critical', label: 'Critici',    status: 'all', severity: 'CRITICAL' },
  { id: 'archived', label: 'Archiviati', status: 'archived' },
  { id: 'resolved', label: 'Risolti',    status: 'resolved' },
]

const LIMIT = 20

const EMPTY_LABEL: Record<TabKey, string> = {
  all:      'Tutto in ordine, nessun avviso attivo.',
  unread:   'Hai letto tutti gli avvisi.',
  critical: 'Nessun avviso critico.',
  archived: 'Nessun avviso archiviato.',
  resolved: 'Nessun avviso risolto.',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [activeTab,  setActiveTab]  = useState<TabKey>('all')
  const [page,       setPage]       = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [data,       setData]       = useState<NotificationListResult | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy,       setBusy]       = useState(false)

  // Fetch list whenever tab / page / refreshKey change
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

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1
  const isArchived = activeTab === 'archived'
  const isResolved = activeTab === 'resolved'

  return (
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={busy}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Segna tutti letti</span>
              <span className="sm:hidden">Tutti letti</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Aggiorna
          </Button>
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
              'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all',
              activeTab === t.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
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
            <Bell className="mb-3 h-10 w-10 text-slate-200" />
            <p className="text-base font-semibold text-slate-400">Nessun avviso</p>
            <p className="mt-1 text-sm text-slate-400">{EMPTY_LABEL[activeTab]}</p>
          </div>
        )}

        {!loading && data?.data.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onMarkRead={!isArchived && !isResolved ? handleMarkRead : undefined}
            onArchive={!isArchived ? handleArchive : undefined}
            onRestore={isArchived ? handleRestore : undefined}
            onResolve={!isResolved ? handleResolve : undefined}
          />
        ))}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Precedente
          </Button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Successiva
          </Button>
        </div>
      )}
    </div>
  )
}
