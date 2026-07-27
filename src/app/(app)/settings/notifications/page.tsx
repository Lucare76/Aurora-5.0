'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlarmClock,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ResolvedUserSettings } from '@/lib/notifications/preferences-types'
import type {
  NotificationType,
  NotificationSourceType,
} from '@/lib/notifications/types'

// ── Types ──────────────────────────────────────────────────────────────────

type TypePreferenceData = {
  type: NotificationType
  label: string
  isEnabled: boolean
  config: Record<string, unknown>
}

type SourceMuteData = {
  id: string
  source_type: NotificationSourceType
  source_id: string
  notification_type: NotificationType | null
  muted_until: string | null
  created_at: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<NotificationType, string> = {
  negative_projected_balance: 'Saldo previsto negativo',
  budget_threshold:           'Soglia budget',
  upcoming_recurrence:        'Ricorrenza imminente',
  overdue_recurrence:         'Ricorrenza scaduta',
  upcoming_loan_payment:      'Pagamento prestito imminente',
  overdue_loan_payment:       'Pagamento prestito scaduto',
  loan_due_soon:              'Prestito in scadenza',
  goal_behind_schedule:       'Obiettivo in ritardo',
  automation_failure:         'Automazione fallita',
  automation_conflict:        'Conflitto automazione',
  possible_duplicate:         'Possibile duplicato',
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  account:   'Conto',
  budget:    'Budget',
  goal:      'Obiettivo',
  loan:      'Prestito',
  recurrence: 'Ricorrenza',
  automation: 'Automazione',
}

const ALL_TYPES: NotificationType[] = [
  'negative_projected_balance',
  'budget_threshold',
  'upcoming_recurrence',
  'overdue_recurrence',
  'upcoming_loan_payment',
  'overdue_loan_payment',
  'loan_due_soon',
  'goal_behind_schedule',
  'automation_failure',
  'automation_conflict',
  'possible_duplicate',
]

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionCard({ title, description, icon: Icon, children }: {
  title: string
  description: string
  icon: typeof Settings
  children: React.ReactNode
}) {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-indigo-50 p-2 text-indigo-600">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg text-slate-950">{title}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled }: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </div>
  )
}

function NumberField({ label, value, min, max, onChange, disabled, unit }: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  disabled?: boolean
  unit?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="min-w-0 flex-1 text-sm text-slate-700">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!isNaN(v) && v >= min && v <= max) onChange(v)
          }}
          className="h-9 w-20 rounded-xl border border-[#e5e7f0] bg-white px-2 text-center text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  )
}

// ── Per-type config panels ──────────────────────────────────────────────────

