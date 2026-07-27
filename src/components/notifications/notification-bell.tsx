'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, BellOff, RefreshCw, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationItem } from './notification-item'
import type { Notification } from '@/lib/notifications/types'
import type { ResolvedUserSettings } from '@/lib/notifications/preferences-types'
import { isInQuietHours } from '@/lib/notifications/preferences-defaults'

interface BellState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: boolean
}

const BELL_COOLDOWN_MS = 30_000

export function NotificationBell() {
  const [open, setOpen]       = useState(false)
  const [state, setState]     = useState<BellState>({ notifications: [], unreadCount: 0, loading: false, error: false })
  const [settings, setSettings] = useState<ResolvedUserSettings | null>(null)
  const [quietHours, setQuietHours] = useState(false)
  const dropdownRef             = useRef<HTMLDivElement>(null)
  const lastFetchRef            = useRef<number>(0)

  // Load global settings once on mount
  useEffect(() => {
    fetch('/api/notification-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((body) => {
        if (!body?.data) return
        const s: ResolvedUserSettings = body.data
        setSettings(s)
        setQuietHours(isInQuietHours(s, new Date()))
      })
      .catch(() => {/* silently ignore; show all notifications */})
  }, [])

  const fetchUnread = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastFetchRef.current < BELL_COOLDOWN_MS) return
    lastFetchRef.current = now

    setState((s) => ({ ...s, loading: true, error: false }))
    try {
      const res  = await fetch('/api/notifications?status=unread&limit=5')
      if (!res.ok) throw new Error('fetch failed')
      const body = await res.json() as { data: { data: Notification[]; unreadCount: number } }
      setState({ notifications: body.data.data, unreadCount: body.data.unreadCount, loading: false, error: false })
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }))
    }
  }, [])

  useEffect(() => { fetchUnread(true) }, [fetchUnread])

  useEffect(() => {
    const onFocus = () => fetchUnread()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchUnread])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  async function handleMarkRead(id: string, isRead: boolean) {
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: isRead }),
    })
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => n.id === id ? { ...n, is_read: isRead } : n),
      unreadCount: isRead ? Math.max(0, s.unreadCount - 1) : s.unreadCount + 1,
    }))
  }

  async function handleSnooze(id: string, until: Date) {
    await fetch(`/api/notifications/${id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snoozed_until: until.toISOString() }),
    })
    // Remove from list and decrement badge
    setState((s) => {
      const notif = s.notifications.find((n) => n.id === id)
      return {
        ...s,
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: notif && !notif.is_read ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
      }
    })
  }

  // During quiet hours: only show CRITICAL in the dropdown
  const visibleNotifications = quietHours
    ? state.notifications.filter((n) => n.severity === 'CRITICAL')
    : state.notifications

  // Badge: always reflects server unreadCount (server already excludes snoozed)
  // During quiet hours, show only CRITICAL badge count
  const effectiveBadgeCount = quietHours
    ? state.notifications.filter((n) => n.severity === 'CRITICAL' && !n.is_read).length
    : state.unreadCount
  const badgeLabel = effectiveBadgeCount > 99 ? '99+' : String(effectiveBadgeCount)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) fetchUnread(true)
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label={`Avvisi${effectiveBadgeCount > 0 ? `, ${effectiveBadgeCount} non letti` : ''}${quietHours ? ' (ore silenziose attive)' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {quietHours ? <BellOff className="h-5 w-5 text-slate-400" /> : <Bell className="h-5 w-5" />}
        {effectiveBadgeCount > 0 && (
          <span
            aria-live="polite"
            aria-atomic="true"
            className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Avvisi recenti"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[#e5e7f0] bg-white shadow-xl shadow-slate-900/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e5e7f0] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-900">Avvisi</span>
              {effectiveBadgeCount > 0 && (
                <span aria-live="polite" className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                  {effectiveBadgeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fetchUnread(true)}
                disabled={state.loading}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Aggiorna avvisi"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', state.loading && 'animate-spin')} />
              </button>
              <Link
                href="/settings/notifications"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Impostazioni avvisi"
                title="Impostazioni avvisi"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Quiet hours banner */}
          {quietHours && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              Ore silenziose attive — solo avvisi critici visibili
            </div>
          )}

          {/* List */}
          <div className="max-h-80 divide-y divide-[#e5e7f0] overflow-y-auto">
            {state.loading && state.notifications.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            )}
            {!state.loading && visibleNotifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">
                  {quietHours ? 'Nessun avviso critico' : 'Nessun avviso non letto'}
                </p>
              </div>
            )}
            {visibleNotifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                compact
                onMarkRead={handleMarkRead}
                onSnooze={handleSnooze}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#e5e7f0] px-4 py-3">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Vedi tutti gli avvisi
            </Link>
            <Link
              href="/notifications?status=snoozed"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Posticipate
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
