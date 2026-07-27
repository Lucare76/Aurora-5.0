'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardPreferencesDialog } from '@/components/dashboard/dashboard-preferences-dialog'
import { DASHBOARD_WIDGET_COMPONENTS } from '@/components/dashboard/dashboard-widgets'
import { dashboardPeriodToMonth, orderedWidgetIds, periodLabel } from '@/lib/dashboard/helpers'
import { DEFAULT_DASHBOARD_PREFERENCES, normalizeDashboardPreferences } from '@/lib/dashboard/preferences'
import type { DashboardPeriodKey, DashboardPreferences, DataIntegrityDashboardSummary, FinancialHealthSnapshotSummary } from '@/lib/dashboard/types'
import type { FinancialHealthResult } from '@/lib/financial-health/types'

type DashboardState = {
  data: FinancialHealthResult | null
  history: FinancialHealthSnapshotSummary[]
  dataIntegrity: DataIntegrityDashboardSummary | null
  preferences: DashboardPreferences
}

const periodOptions: DashboardPeriodKey[] = ['current_month', 'previous_month']

function dateInItalian(value: string | Date) {
  return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function normalizePeriod(value: string | null): DashboardPeriodKey {
  return value === 'previous_month' ? 'previous_month' : 'current_month'
}

function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    </main>
  )
}

function DashboardPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [period, setPeriod] = useState<DashboardPeriodKey>(() => normalizePeriod(searchParams.get('period')))
  const [state, setState] = useState<DashboardState>({
    data: null,
    history: [],
    dataIntegrity: null,
    preferences: DEFAULT_DASHBOARD_PREFERENCES,
  })
  const [loading, setLoading] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(searchParams.get('settings') === 'open')

  const loadDashboard = useCallback(async (selectedPeriod: DashboardPeriodKey) => {
    setLoading(true)
    try {
      const month = dashboardPeriodToMonth(selectedPeriod)
      const [healthResponse, historyResponse, preferencesResponse, integrityResponse] = await Promise.all([
        fetch(`/api/financial-health?period=${month}`, { cache: 'no-store' }),
        fetch('/api/financial-health/history', { cache: 'no-store' }),
        fetch('/api/dashboard/preferences', { cache: 'no-store' }),
        fetch('/api/data-integrity?status=open&limit=3', { cache: 'no-store' }),
      ])

      if (!healthResponse.ok) throw new Error('FINANCIAL_HEALTH_UNAVAILABLE')
      const health = await healthResponse.json() as FinancialHealthResult
      const historyBody = historyResponse.ok ? await historyResponse.json() as { snapshots?: FinancialHealthSnapshotSummary[] } : { snapshots: [] }
      const preferencesBody = preferencesResponse.ok ? await preferencesResponse.json() as { preferences?: DashboardPreferences } : { preferences: DEFAULT_DASHBOARD_PREFERENCES }
      const integrityBody = integrityResponse.ok ? await integrityResponse.json() as {
        summary?: { critical: number; warning: number; statusLabel: string }
        latestScan?: { completed_at: string | null; started_at: string | null } | null
        issues?: Array<{ id?: string; title: string; severity: 'CRITICAL' | 'WARNING' | 'INFO'; category: string; sourcePath?: string }>
      } : null

      setState({
        data: health,
        history: historyBody.snapshots ?? [],
        dataIntegrity: integrityBody ? {
          latestScanAt: integrityBody.latestScan?.completed_at ?? integrityBody.latestScan?.started_at ?? null,
          critical: integrityBody.summary?.critical ?? 0,
          warning: integrityBody.summary?.warning ?? 0,
          statusLabel: integrityBody.summary?.statusLabel ?? 'Nessun dato',
          issues: integrityBody.issues ?? [],
        } : null,
        preferences: normalizeDashboardPreferences(preferencesBody.preferences),
      })
    } catch (error) {
      console.error('[dashboard]', error)
      toast.error('Dashboard non disponibile. Riprova tra qualche secondo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const next = normalizePeriod(searchParams.get('period'))
    setPeriod(next)
    setSettingsOpen(searchParams.get('settings') === 'open')
    void loadDashboard(next)
  }, [loadDashboard, searchParams])

  const visibleWidgets = useMemo(() => orderedWidgetIds(state.preferences.widgetOrder, state.preferences.visibleWidgets), [state.preferences])

  const changePeriod = (next: DashboardPeriodKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', next)
    router.replace(`/dashboard?${params.toString()}`)
  }

  const savePreferences = async () => {
    setSavingPreferences(true)
    try {
      const response = await fetch('/api/dashboard/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.preferences),
      })
      if (!response.ok) throw new Error('PREFERENCES_SAVE_FAILED')
      const body = await response.json() as { preferences: DashboardPreferences }
      setState((current) => ({ ...current, preferences: normalizeDashboardPreferences(body.preferences) }))
      setSettingsOpen(false)
      toast.success('Preferenze dashboard salvate.')
    } catch (error) {
      console.error('[dashboard:preferences]', error)
      toast.error('Impossibile salvare le preferenze.')
    } finally {
      setSavingPreferences(false)
    }
  }

  const resetPreferences = async () => {
    try {
      const response = await fetch('/api/dashboard/preferences/reset', { method: 'POST' })
      if (!response.ok) throw new Error('PREFERENCES_RESET_FAILED')
      const body = await response.json() as { preferences: DashboardPreferences }
      setState((current) => ({ ...current, preferences: normalizeDashboardPreferences(body.preferences) }))
      toast.success('Preferenze ripristinate.')
    } catch (error) {
      console.error('[dashboard:preferences-reset]', error)
      toast.error('Impossibile ripristinare le preferenze.')
    }
  }

  const saveSnapshot = async () => {
    setSavingSnapshot(true)
    try {
      const month = dashboardPeriodToMonth(period)
      const response = await fetch(`/api/financial-health/snapshot?period=${month}`, { method: 'POST' })
      if (!response.ok) throw new Error('SNAPSHOT_SAVE_FAILED')
      toast.success('Snapshot salvato.')
      void loadDashboard(period)
    } catch (error) {
      console.error('[dashboard:snapshot]', error)
      toast.error('Impossibile salvare lo snapshot.')
    } finally {
      setSavingSnapshot(false)
    }
  }

  if (loading && !state.data) {
    return <DashboardLoading />
  }

  if (!state.data) {
    return (
      <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Sparkles className="h-10 w-10 text-indigo-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Dashboard non disponibile</h1>
          <p className="mt-2 text-slate-500">Aurora non riesce a caricare il motore Financial Health in questo momento.</p>
          <Button className="mt-6" onClick={() => loadDashboard(period)}>Riprova</Button>
        </div>
      </main>
    )
  }

  const widgetProps = {
    data: state.data,
    history: state.history,
    dataIntegrity: state.dataIntegrity,
    compact: state.preferences.compactMode,
    onSaveSnapshot: saveSnapshot,
    savingSnapshot,
  }

  return (
    <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600">{greeting()}, {state.data.profile?.displayName || 'Utente Aurora'}!</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Panoramica finanziaria</h1>
              <p className="mt-2 text-sm text-slate-500">{dateInItalian(new Date())} - periodo: {state.data.period.label}</p>
              <p className="mt-1 text-xs text-slate-400">Ultimo calcolo: {dateInItalian(state.data.calculatedAt)} - {state.data.isProvisional ? 'dati provvisori' : 'dati consolidati'} - qualita {state.data.dataQuality.level}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={period}
                onChange={(event) => changePeriod(event.target.value as DashboardPeriodKey)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                aria-label="Seleziona periodo dashboard"
              >
                {periodOptions.map((option) => <option key={option} value={option}>{periodLabel(option)}</option>)}
              </select>
              <Button variant="outline" className="gap-2" onClick={() => loadDashboard(period)}>
                <RefreshCw className="h-4 w-4" />
                Aggiorna
              </Button>
              <DashboardPreferencesDialog
                open={settingsOpen}
                saving={savingPreferences}
                preferences={state.preferences}
                onOpenChange={setSettingsOpen}
                onChange={(preferences) => setState((current) => ({ ...current, preferences }))}
                onSave={savePreferences}
                onReset={resetPreferences}
              />
            </div>
          </div>
        </section>

        <div className={state.preferences.compactMode ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-5 lg:grid-cols-2'}>
          {visibleWidgets.map((id) => {
            const Component = DASHBOARD_WIDGET_COMPONENTS[id]
            return <div key={id}>{Component(widgetProps)}</div>
          })}
        </div>
      </div>
    </main>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPageContent />
    </Suspense>
  )
}