function TypeConfigPanel({
  pref,
  onChange,
  onSave,
  busy,
}: {
  pref: TypePreferenceData
  onChange: (type: NotificationType, config: Record<string, unknown>) => void
  onSave: (type: NotificationType) => Promise<void>
  busy: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const c = pref.config

  function update(key: string, value: unknown) {
    onChange(pref.type, { ...c, [key]: value })
  }

  const configFields = (() => {
    switch (pref.type) {
      case 'negative_projected_balance':
        return (
          <div className="space-y-3">
            <NumberField label="Giorni di previsione" value={Number(c.lookaheadDays ?? 30)} min={1} max={365} onChange={(v) => update('lookaheadDays', v)} disabled={!pref.isEnabled || busy} unit="giorni" />
            <NumberField label="Soglia critica sotto" value={Number(c.criticalBelow ?? -100)} min={-999999} max={0} onChange={(v) => update('criticalBelow', v)} disabled={!pref.isEnabled || busy} unit="€" />
          </div>
        )
      case 'budget_threshold':
        return (
          <div className="space-y-3">
            <NumberField label="Avviso (%) utilizzo" value={Number(c.warningPercentage ?? 80)} min={1} max={100} onChange={(v) => update('warningPercentage', v)} disabled={!pref.isEnabled || busy} unit="%" />
            <NumberField label="Critico (%) utilizzo" value={Number(c.criticalPercentage ?? 100)} min={1} max={500} onChange={(v) => update('criticalPercentage', v)} disabled={!pref.isEnabled || busy} unit="%" />
          </div>
        )
      case 'upcoming_recurrence':
      case 'overdue_recurrence':
        return (
          <div className="space-y-3">
            <NumberField label="Preavviso" value={Number(c.advanceDays ?? 3)} min={0} max={90} onChange={(v) => update('advanceDays', v)} disabled={!pref.isEnabled || busy} unit="giorni" />
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-700">Avvisi scaduto</span>
              <Switch checked={Boolean(c.overdueEnabled ?? true)} onCheckedChange={(v) => update('overdueEnabled', v)} disabled={!pref.isEnabled || busy} aria-label="Avvisi scaduto" />
            </div>
            <NumberField label="Critico dopo scadenza" value={Number(c.overdueCriticalAfterDays ?? 7)} min={0} max={90} onChange={(v) => update('overdueCriticalAfterDays', v)} disabled={!pref.isEnabled || busy} unit="giorni" />
          </div>
        )
      case 'upcoming_loan_payment':
      case 'overdue_loan_payment':
      case 'loan_due_soon':
        return (
          <div className="space-y-3">
            <NumberField label="Preavviso" value={Number(c.advanceDays ?? 7)} min={0} max={90} onChange={(v) => update('advanceDays', v)} disabled={!pref.isEnabled || busy} unit="giorni" />
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-700">Avvisi scaduto</span>
              <Switch checked={Boolean(c.overdueEnabled ?? true)} onCheckedChange={(v) => update('overdueEnabled', v)} disabled={!pref.isEnabled || busy} aria-label="Avvisi scaduto" />
            </div>
          </div>
        )
      case 'goal_behind_schedule':
        return (
          <div className="space-y-3">
            <NumberField label="Tolleranza ritardo" value={Number(c.tolerancePercentagePoints ?? 10)} min={0} max={50} onChange={(v) => update('tolerancePercentagePoints', v)} disabled={!pref.isEnabled || busy} unit="pp" />
            <NumberField label="Giorni rimanenti critici" value={Number(c.criticalDaysRemaining ?? 30)} min={0} max={90} onChange={(v) => update('criticalDaysRemaining', v)} disabled={!pref.isEnabled || busy} unit="giorni" />
            <NumberField label="Gap critico" value={Number(c.criticalGapPercentagePoints ?? 30)} min={0} max={100} onChange={(v) => update('criticalGapPercentagePoints', v)} disabled={!pref.isEnabled || busy} unit="pp" />
          </div>
        )
      case 'automation_failure':
      case 'automation_conflict':
        return (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-slate-700">Includi conflitti</span>
            <Switch checked={Boolean(c.includeConflicts ?? true)} onCheckedChange={(v) => update('includeConflicts', v)} disabled={!pref.isEnabled || busy} aria-label="Includi conflitti" />
          </div>
        )
      case 'possible_duplicate':
        return (
          <div className="space-y-3">
            <NumberField label="Tolleranza data" value={Number(c.dateToleranceDays ?? 0)} min={0} max={7} onChange={(v) => update('dateToleranceDays', v)} disabled={!pref.isEnabled || busy} unit="giorni" />
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-700">Richiedere corrispondenza descrizione</span>
              <Switch checked={Boolean(c.descriptionMatchRequired ?? false)} onCheckedChange={(v) => update('descriptionMatchRequired', v)} disabled={!pref.isEnabled || busy} aria-label="Corrispondenza descrizione" />
            </div>
          </div>
        )
      default:
        return null
    }
  })()

  return (
    <div className={cn('rounded-2xl border', pref.isEnabled ? 'border-[#e5e7f0]' : 'border-dashed border-slate-200')}>
      <div className="flex items-center gap-3 px-4 py-3">
        <Switch
          checked={pref.isEnabled}
          onCheckedChange={async (v) => {
            onChange(pref.type, c)
            await fetch(`/api/notification-preferences/${pref.type}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_enabled: v }),
            })
            onChange(pref.type, c)
            toast.success(v ? 'Tipo abilitato' : 'Tipo disabilitato')
          }}
          disabled={busy}
          aria-label={`Abilita ${TYPE_LABELS[pref.type]}`}
        />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', pref.isEnabled ? 'text-slate-900' : 'text-slate-400')}>
            {TYPE_LABELS[pref.type]}
          </p>
        </div>
        {configFields && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label={expanded ? 'Comprimi' : 'Espandi configurazione'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {expanded && configFields && (
        <div className="border-t border-[#e5e7f0] px-4 py-4">
          {configFields}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => onSave(pref.type)}
              disabled={busy || !pref.isEnabled}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Salva configurazione
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const [settings, setSettings]   = useState<ResolvedUserSettings | null>(null)
  const [prefs, setPrefs]         = useState<TypePreferenceData[]>([])
  const [mutes, setMutes]         = useState<SourceMuteData[]>([])
  const [loading, setLoading]     = useState(true)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [prefBusy, setPrefBusy]   = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, pRes, mRes] = await Promise.all([
        fetch('/api/notification-settings'),
        fetch('/api/notification-preferences'),
        fetch('/api/notification-mutes?limit=50'),
      ])
      const [sBody, pBody, mBody] = await Promise.all([sRes.json(), pRes.json(), mRes.json()])

      if (sRes.ok) setSettings(sBody.data)
      if (pRes.ok && pBody.data) {
        const items: TypePreferenceData[] = ALL_TYPES.map((type) => {
          const found = pBody.data.find((p: { type: NotificationType }) => p.type === type)
          return {
            type,
            label: TYPE_LABELS[type],
            isEnabled: found?.isEnabled ?? true,
            config: found?.config ?? {},
          }
        })
        setPrefs(items)
      }
      if (mRes.ok && mBody.data) setMutes(mBody.data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function saveSettings() {
    if (!settings) return
    setSettingsBusy(true)
    try {
      const res = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifications_enabled: settings.notificationsEnabled,
          show_info:             settings.showInfo,
          show_warning:          settings.showWarning,
          show_critical:         settings.showCritical,
          quiet_hours_enabled:   settings.quietHoursEnabled,
          quiet_hours_start:     settings.quietHoursStart,
          quiet_hours_end:       settings.quietHoursEnd,
          timezone:              settings.timezone,
          digest_enabled:        settings.digestEnabled,
          digest_frequency:      settings.digestFrequency,
          digest_time:           settings.digestTime,
        }),
      })
      if (res.ok) {
        toast.success('Impostazioni salvate')
      } else {
        toast.error('Errore durante il salvataggio')
      }
    } finally {
      setSettingsBusy(false)
    }
  }

  function updateSetting<K extends keyof ResolvedUserSettings>(key: K, value: ResolvedUserSettings[K]) {
    setSettings((s) => s ? { ...s, [key]: value } : s)
  }

  function updatePrefConfig(type: NotificationType, config: Record<string, unknown>) {
    setPrefs((ps) => ps.map((p) => p.type === type ? { ...p, config } : p))
  }

  async function savePrefConfig(type: NotificationType) {
    const pref = prefs.find((p) => p.type === type)
    if (!pref) return
    setPrefBusy(true)
    try {
      const res = await fetch(`/api/notification-preferences/${type}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: pref.config }),
      })
      if (res.ok) {
        toast.success('Configurazione salvata')
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string }
        toast.error(body.error === 'INVALID_CONFIG' ? 'Configurazione non valida' : 'Errore durante il salvataggio')
      }
    } finally {
      setPrefBusy(false)
    }
  }

  async function deleteMute(id: string) {
    await fetch(`/api/notification-mutes/${id}`, { method: 'DELETE' })
    setMutes((ms) => ms.filter((m) => m.id !== id))
    toast.success('Fonte rimossa dal silenzio')
  }

  async function resetAll() {
    setResetBusy(true)
    try {
      await fetch('/api/notification-preferences/reset', { method: 'POST' })
      toast.success('Preferenze ripristinate')
      setResetConfirm(false)
      await loadAll()
    } finally {
      setResetBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <Bell className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link href="/settings" className="text-sm text-slate-500 hover:text-slate-700">Impostazioni</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-900">Avvisi</span>
          </div>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-900">Impostazioni avvisi</h1>
        </div>
        <Link
          href="/notifications"
          className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7f0] bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Bell className="h-4 w-4" />
          Centro avvisi
        </Link>
      </header>

      {/* 1. Impostazioni globali */}
      {settings && (
        <SectionCard title="Impostazioni globali" description="Attiva o disattiva gli avvisi e filtra per severità." icon={Bell}>
          <div className="divide-y divide-[#e5e7f0]">
            <ToggleRow
              label="Avvisi attivi"
              description="Disattiva per nascondere tutti gli avvisi"
              checked={settings.notificationsEnabled}
              onCheckedChange={(v) => updateSetting('notificationsEnabled', v)}
            />
            <ToggleRow
              label="Mostra avvisi informativi"
              checked={settings.showInfo}
              onCheckedChange={(v) => updateSetting('showInfo', v)}
              disabled={!settings.notificationsEnabled}
            />
            <ToggleRow
              label="Mostra avvisi di attenzione"
              checked={settings.showWarning}
              onCheckedChange={(v) => updateSetting('showWarning', v)}
              disabled={!settings.notificationsEnabled}
            />
            <ToggleRow
              label="Mostra avvisi critici"
              checked={settings.showCritical}
              onCheckedChange={(v) => updateSetting('showCritical', v)}
              disabled={!settings.notificationsEnabled}
            />
          </div>
          <div className="mt-5">
            <Button onClick={saveSettings} disabled={settingsBusy} className="gap-2">
              <Save className="h-4 w-4" />
              {settingsBusy ? 'Salvataggio...' : 'Salva impostazioni'}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* 2. Ore silenziose */}
      {settings && (
        <SectionCard title="Ore silenziose" description="In questo intervallo vengono mostrati solo gli avvisi critici." icon={BellOff}>
          <div className="space-y-4">
            <ToggleRow
              label="Attiva ore silenziose"
              checked={settings.quietHoursEnabled}
              onCheckedChange={(v) => updateSetting('quietHoursEnabled', v)}
            />
            {settings.quietHoursEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-700">Inizio (HH:MM)</Label>
                  <input
                    type="time"
                    value={settings.quietHoursStart ?? '22:00'}
                    onChange={(e) => updateSetting('quietHoursStart', e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-700">Fine (HH:MM)</Label>
                  <input
                    type="time"
                    value={settings.quietHoursEnd ?? '07:00'}
                    onChange={(e) => updateSetting('quietHoursEnd', e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
            {settings.quietHoursEnabled && (
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-700">Fuso orario</Label>
                <input
                  type="text"
                  value={settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
                  onChange={(e) => updateSetting('timezone', e.target.value)}
                  placeholder="Europe/Rome"
                  className="h-10 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400">Es. Europe/Rome, America/New_York</p>
              </div>
            )}
          </div>
          <div className="mt-5">
            <Button onClick={saveSettings} disabled={settingsBusy} className="gap-2">
              <Save className="h-4 w-4" />
              {settingsBusy ? 'Salvataggio...' : 'Salva ore silenziose'}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* 3. Digest */}
      {settings && (
        <SectionCard title="Digest avvisi" description="Riepilogo periodico degli avvisi attivi." icon={AlarmClock}>
          <div className="space-y-4">
            <ToggleRow
              label="Attiva digest"
              description="Visualizza il digest nella sezione avvisi"
              checked={settings.digestEnabled}
              onCheckedChange={(v) => updateSetting('digestEnabled', v)}
            />
            {settings.digestEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-700">Frequenza</Label>
                  <select
                    value={settings.digestFrequency ?? 'DAILY'}
                    onChange={(e) => updateSetting('digestFrequency', e.target.value as 'DAILY' | 'WEEKLY')}
                    className="h-10 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="DAILY">Giornaliero</option>
                    <option value="WEEKLY">Settimanale</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-700">Orario (HH:MM)</Label>
                  <input
                    type="time"
                    value={settings.digestTime ?? '09:00'}
                    onChange={(e) => updateSetting('digestTime', e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
            {settings.digestEnabled && (
              <Link
                href="/api/notifications/digest"
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
              >
                Visualizza digest corrente
              </Link>
            )}
          </div>
          <div className="mt-5">
            <Button onClick={saveSettings} disabled={settingsBusy} className="gap-2">
              <Save className="h-4 w-4" />
              {settingsBusy ? 'Salvataggio...' : 'Salva digest'}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* 4. Configurazione per tipo */}
      <SectionCard title="Configurazione per tipo" description="Abilita o disabilita ogni tipo di avviso e personalizza le soglie." icon={Settings}>
        <div className="space-y-2">
          {prefs.map((pref) => (
            <TypeConfigPanel
              key={pref.type}
              pref={pref}
              onChange={updatePrefConfig}
              onSave={savePrefConfig}
              busy={prefBusy}
            />
          ))}
        </div>
      </SectionCard>

      {/* 5. Fonti silenziate */}
      <SectionCard title="Fonti silenziate" description="Fonti da cui non riceverai avvisi. Puoi rimuoverle per riabilitarle." icon={BellOff}>
        {mutes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e5e7f0] py-8 text-center">
            <BellOff className="mx-auto mb-2 h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-400">Nessuna fonte silenziata</p>
            <p className="mt-1 text-xs text-slate-400">Usa il pulsante "Silenzia" sugli avvisi per aggiungerne.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mutes.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-[#e5e7f0] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {SOURCE_TYPE_LABELS[m.source_type] ?? m.source_type}
                    {m.notification_type && (
                      <span className="ml-2 text-xs text-slate-500">· {TYPE_LABELS[m.notification_type] ?? m.notification_type}</span>
                    )}
                    {!m.notification_type && (
                      <span className="ml-2 text-xs text-slate-500">· Tutti i tipi</span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{m.source_id.slice(0, 8)}…</p>
                  {m.muted_until && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Fino al {new Date(m.muted_until).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteMute(m.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Rimuovi silenzio"
                  title="Rimuovi silenzio"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 6. Notifiche posticipate */}
      <SectionCard title="Avvisi posticipati" description="Avvisi che hai posticipato temporaneamente." icon={AlarmClock}>
        <Link
          href="/notifications?status=snoozed"
          className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7f0] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <AlarmClock className="h-4 w-4 text-amber-500" />
          Vedi avvisi posticipati
        </Link>
      </SectionCard>

      {/* 7. Ripristino preferenze */}
      <SectionCard title="Ripristino preferenze" description="Ripristina le preferenze di notifica ai valori predefiniti." icon={RotateCcw}>
        {!resetConfirm ? (
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setResetConfirm(true)}
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
            >
              <RotateCcw className="h-4 w-4" />
              Ripristina preferenze
            </Button>
            <p className="text-xs text-slate-500">Questa operazione reimposta le soglie e le configurazioni per tipo, ma non le impostazioni globali.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-900">
              Sei sicuro di voler ripristinare tutte le preferenze di notifica?
            </p>
            <p className="mt-1 text-xs text-red-700">
              Le impostazioni globali (ore silenziose, digest) verranno mantenute. Le soglie per tipo verranno ripristinate ai valori predefiniti.
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                variant="destructive"
                onClick={resetAll}
                disabled={resetBusy}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {resetBusy ? 'Ripristino...' : 'Conferma ripristino'}
              </Button>
              <Button variant="outline" onClick={() => setResetConfirm(false)}>
                Annulla
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
