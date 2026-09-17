'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlarmClock, Bell, BellOff, CheckCheck, RefreshCw, Settings } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { NotificationItem } from '@/components/notifications/notification-item'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  Notification,
  NotificationListResult,
  NotificationSeverity,
  NotificationStatusFilter,
} from '@/lib/notifications/types'
import { NOTIFICATION_META } from '@/lib/notifications/constants'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="mute-dialog-title">
      <div className="w-full max-w-sm rounded-2xl border border-[#e5e7f0] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <BellOff className="h-5 w-5 text-slate-600" aria-hidden="true" />
          <h2 id="mute-dialog-title" className="text-base font-semibold text-slate-900">Silenzia avvisi simili</h2>
        </div>
        <p className="mb-5 text-sm text-slate-600">
          Vuoi silenziare tutti gli avvisi di tipo <strong>{NOTIFICATION_META[notification.type]?.label ?? notification.type}</strong> per questa fonte, oppure tutti i tipi?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => doMute(false)}
            className="w-full rounded-xl border border-[#e5e7f0] px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Solo avvisi “{NOTIFICATION_META[notification.type]?.label ?? notification.type}”
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
          <button type="button" disabled={busy} onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50">
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-300" aria-hidden="true" />
        <span className="sr-only">Caricamento avvisi…</span>
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
  const [loadError,  setLoadError]  = useState(false)
  const [muteTarget, setMuteTarget] = useState<Notification | null>(null)

  useEffect(() => {
    let cancelled = false
    const tab = TABS.find((t) => t.id === activeTab)!
    const params = new URLSearchParams({
      status: tab.status,
      page: String(page),
      limit: String(LIMIT),
    })
    if (tab.severity) params.set('severity', tab.severity)

    setLoading(true)
    setLoadError(false)
    fetch(`/api/notifications?${params}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ data: NotificationListResult }>
      })
      .then((body) => {
        if (!cancelled) setData(body.data)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [activeTab, page, refreshKey])

  function refetch() { setRefreshKey((k) => k + 1) }

  function switchTab(id: TabKey) {
    setActiveTab(id)
    setPage(1)
  }

  async function postAction(url: string, init?: RequestInit, successMessage?: string) {
    const res = await fetch(url, init)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (successMessage) toast.success(successMessage)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await postAction('/api/notifications/refresh', { method: 'POST' })
      setPage(1)
      refetch()
      toast.success('Avvisi aggiornati.')
    } catch {
      toast.error('Impossibile aggiornare gli avvisi.')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleMarkAllRead() {
    setBusy(true)
    try {
      await postAction('/api/notifications/mark-all-read', { method: 'POST' }, 'Avvisi segnati come letti.')
      refetch()
    } catch {
      toast.error('Impossibile segnare gli avvisi come letti.')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkRead(id: string, isRead: boolean) {
    try {
      await postAction(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: isRead }),
      })
      refetch()
    } catch {
      toast.error('Impossibile aggiornare l’avviso.')
    }
  }

  async function handleArchive(id: string) {
    try {
      await postAction(`/api/notifications/${id}/archive`, { method: 'POST' }, 'Avviso archiviato.')
      refetch()
    } catch {
      toast.error('Impossibile archiviare l’avviso.')
    }
  }

  async function handleRestore(id: string) {
    try {
      await postAction(`/api/notifications/${id}/restore`, { method: 'POST' }, 'Avviso ripristinato.')
      refetch()
    } catch {
      toast.error('Impossibile ripristinare l’avviso.')
    }
  }

  async function handleResolve(id: string) {
    try {
      await postAction(`/api/notifications/${id}/resolve`, { method: 'POST' }, 'Avviso risolto.')
      refetch()
    } catch {
      toast.error('Impossibile risolvere l’avviso.')
    }
  }

  async function handleSnooze(id: string, until: Date) {
    try {
      await postAction(`/api/notifications/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozed_until: until.toISOString() }),
      }, 'Avviso posticipato.')
      refetch()
    } catch {
      toast.error('Impossibile posticipare l’avviso.')
    }
  }

  async function handleUnsnooze(id: string) {
    try {
      await postAction(`/api/notifications/${id}/unsnooze`, { method: 'POST' }, 'Avviso riattivato.')
      refetch()
    } catch {
      toast.error('Impossibile riattivare l’avviso.')
    }
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
    try {
      await postAction('/api/notification-mutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: muteTarget.source_type,
          source_id: muteTarget.source_id,
          notification_type: allTypes ? undefined : muteTarget.type,
        }),
      }, 'Fonte silenziata.')
      setMuteTarget(null)
      refetch()
    } catch {
      toast.error('Impossibile silenziare questa fonte.')
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1
  const isArchived = activeTab === 'archived'
  const isResolved = activeTab === 'resolved'
  const isSnoozedTab = activeTab === 'snoozed'

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <Bell className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Avvisi</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Tieni sotto controllo ciò che richiede attenzione senza confondere gli avvisi attivi con quelli già risolti o posticipati.
              </p>
              {data && !loading && (
                <p className="mt-1 text-sm text-slate-500" aria-live="polite">
                  {data.total} {data.total === 1 ? 'avviso' : 'avvisi'}
                  {data.unreadCount > 0 && ` · ${data.unreadCount} non ${data.unreadCount === 1 ? 'letto' : 'letti'}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(data?.unreadCount ?? 0) > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={busy} className="gap-2">
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Segna tutti letti</span>
                <span className="sm:hidden">Tutti letti</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
              Aggiorna
            </Button>
            <Link
              href="/settings/notifications"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Impostazioni</span>
            </Link>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[#e5e7f0] bg-white p-1 shadow-sm" role="tablist" aria-label="Filtra avvisi">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => switchTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                activeTab === t.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {t.id === 'snoozed' && <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />}
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-300" aria-hidden="true" />
              <span className="sr-only">Caricamento avvisi…</span>
            </div>
          )}

          {!loading && loadError && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 py-14 text-center" role="alert">
              <BellOff className="mb-3 h-10 w-10 text-red-300" aria-hidden="true" />
              <p className="font-semibold text-red-800">Impossibile caricare gli avvisi</p>
              <p className="mt-1 max-w-md text-sm text-red-700">Riprova tra poco. Nessuna azione è stata eseguita sui tuoi avvisi.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>Riprova</Button>
            </div>
          )}

          {!loading && !loadError && data?.data.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e5e7f0] bg-white py-20 text-center">
              {isSnoozedTab
                ? <AlarmClock className="mb-3 h-10 w-10 text-slate-200" aria-hidden="true" />
                : <Bell className="mb-3 h-10 w-10 text-slate-200" aria-hidden="true" />
              }
              <p className="text-base font-semibold text-slate-500">Nessun avviso</p>
              <p className="mt-1 text-sm text-slate-400">{EMPTY_LABEL[activeTab]}</p>
            </div>
          )}

          {!loading && !loadError && data?.data.map((n) => (
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

        {!loading && !loadError && totalPages > 1 && (
          <nav className="flex items-center justify-center gap-3" aria-label="Paginazione avvisi">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Precedente
            </Button>
            <span className="text-sm text-slate-500" aria-live="polite">Pagina {page} di {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Successiva
            </Button>
          </nav>
        )}
      </div>

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
