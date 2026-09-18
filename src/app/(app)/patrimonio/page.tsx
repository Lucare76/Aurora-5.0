'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, Landmark, Link2, Pencil, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, Unlink, Upload, Wallet } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PersonalOverviewPayload } from '@/lib/dashboard/personal-overview'

type ExternalAsset = {
  id: string
  name: string
  provider: string | null
  asset_type: 'investment' | 'cash' | 'pension' | 'other'
  instrument: string | null
  invested_amount: number | string
  current_value: number | string
  currency: string
  source_type: 'MANUAL' | 'SCALABLE' | 'SCREENSHOT' | 'POSTE'
  include_in_net_worth: boolean
  notes: string | null
  observed_at: string
  linked_account_id?: string | null
  linked_account_name?: string | null
  linked_account_balance?: number | null
  net_worth_contribution?: number
  change_7d?: number | null
  change_30d?: number | null
  change_90d?: number | null
  history?: HistoryPoint[]
}

type HistoryPoint = {
  value: number
  observedAt: string
}

type HistoryPeriod = 7 | 30 | 90

type AssetPayload = {
  data: ExternalAsset[]
  summary: {
    externalValue: number
    investedAmount: number
    gainLoss: number
    netWorthAdjustment: number
    includedAssets: number
    historyBaseline7d: number | null
    historyBaseline30d: number | null
    historyBaseline90d: number | null
    history: HistoryPoint[]
  }
}

type ScalableStatus = {
  connected: boolean
  configured: boolean
  connection: {
    connected_at: string
    last_synced_at: string | null
    last_error: string | null
    scope: string | null
    expires_at: string | null
    metadata?: {
      portfolio_ids?: string[]
      available_tools?: string[]
      holdings_count?: number
      savings_plans_count?: number
      diagnostics?: Array<{
        portfolioId: string
        holdingsShape: unknown
        holdingsObjectCount: number
      }>
    } | null
  } | null
}

type PosteAccount = {
  id: string
  name: string
  type: string
  balance: number
  currency: string
}

type AssetForm = {
  name: string
  provider: string
  instrument: string
  investedAmount: string
  currentValue: string
  sourceType: 'MANUAL' | 'SCALABLE' | 'SCREENSHOT' | 'POSTE'
  includeInNetWorth: boolean
}

const emptyForm: AssetForm = {
  name: '',
  provider: '',
  instrument: '',
  investedAmount: '',
  currentValue: '',
  sourceType: 'MANUAL',
  includeInNetWorth: true,
}

const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

function formatMoney(value: number) {
  return money.format(Number.isFinite(value) ? value : 0)
}

function sourceLabel(source: ExternalAsset['source_type']) {
  if (source === 'SCALABLE') return 'Scalable'
  if (source === 'POSTE') return 'Poste'
  if (source === 'SCREENSHOT') return 'Screenshot'
  return 'Manuale'
}

function DeltaLine({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <span className="text-slate-400">{label}: storico in raccolta</span>
  const positive = value >= 0
  return (
    <span className={positive ? 'text-emerald-600' : 'text-red-600'}>
      {positive ? '+' : '−'}{formatMoney(Math.abs(value))} {label}
    </span>
  )
}

function periodHistory(history: HistoryPoint[] | undefined, days: HistoryPeriod, currentValue: number) {
  const cutoff = Date.now() - days * 86_400_000
  const now = Date.now()
  const validHistory = (history ?? [])
    .map((point) => ({ ...point, value: Number(point.value) }))
    .filter((point) => Number.isFinite(point.value) && new Date(point.observedAt).getTime() <= now)
    .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime())
  const baseline = validHistory.filter((point) => new Date(point.observedAt).getTime() <= cutoff).at(-1)
  const points = validHistory.filter((point) => new Date(point.observedAt).getTime() > cutoff)
  if (baseline) points.unshift(baseline)

  const last = points.at(-1)
  if (!last || new Date(last.observedAt).toDateString() !== new Date().toDateString()) {
    points.push({ value: currentValue, observedAt: new Date().toISOString() })
  } else {
    last.value = currentValue
  }
  return points
}

