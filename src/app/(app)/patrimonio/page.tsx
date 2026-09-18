'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, Landmark, Link2, Pencil, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, Unlink, Wallet } from 'lucide-react'
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
  source_type: 'MANUAL' | 'SCALABLE' | 'SCREENSHOT'
  include_in_net_worth: boolean
  notes: string | null
  observed_at: string
}

type AssetPayload = {
  data: ExternalAsset[]
  summary: {
    externalValue: number
    investedAmount: number
    gainLoss: number
    includedAssets: number
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
  } | null
}

type AssetForm = {
  name: string
  provider: string
  instrument: string
  investedAmount: string
  currentValue: string
  sourceType: 'MANUAL' | 'SCALABLE' | 'SCREENSHOT'
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
  if (source === 'SCREENSHOT') return 'Screenshot'
  return 'Manuale'
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

  const syncScalable = async () => {
    setSyncingScalable(true)
    try {
      const response = await fetch('/api/integrations/scalable/sync', { method: 'POST' })
      const body = await response.json().catch(() => ({})) as { holdings?: number; error?: string }
      if (!response.ok) {
        if (body.error === 'SCALABLE_RECONNECT_REQUIRED') {
          toast.error('Sessione Scalable scaduta. Ricollega il conto.')
        } else {
          toast.error('Sincronizzazione Scalable non riuscita.')
        }
        return
      }
      toast.success(`Scalable aggiornato: ${body.holdings ?? 0} posizioni sincronizzate.`)
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

  const baseNetWorth = overview?.financial.netWorth ?? 0
  const externalValue = assetsPayload?.summary.externalValue ?? 0
  const investedAmount = assetsPayload?.summary.investedAmount ?? 0
  const gainLoss = assetsPayload?.summary.gainLoss ?? 0
  const consolidated = baseNetWorth + externalValue

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
            Somma il patrimonio già registrato in Aurora agli investimenti esterni che non sono già presenti nei Conti.
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 gap-2">
          <Plus className="h-4 w-4" />
          Aggiungi investimento
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Patrimonio finanziario totale</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-950">{formatMoney(consolidated)}</p>
            <p className="mt-2 text-xs text-slate-500">Aurora + investimenti esterni inclusi.</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Patrimonio già in Aurora</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{formatMoney(baseNetWorth)}</p>
            <p className="mt-2 text-xs text-slate-400">Lo stesso valore della Dashboard personale.</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Investimenti esterni</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-indigo-600">{formatMoney(externalValue)}</p>
            <p className="mt-2 text-xs text-slate-400">{includedAssets.length} voci incluse nel totale.</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Risultato investimenti</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {gainLoss >= 0 ? '+' : '−'}{formatMoney(Math.abs(gainLoss))}
            </p>
            <p className="mt-2 text-xs text-slate-400">Valore attuale − capitale versato.</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Regola anti-doppio conteggio</p>
            <p className="mt-1 text-sm text-amber-800">
              Inserisci qui solo valori che non sono già compresi nei Conti di Aurora. Se un investimento è già un conto Aurora, disattiva “Includi nel patrimonio”.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-indigo-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-950">Scalable Capital · sincronizzazione automatica</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${scalableStatus?.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {scalableStatus?.connected ? 'Collegato' : 'Non collegato'}
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">
                  Aurora usa il collegamento MCP Scalable direttamente in sola lettura per importare posizioni e valori correnti. Non usa la sessione Scalable di ChatGPT e non può inviare ordini da questa integrazione.
                </p>
                {scalableStatus?.connection?.last_synced_at && (
                  <p className="mt-2 text-xs text-slate-400">Ultima sincronizzazione: {new Date(scalableStatus.connection.last_synced_at).toLocaleString('it-IT')}</p>
                )}
                {scalableStatus?.connection?.last_error && (
                  <p className="mt-2 text-xs font-medium text-red-600">Ultimo errore: {scalableStatus.connection.last_error}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!scalableStatus?.connected ? (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => { window.location.href = '/api/integrations/scalable/connect' }}
                  disabled={scalableStatus?.configured === false}
                >
                  <Link2 className="h-4 w-4" />
                  Collega Scalable
                </Button>
              ) : (
                <>
                  <Button type="button" className="gap-2" onClick={syncScalable} disabled={syncingScalable}>
                    <RefreshCw className={syncingScalable ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    {syncingScalable ? 'Sincronizzo…' : 'Sincronizza ora'}
                  </Button>
                  <Button type="button" variant="outline" className="gap-2" onClick={disconnectScalable} disabled={disconnectingScalable}>
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
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Investimenti e attività esterne</h2>
            <p className="mt-1 text-sm text-slate-500">Capitale versato, valore attuale e differenza per ogni posizione.</p>
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
              const diff = current - invested
              const pct = invested > 0 ? (diff / invested) * 100 : null
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
                    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3">
                      <div>
                        <p className="text-[11px] text-slate-500">Versato</p>
                        <p className="mt-1 font-bold tabular-nums text-slate-950">{formatMoney(invested)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Valore attuale</p>
                        <p className="mt-1 font-bold tabular-nums text-indigo-600">{formatMoney(current)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Differenza</p>
                        <p className={`mt-1 flex items-center gap-1 font-bold tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {diff >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {diff >= 0 ? '+' : '−'}{formatMoney(Math.abs(diff))}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{pct == null ? 'Rendimento n/d' : `Rendimento ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}</span>
                      <span>Aggiornato {new Date(asset.observed_at).toLocaleDateString('it-IT')}</span>
                    </div>
                    {!asset.include_in_net_worth && <p className="mt-2 text-xs font-semibold text-amber-700">Escluso dal patrimonio totale per evitare doppio conteggio.</p>}
                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(asset)}><Pencil className="h-3.5 w-3.5" />Aggiorna</Button>
                      <Button variant="ghost" size="sm" className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => remove(asset)}><Trash2 className="h-3.5 w-3.5" />Rimuovi</Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
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

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg">
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
