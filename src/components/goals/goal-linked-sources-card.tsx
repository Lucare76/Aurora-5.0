'use client'

import { useMemo, useState } from 'react'
import { Link2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { GoalLinkedSource } from '@/lib/goals/linked-sources'

type Props = {
  goalId: string
  sources: GoalLinkedSource[]
  manualCurrentAmount: number
  linkedSourceAmount: number
  linkedMonthlyPlanAmount: number
  onRefresh: () => Promise<void>
}

type FormState = {
  provider: 'SCALABLE' | 'MANUAL'
  sourceType: 'POSITION' | 'CASH' | 'PORTFOLIO'
  externalKey: string
  displayName: string
  value: string
  quantity: string
  unitPrice: string
  monthlyPlanAmount: string
  nextPlanDate: string
}

const EMPTY_FORM: FormState = {
  provider: 'SCALABLE',
  sourceType: 'POSITION',
  externalKey: '',
  displayName: '',
  value: '',
  quantity: '',
  unitPrice: '',
  monthlyPlanAmount: '',
  nextPlanDate: '',
}

function toNullableNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function GoalLinkedSourcesCard({
  goalId,
  sources,
  manualCurrentAmount,
  linkedSourceAmount,
  linkedMonthlyPlanAmount,
  onRefresh,
}: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const totalTracked = useMemo(
    () => manualCurrentAmount + linkedSourceAmount,
    [manualCurrentAmount, linkedSourceAmount],
  )

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openNew = () => {
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  const openUpdate = (source: GoalLinkedSource) => {
    const snap = source.latestSnapshot
    setForm({
      provider: source.provider,
      sourceType: source.source_type,
      externalKey: source.external_key,
      displayName: source.display_name,
      value: snap ? String(snap.value) : '',
      quantity: snap?.quantity != null ? String(snap.quantity) : '',
      unitPrice: snap?.unit_price != null ? String(snap.unit_price) : '',
      monthlyPlanAmount: snap?.monthly_plan_amount != null ? String(snap.monthly_plan_amount) : '',
      nextPlanDate: snap?.next_plan_date ?? '',
    })
    setOpen(true)
  }

  const saveSnapshot = async () => {
    const value = Number(form.value)
    if (!form.displayName.trim() || !form.externalKey.trim() || !Number.isFinite(value) || value < 0) {
      toast.error('Compila nome, identificativo e valore corrente.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.provider,
          sourceType: form.sourceType,
          externalKey: form.externalKey.trim(),
          displayName: form.displayName.trim(),
          currency: 'EUR',
          value,
          quantity: toNullableNumber(form.quantity),
          unitPrice: toNullableNumber(form.unitPrice),
          monthlyPlanAmount: toNullableNumber(form.monthlyPlanAmount),
          nextPlanDate: form.nextPlanDate || null,
          observedAt: new Date().toISOString(),
          metadata: { captureMode: 'read_only_snapshot' },
        }),
      })
      if (!res.ok) {
        toast.error('Errore durante il salvataggio dello snapshot.')
        return
      }
      toast.success('Snapshot collegato all’obiettivo')
      setOpen(false)
      setForm(EMPTY_FORM)
      await onRefresh()
    } catch {
      toast.error('Errore di rete')
    } finally {
      setSaving(false)
    }
  }

  const removeSource = async (sourceId: string) => {
    setRemovingId(sourceId)
    try {
      const res = await fetch(`/api/goals/${goalId}/sources/${sourceId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Errore durante la rimozione della fonte.')
        return
      }
      toast.success('Fonte scollegata')
      await onRefresh()
    } catch {
      toast.error('Errore di rete')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
              <Link2 className="h-5 w-5 text-indigo-600" />
              Fonti collegate
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Snapshot in sola lettura: non crea movimenti e non può inviare ordini al provider.
            </p>
          </div>
          <Button type="button" size="sm" className="shrink-0 gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Collega fonte
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#f8f9fc] p-4">
              <p className="text-xs text-slate-500">Versamenti manuali</p>
              <p className="mt-1 font-bold tabular-nums text-slate-950">{formatCurrency(manualCurrentAmount)}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-4">
              <p className="text-xs text-indigo-600">Fonti collegate</p>
              <p className="mt-1 font-bold tabular-nums text-indigo-700">{formatCurrency(linkedSourceAmount)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">Totale tracciato</p>
              <p className="mt-1 font-bold tabular-nums text-emerald-800">{formatCurrency(totalTracked)}</p>
            </div>
          </div>

          {linkedMonthlyPlanAmount > 0 && (
            <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800">
              PAC/versamenti programmati rilevati nelle fonti: <strong>{formatCurrency(linkedMonthlyPlanAmount)}/mese</strong>.
              La proiezione non assume rendimenti di mercato.
            </div>
          )}

          {sources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">Nessuna fonte esterna collegata</p>
              <p className="mt-1 text-sm text-slate-500">
                Puoi registrare uno snapshot letto da Scalable MCP e usarlo nel progresso dell’obiettivo.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sources.map((source) => {
                const snapshot = source.latestSnapshot
                return (
                  <div key={source.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-slate-900">{source.display_name}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          {source.provider}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {snapshot ? `Aggiornato ${formatDate(snapshot.observed_at)}` : 'Nessuno snapshot'}
                        {snapshot?.next_plan_date ? ` · prossimo PAC ${formatDate(snapshot.next_plan_date)}` : ''}
                      </p>
                      {snapshot?.monthly_plan_amount != null && snapshot.monthly_plan_amount > 0 && (
                        <p className="mt-1 text-xs font-medium text-indigo-600">
                          PAC {formatCurrency(snapshot.monthly_plan_amount)}/mese
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <p className="mr-2 font-bold tabular-nums text-slate-950">
                        {snapshot ? formatCurrency(snapshot.value) : '—'}
                      </p>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openUpdate(source)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Snapshot
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-400 hover:text-red-600"
                        disabled={removingId === source.id}
                        onClick={() => removeSource(source.id)}
                        aria-label={`Scollega ${source.display_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Snapshot fonte esterna</DialogTitle>
          </DialogHeader>
          <div className="rounded-2xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-800">
            Inserisci i valori letti in sola lettura. Aurora li usa solo per il progresso dell’obiettivo:
            nessun saldo, movimento o ordine viene modificato.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <select value={form.provider} onChange={(e) => update('provider', e.target.value)} className="h-11 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm">
                <option value="SCALABLE">Scalable Capital</option>
                <option value="MANUAL">Altro / manuale</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tipo fonte</Label>
              <select value={form.sourceType} onChange={(e) => update('sourceType', e.target.value)} className="h-11 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm">
                <option value="POSITION">Posizione</option>
                <option value="CASH">Liquidità</option>
                <option value="PORTFOLIO">Portafoglio</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome</Label>
              <Input value={form.displayName} onChange={(e) => update('displayName', e.target.value)} placeholder="es. iShares Core MSCI World (Acc)" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Identificativo stabile</Label>
              <Input value={form.externalKey} onChange={(e) => update('externalKey', e.target.value)} placeholder="ISIN, ticker o nome univoco" />
            </div>
            <div className="space-y-2">
              <Label>Valore attuale (€)</Label>
              <Input type="number" min="0" step="0.01" value={form.value} onChange={(e) => update('value', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>PAC mensile (€)</Label>
              <Input type="number" min="0" step="0.01" value={form.monthlyPlanAmount} onChange={(e) => update('monthlyPlanAmount', e.target.value)} placeholder="Facoltativo" />
            </div>
            <div className="space-y-2">
              <Label>Quantità</Label>
              <Input type="number" min="0" step="0.000001" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} placeholder="Facoltativa" />
            </div>
            <div className="space-y-2">
              <Label>Prezzo unitario (€)</Label>
              <Input type="number" min="0" step="0.0001" value={form.unitPrice} onChange={(e) => update('unitPrice', e.target.value)} placeholder="Facoltativo" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Prossima esecuzione PAC</Label>
              <Input type="date" value={form.nextPlanDate} onChange={(e) => update('nextPlanDate', e.target.value)} />
            </div>
          </div>
          <Button type="button" className="h-11 w-full" disabled={saving} onClick={saveSnapshot}>
            {saving ? 'Salvataggio...' : 'Salva snapshot'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