function historyStats(points: HistoryPoint[]) {
  if (points.length < 2) return null
  const first = points[0].value
  const last = points.at(-1)?.value ?? first
  const change = last - first
  return {
    change,
    percentage: first === 0 ? null : (change / first) * 100,
    minimum: Math.min(...points.map((point) => point.value)),
    maximum: Math.max(...points.map((point) => point.value)),
  }
}

function MiniHistoryChart({ points, id, height = 112 }: { points: HistoryPoint[]; id: string; height?: number }) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-slate-50 text-xs text-slate-400" style={{ height }}>
        Storico in raccolta
      </div>
    )
  }
  const rising = points.at(-1)!.value >= points[0].value
  const color = rising ? '#059669' : '#dc2626'
  return (
    <div style={{ height }} className="w-full" aria-label="Grafico storico valori">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.24} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            formatter={(value) => [formatMoney(Number(value)), 'Valore']}
            labelFormatter={(_, payload) => payload[0]?.payload?.observedAt
              ? new Date(payload[0].payload.observedAt).toLocaleDateString('it-IT')
              : ''}
            contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function PatrimonioPage() {
  const [overview, setOverview] = useState<PersonalOverviewPayload | null>(null)
  const [assetsPayload, setAssetsPayload] = useState<AssetPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ExternalAsset | null>(null)
  const [form, setForm] = useState<AssetForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [scalableStatus, setScalableStatus] = useState<ScalableStatus | null>(null)
  const [syncingScalable, setSyncingScalable] = useState(false)
  const [disconnectingScalable, setDisconnectingScalable] = useState(false)
  const [scalableSetupOpen, setScalableSetupOpen] = useState(false)
  const [scalableClientId, setScalableClientId] = useState('')
  const [scalableRefreshToken, setScalableRefreshToken] = useState('')
  const [configuringScalable, setConfiguringScalable] = useState(false)
  const [posteAccounts, setPosteAccounts] = useState<PosteAccount[]>([])
  const [posteFile, setPosteFile] = useState<File | null>(null)
  const [importingPoste, setImportingPoste] = useState(false)
  const [posteAccountId, setPosteAccountId] = useState('')
  const [posteProductName, setPosteProductName] = useState('')
  const [posteCurrentValue, setPosteCurrentValue] = useState('')
  const [savingPosteManual, setSavingPosteManual] = useState(false)
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, assetsRes, scalableRes] = await Promise.all([
        fetch('/api/dashboard/personal-overview', { cache: 'no-store' }),
        fetch('/api/patrimonio', { cache: 'no-store' }),
        fetch('/api/integrations/scalable', { cache: 'no-store' }).catch(() => null),
      ])
      if (!overviewRes.ok || !assetsRes.ok) throw new Error('LOAD_FAILED')
      setOverview(await overviewRes.json() as PersonalOverviewPayload)
      setAssetsPayload(await assetsRes.json() as AssetPayload)
      if (scalableRes?.ok) setScalableStatus(await scalableRes.json() as ScalableStatus)
      else setScalableStatus(null)
    } catch {
      toast.error('Impossibile caricare il patrimonio.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('scalable')
    if (!status) return
    if (status === 'connected') toast.success('Scalable collegato. Puoi sincronizzare il portafoglio.')
    else if (status === 'denied') toast.info('Collegamento Scalable annullato.')
    else if (status === 'missing-secret') toast.error('Configurazione server Scalable incompleta.')
    else toast.error('Collegamento Scalable non riuscito. Riprova.')
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    const loadPosteAccounts = async () => {
      try {
        const response = await fetch('/api/integrations/poste/manual', { cache: 'no-store' })
        if (!response.ok) return
        const body = await response.json() as { data?: PosteAccount[] }
        const accounts = body.data ?? []
        setPosteAccounts(accounts)
        if (!posteAccountId && accounts[0]) {
          setPosteAccountId(accounts[0].id)
          setPosteProductName(accounts[0].name)
        }
      } catch {
        // The Poste panel remains usable for Excel import even if account suggestions fail.
      }
    }
    void loadPosteAccounts()
  }, [posteAccountId])

  const syncScalable = async () => {
    setSyncingScalable(true)
    try {
      const response = await fetch('/api/integrations/scalable/sync', { method: 'POST' })
      const body = await response.json().catch(() => ({})) as {
        holdings?: number
        error?: string
        diagnostics?: Array<{ portfolioId: string; holdingsShape: unknown; holdingsObjectCount: number }>
      }
      if (!response.ok) {
        if (body.error === 'SCALABLE_RECONNECT_REQUIRED') {
          toast.error('Sessione Scalable scaduta. Ricollega il conto.')
        } else {
          toast.error('Sincronizzazione Scalable non riuscita.')
        }
        return
      }
      if ((body.holdings ?? 0) === 0) {
        toast.warning('Scalable ha risposto, ma Aurora non ha trovato posizioni da importare. Ho salvato una diagnostica tecnica sicura qui sotto.')
      } else {
        toast.success(`Scalable aggiornato: ${body.holdings ?? 0} posizioni sincronizzate.`)
      }
      await load()
    } finally {
      setSyncingScalable(false)
    }
  }

  const disconnectScalable = async () => {
    if (!window.confirm('Disconnettere Scalable da Aurora? Le posizioni già importate resteranno nel Patrimonio finché non le rimuovi.')) return
    setDisconnectingScalable(true)
    try {
      const response = await fetch('/api/integrations/scalable', { method: 'DELETE' })
      if (!response.ok) {
        toast.error('Disconnessione Scalable non riuscita.')
        return
      }
      toast.success('Scalable disconnesso da Aurora.')
      await load()
    } finally {
      setDisconnectingScalable(false)
    }
  }


  const configureScalable = async () => {
    if (!scalableClientId.trim() || !scalableRefreshToken.trim()) {
      toast.error('Inserisci Client ID e Refresh Token generati dallo script locale.')
      return
    }
    setConfiguringScalable(true)
    try {
      const response = await fetch('/api/integrations/scalable/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: scalableClientId.trim(),
          refreshToken: scalableRefreshToken.trim(),
        }),
      })
      if (!response.ok) {
        toast.error('Configurazione Scalable non riuscita. Rigenera le credenziali locali e riprova.')
        return
      }
      setScalableSetupOpen(false)
      setScalableClientId('')
      setScalableRefreshToken('')
      toast.success('Scalable collegato ad Aurora.')
      await load()
    } finally {
      setConfiguringScalable(false)
    }
  }

  const importPosteWorkbook = async () => {
    if (!posteFile) {
      toast.error('Seleziona prima il file Excel esportato da Poste.')
      return
    }
    setImportingPoste(true)
    try {
      const body = new FormData()
      body.set('file', posteFile)
      const response = await fetch('/api/integrations/poste/import', {
        method: 'POST',
        body,
      })
      const result = await response.json().catch(() => ({})) as {
        imported?: number
        error?: string
        missingAccounts?: string[]
      }
      if (!response.ok) {
        if (result.error === 'POSTE_ACCOUNT_MAPPING_MISSING') {
          toast.error(`Manca il conto Aurora: ${(result.missingAccounts ?? []).join(', ')}`)
        } else if (result.error === 'POSTE_NO_SUPPORTED_ROWS') {
          toast.error('Nel file non ho trovato Buono Ordinario o Buono 3x4 supportati.')
        } else {
          toast.error('Import Poste non riuscito. Controlla che sia il file Patrimonio Buoni.')
        }
        return
      }
      toast.success(`Poste aggiornato: ${result.imported ?? 0} prodotti importati.`)
      setPosteFile(null)
      await load()
    } finally {
      setImportingPoste(false)
    }
  }

  const savePosteManualValue = async () => {
    const currentValue = Number(posteCurrentValue.replace(/\./g, '').replace(',', '.'))
    if (!posteAccountId || !posteProductName.trim() || !Number.isFinite(currentValue) || currentValue < 0) {
      toast.error('Seleziona il conto e inserisci un valore Poste valido.')
      return
    }

    setSavingPosteManual(true)
    try {
      const response = await fetch('/api/integrations/poste/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: posteAccountId,
          productName: posteProductName.trim(),
          currentValue,
        }),
      })
      if (!response.ok) {
        toast.error('Aggiornamento Poste non riuscito.')
        return
      }
      toast.success('Valore Poste aggiornato e collegato al conto Aurora.')
      setPosteCurrentValue('')
      await load()
    } finally {
      setSavingPosteManual(false)
    }
  }

  const baseNetWorth = overview?.financial.netWorth ?? 0
  const externalValue = assetsPayload?.summary.externalValue ?? 0
  const investedAmount = assetsPayload?.summary.investedAmount ?? 0
  const netWorthAdjustment = assetsPayload?.summary.netWorthAdjustment ?? externalValue
  const consolidated = baseNetWorth + netWorthAdjustment
  const consolidatedChange7d = assetsPayload?.summary.historyBaseline7d == null
    ? null
    : consolidated - assetsPayload.summary.historyBaseline7d
  const consolidatedChange30d = assetsPayload?.summary.historyBaseline30d == null
    ? null
    : consolidated - assetsPayload.summary.historyBaseline30d
  const consolidatedHistory = useMemo(
    () => periodHistory(assetsPayload?.summary.history, historyPeriod, consolidated),
    [assetsPayload?.summary.history, consolidated, historyPeriod],
  )
  const consolidatedStats = useMemo(() => historyStats(consolidatedHistory), [consolidatedHistory])

  const includedAssets = useMemo(
    () => (assetsPayload?.data ?? []).filter((asset) => asset.include_in_net_worth),
    [assetsPayload],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setEditorOpen(true)
  }

  const openEdit = (asset: ExternalAsset) => {
    setEditing(asset)
    setForm({
      name: asset.name,
      provider: asset.provider ?? '',
      instrument: asset.instrument ?? '',
      investedAmount: String(Number(asset.invested_amount)),
      currentValue: String(Number(asset.current_value)),
      sourceType: asset.source_type,
      includeInNetWorth: asset.include_in_net_worth,
    })
    setEditorOpen(true)
  }

  const save = async () => {
    const investedAmountValue = Number(form.investedAmount.replace(',', '.'))
    const currentValueValue = Number(form.currentValue.replace(',', '.'))
    if (!form.name.trim() || !Number.isFinite(currentValueValue) || currentValueValue < 0 || !Number.isFinite(investedAmountValue) || investedAmountValue < 0) {
      toast.error('Controlla nome, capitale versato e valore attuale.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/patrimonio/${editing.id}` : '/api/patrimonio', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          provider: form.provider.trim() || null,
          instrument: form.instrument.trim() || null,
          investedAmount: investedAmountValue,
          currentValue: currentValueValue,
          sourceType: form.sourceType,
          includeInNetWorth: form.includeInNetWorth,
          ...(editing ? { observedAt: new Date().toISOString() } : {}),
        }),
      })
      if (!response.ok) throw new Error('SAVE_FAILED')
      toast.success(editing ? 'Investimento aggiornato.' : 'Investimento aggiunto al patrimonio.')
      setEditorOpen(false)
      await load()
    } catch {
      toast.error('Salvataggio non riuscito.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (asset: ExternalAsset) => {
    if (!window.confirm(`Rimuovere “${asset.name}” dal patrimonio esterno?`)) return
    const response = await fetch(`/api/patrimonio/${asset.id}`, { method: 'DELETE' })
    if (!response.ok) {
      toast.error('Eliminazione non riuscita.')
      return
    }
    toast.success('Voce rimossa.')
    await load()
  }

  if (loading && !overview && !assetsPayload) {
    return <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white" />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Patrimonio consolidato</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Patrimonio</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Consolida i valori di mercato con i Conti Aurora già esistenti, aggiungendo solo la differenza per evitare doppi conteggi.
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 w-full gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          Aggiungi investimento
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Patrimonio finanziario totale</p>
            <p className="mt-2 break-words text-2xl font-bold tabular-nums text-slate-950 min-[360px]:text-3xl">{formatMoney(consolidated)}</p>
            <div className="mt-2 flex flex-col gap-1 text-xs font-medium">
              <DeltaLine value={consolidatedChange7d} label="rispetto a 7 giorni fa" />
              <DeltaLine value={consolidatedChange30d} label="rispetto a 30 giorni fa" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Patrimonio già in Aurora</p>
            <p className="mt-2 break-words text-xl font-bold tabular-nums text-slate-950 min-[360px]:text-2xl">{formatMoney(baseNetWorth)}</p>
            <p className="mt-2 text-xs text-slate-400">Lo stesso valore della Dashboard personale.</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Investimenti esterni</p>
            <p className="mt-2 break-words text-xl font-bold tabular-nums text-indigo-600 min-[360px]:text-2xl">{formatMoney(externalValue)}</p>
            <p className="mt-2 text-xs text-slate-400">{includedAssets.length} posizioni monitorate; i conti collegati non vengono sommati due volte.</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Adeguamento ai valori attuali</p>
            <p className={`mt-2 break-words text-xl font-bold tabular-nums min-[360px]:text-2xl ${netWorthAdjustment >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {netWorthAdjustment >= 0 ? '+' : '−'}{formatMoney(Math.abs(netWorthAdjustment))}
            </p>
            <p className="mt-2 text-xs text-slate-400">Solo la differenza rispetto ai Conti Aurora collegati.</p>
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden border-indigo-200 bg-white shadow-sm">
        <CardContent className="p-4 min-[360px]:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-950">Andamento del patrimonio</p>
              <p className="mt-1 text-xs text-slate-500">Valori consolidati registrati da Aurora.</p>
            </div>
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1" aria-label="Periodo storico">
              {([7, 30, 90] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setHistoryPeriod(period)}
                  className={`min-h-9 rounded-lg px-3 text-xs font-bold transition ${historyPeriod === period ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                >
                  {period}G
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <MiniHistoryChart points={consolidatedHistory} id="patrimonio-history" height={160} />
          </div>
          {consolidatedStats ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Variazione</p>
                <p className={`mt-1 font-bold tabular-nums ${consolidatedStats.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {consolidatedStats.change >= 0 ? '+' : '−'}{formatMoney(Math.abs(consolidatedStats.change))}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Percentuale</p>
                <p className={`mt-1 font-bold tabular-nums ${consolidatedStats.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {consolidatedStats.percentage == null ? 'n/d' : `${consolidatedStats.percentage >= 0 ? '+' : ''}${consolidatedStats.percentage.toFixed(2)}%`}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Minimo</p><p className="mt-1 font-bold tabular-nums text-slate-950">{formatMoney(consolidatedStats.minimum)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Massimo</p><p className="mt-1 font-bold tabular-nums text-slate-950">{formatMoney(consolidatedStats.maximum)}</p></div>
            </div>
          ) : <p className="mt-3 text-center text-xs text-slate-400">Servono almeno due rilevazioni per calcolare variazione, minimo e massimo.</p>}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Regola anti-doppio conteggio</p>
            <p className="mt-1 text-sm text-amber-800">
              iShares Core MSCI World è collegato a “Aurora Piano di Accumulo”; Vanguard FTSE All-World è collegato a “Scalable”. Nel totale entra solo la differenza tra valore di mercato e saldo del conto collegato.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-indigo-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-950">Scalable Capital · sincronizzazione automatica</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${scalableStatus?.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {scalableStatus?.connected ? 'Collegato' : 'Non collegato'}
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">
                  Aurora sincronizza Scalable direttamente in sola lettura. Per il primo collegamento serve una breve autorizzazione locale, perché Scalable non accetta callback web generiche per questa integrazione.
                </p>
                {scalableStatus?.connection?.last_synced_at && (
                  <p className="mt-2 text-xs text-slate-400">Ultima sincronizzazione: {new Date(scalableStatus.connection.last_synced_at).toLocaleString('it-IT')}</p>
                )}
                {scalableStatus?.connection?.last_error && (
                  <p className="mt-2 text-xs font-medium text-red-600">Ultimo errore: {scalableStatus.connection.last_error}</p>
                )}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 min-[420px]:w-auto min-[420px]:flex-row min-[420px]:flex-wrap">
              {!scalableStatus?.connected ? (
                <Button
                  type="button"
                  className="w-full gap-2 min-[420px]:w-auto"
                  onClick={() => setScalableSetupOpen(true)}
                  disabled={scalableStatus?.configured === false}
                >
                  <Link2 className="h-4 w-4" />
                  Configura Scalable
                </Button>
              ) : (
                <>
                  <Button type="button" className="w-full gap-2 min-[420px]:w-auto" onClick={syncScalable} disabled={syncingScalable}>
                    <RefreshCw className={syncingScalable ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    {syncingScalable ? 'Sincronizzo…' : 'Sincronizza ora'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full gap-2 min-[420px]:w-auto" onClick={disconnectScalable} disabled={disconnectingScalable}>
                    <Unlink className="h-4 w-4" />
                    Disconnetti
                  </Button>
                </>
              )}
            </div>
          </div>
          {scalableStatus?.configured === false && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Manca la chiave server <code>SCALABLE_TOKEN_ENCRYPTION_KEY</code>: il collegamento resta disabilitato finché non viene configurata su Vercel.
            </p>
          )}

          {scalableStatus?.connection?.last_error === 'NO_HOLDINGS_PARSED' && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-amber-900">Diagnostica Scalable</p>
              <p className="mt-1 text-sm text-amber-800">
                Nessun valore sensibile viene mostrato: qui vedi solo nomi dei campi, tipi e conteggi restituiti da Scalable.
              </p>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-[11px] leading-5 text-slate-700 ring-1 ring-amber-100">
                {JSON.stringify({
                  portfolioIds: scalableStatus.connection.metadata?.portfolio_ids ?? [],
                  availableTools: scalableStatus.connection.metadata?.available_tools ?? [],
                  holdingsCount: scalableStatus.connection.metadata?.holdings_count ?? 0,
                  savingsPlansCount: scalableStatus.connection.metadata?.savings_plans_count ?? 0,
                  diagnostics: scalableStatus.connection.metadata?.diagnostics ?? [],
                }, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-950">Poste Italiane · aggiornamento patrimonio</p>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Per i Buoni usa il file Excel “Patrimonio Buoni”. Per polizze, previdenza o schermate senza export usa l’aggiornamento manuale: Aurora collega il valore al conto esistente e aggiunge al patrimonio solo la differenza.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Importa Buoni da Excel</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Supportati: Buono Ordinario e Buono 3x4. Aurora usa il “Valore rimborso netto” e lo collega automaticamente al conto omonimo.
              </p>
              <input
                className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => setPosteFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                className="mt-3 w-full gap-2 min-[420px]:w-auto"
                onClick={importPosteWorkbook}
                disabled={!posteFile || importingPoste}
              >
                <Upload className={importingPoste ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
                {importingPoste ? 'Importo…' : 'Importa file Poste'}
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Aggiorna da schermata o documento</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Per prodotti senza Excel inserisci solo il valore attuale. Non vengono modificati né saldo del conto né transazioni.
              </p>
              <div className="mt-3 grid gap-3">
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
                  value={posteAccountId}
                  onChange={(event) => {
                    const id = event.target.value
                    const account = posteAccounts.find((item) => item.id === id)
                    setPosteAccountId(id)
                    if (account) setPosteProductName(account.name)
                  }}
                >
                  {posteAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {formatMoney(account.balance)}
                    </option>
                  ))}
                </select>
                <Input
                  value={posteProductName}
                  onChange={(event) => setPosteProductName(event.target.value)}
                  placeholder="Nome prodotto Poste"
                />
                <Input
                  value={posteCurrentValue}
                  onChange={(event) => setPosteCurrentValue(event.target.value)}
                  inputMode="decimal"
                  placeholder="Valore attuale, es. 38458,44"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={savePosteManualValue}
                  disabled={!posteAccountId || savingPosteManual}
                >
                  {savingPosteManual ? 'Salvo…' : 'Aggiorna valore Poste'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Investimenti e attività esterne</h2>
            <p className="mt-1 text-sm text-slate-500">Valore attuale, conto Aurora collegato e storico a 7/30/90 giorni.</p>
          </div>
          <p className="text-sm font-semibold text-slate-500">Versato totale: {formatMoney(investedAmount)}</p>
        </div>

        {(assetsPayload?.data ?? []).length === 0 ? (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-10 text-center">
              <Landmark className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 font-bold text-slate-950">Nessun investimento esterno</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                Aggiungi Scalable, Moneyfarm, Poste o qualsiasi altra posizione che oggi non entra nel patrimonio mostrato da Aurora.
              </p>
              <Button onClick={openCreate} className="mt-5 gap-2"><Plus className="h-4 w-4" />Aggiungi la prima voce</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(assetsPayload?.data ?? []).map((asset) => {
              const invested = Number(asset.invested_amount)
              const current = Number(asset.current_value)
              const linkedBalance = asset.linked_account_balance == null ? null : Number(asset.linked_account_balance)
              const diff = linkedBalance == null ? current - invested : current - linkedBalance
              const pct = linkedBalance == null && invested > 0 ? (diff / invested) * 100 : null
              const assetHistory = periodHistory(asset.history, historyPeriod, current)
              const assetStats = historyStats(assetHistory)
              return (
                <Card key={asset.id} className={`border-slate-200 bg-white shadow-sm ${asset.include_in_net_worth ? '' : 'opacity-60'}`}>
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg text-slate-950">{asset.name}</CardTitle>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {[asset.provider, asset.instrument].filter(Boolean).join(' · ') || 'Investimento esterno'}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{sourceLabel(asset.source_type)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    <div className="grid grid-cols-1 gap-2 rounded-2xl bg-slate-50 p-3 min-[390px]:grid-cols-3">
                      <div>
                        <p className="text-[11px] text-slate-500">{linkedBalance == null ? 'Versato' : 'Conto Aurora'}</p>
                        <p className="mt-1 break-words font-bold tabular-nums text-slate-950">{formatMoney(linkedBalance ?? invested)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Valore attuale</p>
                        <p className="mt-1 break-words font-bold tabular-nums text-indigo-600">{formatMoney(current)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">{linkedBalance == null ? 'Differenza' : 'Adeguamento'}</p>
                        <p className={`mt-1 flex items-center gap-1 font-bold tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {diff >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {diff >= 0 ? '+' : '−'}{formatMoney(Math.abs(diff))}
                        </p>
                      </div>
                    </div>
                    {asset.linked_account_name && (
                      <p className="mt-3 text-xs font-semibold text-indigo-700">Collegato al conto Aurora: {asset.linked_account_name}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                      <DeltaLine value={asset.change_7d ?? null} label="vs 7 giorni fa" />
                      <DeltaLine value={asset.change_30d ?? null} label="vs 30 giorni fa" />
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-700">Storico {historyPeriod} giorni</p>
                        {assetStats?.percentage != null && (
                          <p className={`text-xs font-bold tabular-nums ${assetStats.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {assetStats.percentage >= 0 ? '+' : ''}{assetStats.percentage.toFixed(2)}%
                          </p>
                        )}
                      </div>
                      <MiniHistoryChart points={assetHistory} id={`asset-history-${asset.id}`} height={82} />
                      {assetStats && (
                        <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span>Min {formatMoney(assetStats.minimum)}</span>
                          <span>Max {formatMoney(assetStats.maximum)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{linkedBalance != null ? 'Confronto con saldo conto Aurora' : pct == null ? 'Rendimento n/d' : `Rendimento ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}</span>
                      <span>Aggiornato {new Date(asset.observed_at).toLocaleDateString('it-IT')}</span>
                    </div>
                    {!asset.include_in_net_worth && <p className="mt-2 text-xs font-semibold text-amber-700">Escluso dal patrimonio totale per evitare doppio conteggio.</p>}
                    <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 min-[360px]:flex-row">
                      <Button variant="outline" size="sm" className="w-full gap-2 min-[360px]:w-auto" onClick={() => openEdit(asset)}><Pencil className="h-3.5 w-3.5" />Aggiorna</Button>
                      <Button variant="ghost" size="sm" className="w-full gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 min-[360px]:w-auto" onClick={() => remove(asset)}><Trash2 className="h-3.5 w-3.5" />Rimuovi</Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="grid min-w-0 gap-4 p-4 min-[360px]:p-5 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-5 w-5 text-indigo-600" />
            <div><p className="font-semibold text-slate-950">Conti registrati nell’app</p><p className="mt-1 text-sm text-slate-500">Entrano automaticamente dal patrimonio personale già calcolato.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <BarChart3 className="mt-0.5 h-5 w-5 text-indigo-600" />
            <div><p className="font-semibold text-slate-950">Scalable</p><p className="mt-1 text-sm text-slate-500">Collegamento MCP diretto in sola lettura: posizioni e valori vengono sincronizzati da Aurora.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-5 w-5 text-indigo-600" />
            <div><p className="font-semibold text-slate-950">Poste / Moneyfarm</p><p className="mt-1 text-sm text-slate-500">Aggiornamento manuale o da screenshot, senza costi di Open Banking.</p></div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={scalableSetupOpen} onOpenChange={setScalableSetupOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Collega Scalable ad Aurora</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900">
              <p className="font-semibold">1. Genera le credenziali sul tuo PC</p>
              <p className="mt-1 text-indigo-800">Apri PowerShell nella cartella Aurora e lancia:</p>
              <code className="mt-2 block rounded-xl bg-white px-3 py-2 text-xs text-slate-800">node scripts/scalable-bootstrap.mjs</code>
              <p className="mt-2 text-indigo-800">Si aprirà Scalable nel browser per login, 2FA e autorizzazione. Alla fine il terminale mostrerà Client ID e Refresh Token.</p>
            </div>
            <div>
              <Label>Client ID</Label>
              <Input className="mt-1.5" value={scalableClientId} onChange={(e) => setScalableClientId(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <Label>Refresh Token</Label>
              <Input className="mt-1.5" type="password" value={scalableRefreshToken} onChange={(e) => setScalableRefreshToken(e.target.value)} autoComplete="off" />
              <p className="mt-1 text-xs text-slate-500">Non inviarlo in chat. Aurora lo cifra prima di salvarlo.</p>
            </div>
            <Button className="h-11 w-full" onClick={configureScalable} disabled={configuringScalable}>
              {configuringScalable ? 'Verifico e collego…' : 'Salva e collega Scalable'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Aggiorna investimento' : 'Aggiungi investimento'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Nome</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Es. Aurora Piano di Accumulo" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Provider</Label><Input className="mt-1.5" value={form.provider} onChange={(e) => setForm((v) => ({ ...v, provider: e.target.value }))} placeholder="Scalable, Moneyfarm, Poste..." /></div>
              <div><Label>Strumento</Label><Input className="mt-1.5" value={form.instrument} onChange={(e) => setForm((v) => ({ ...v, instrument: e.target.value }))} placeholder="iShares Core MSCI World" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Capitale versato</Label><Input className="mt-1.5" inputMode="decimal" value={form.investedAmount} onChange={(e) => setForm((v) => ({ ...v, investedAmount: e.target.value }))} placeholder="4564" /></div>
              <div><Label>Valore attuale</Label><Input className="mt-1.5" inputMode="decimal" value={form.currentValue} onChange={(e) => setForm((v) => ({ ...v, currentValue: e.target.value }))} placeholder="5300" /></div>
            </div>
            <div>
              <Label>Fonte aggiornamento</Label>
              <select className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={form.sourceType} onChange={(e) => setForm((v) => ({ ...v, sourceType: e.target.value as AssetForm['sourceType'] }))}>
                <option value="MANUAL">Manuale</option>
                <option value="SCREENSHOT">Screenshot</option>
                <option value="SCALABLE">Scalable read-only</option>
              </select>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={form.includeInNetWorth} onChange={(e) => setForm((v) => ({ ...v, includeInNetWorth: e.target.checked }))} />
              <span><strong className="text-slate-900">Includi nel patrimonio totale</strong><span className="mt-1 block text-slate-500">Disattivalo se questo valore è già rappresentato da un Conto Aurora.</span></span>
            </label>
            <Button onClick={save} disabled={saving} className="h-11">{saving ? 'Salvataggio…' : editing ? 'Salva aggiornamento' : 'Aggiungi al patrimonio'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
