'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BadgeEuro, Loader2, Pencil, Plus, Save, WalletCards, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ADI_CATEGORY_LABELS, ADI_CATEGORIES } from '@/lib/dependent-finance/constants'
import type { AdiCategory, AdiEntry } from '@/lib/dependent-finance/types'
import { formatCurrency } from '@/lib/utils'

type Payload = {
  entries: AdiEntry[]
  allEntries: AdiEntry[]
  summary: {
    received: number
    spent: number
    balance: number
    utilizationRate: number
    byCategory: Record<AdiCategory, number>
    monthlyTrend: Array<{ month: string; received: number; spent: number; balance: number }>
  }
  filteredSummary: Payload['summary']
}

const today = new Date().toLocaleDateString('en-CA')
const currentPeriod = today.slice(0, 7)

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'green' | 'red' | 'indigo' }) {
  const colors = {
    slate: 'text-slate-950 bg-white border-[#e5e7f0]',
    green: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    red: 'text-red-700 bg-red-50 border-red-100',
    indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100',
  }
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colors[tone]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export default function AdiPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState('')
  const [category, setCategory] = useState('')
  const [credit, setCredit] = useState({ amount: '', date: today, referencePeriod: currentPeriod, description: `ADI ${new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`, note: '' })
  const [debit, setDebit] = useState({ amount: '', date: today, adiCategory: 'SUPERMERCATO' as AdiCategory, description: '', note: '', transactionId: '' })
  const [editing, setEditing] = useState<{
    entryId: string
    entryType: 'credit' | 'debit'
    amount: string
    date: string
    referencePeriod: string
    adiCategory: AdiCategory
    description: string
    note: string
  } | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    if (category) params.set('category', category)
    return params.toString()
  }, [category, month])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/adi${query ? `?${query}` : ''}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Gestione ADI non disponibile.')
      setData(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gestione ADI non disponibile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [query])

  async function submit(payload: unknown) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/adi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'Registrazione ADI non riuscita.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione ADI non riuscita.')
    } finally {
      setSaving(false)
    }
  }

  async function updateEntry(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/adi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: editing.entryId,
          amount: Number(editing.amount.replace(',', '.')),
          date: editing.date,
          referencePeriod: editing.entryType === 'credit' ? editing.referencePeriod || null : null,
          adiCategory: editing.entryType === 'debit' ? editing.adiCategory : null,
          description: editing.description,
          note: editing.note || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'Modifica movimento ADI non riuscita.')
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica movimento ADI non riuscita.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(entry: AdiEntry) {
    setEditing({
      entryId: entry.id,
      entryType: entry.entry_type,
      amount: String(Number(entry.amount)),
      date: entry.date,
      referencePeriod: entry.reference_period ?? entry.date.slice(0, 7),
      adiCategory: (entry.adi_category ?? 'SUPERMERCATO') as AdiCategory,
      description: entry.description,
      note: entry.note ?? '',
    })
  }

  if (loading && !data) {
    return <div className="rounded-2xl border border-[#e5e7f0] bg-white p-6 text-sm text-slate-500">Caricamento gestione ADI...</div>
  }

  const summary = data?.summary

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Gestione ADI</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Gestisci accrediti ADI e sole spese ammesse. Una spesa personale non riduce l’ADI se non viene contrassegnata esplicitamente come pagata con ADI.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="ADI ricevuto" value={formatCurrency(summary?.received ?? 0)} tone="green" />
        <MetricCard label="ADI speso" value={formatCurrency(summary?.spent ?? 0)} tone="red" />
        <MetricCard label="Residuo ADI" value={formatCurrency(summary?.balance ?? 0)} tone="indigo" />
        <MetricCard label="Utilizzo ADI" value={`${summary?.utilizationRate ?? 0}%`} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {ADI_CATEGORIES.map((key) => (
          <div key={key} className="rounded-2xl border border-[#e5e7f0] bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-950">{ADI_CATEGORY_LABELS[key]}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-red-600">-{formatCurrency(summary?.byCategory[key] ?? 0)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Andamento mensile ADI</h2>
        <p className="mt-1 text-sm text-slate-500">Confronto separato tra accrediti ADI, spese ADI e residuo per mensilità.</p>
        <div className="mt-4 space-y-3">
          {(summary?.monthlyTrend ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Nessun andamento disponibile.</p>
          ) : summary!.monthlyTrend.map((row) => (
            <div key={row.month} className="grid gap-2 rounded-xl border border-[#e5e7f0] p-3 sm:grid-cols-4 sm:items-center">
              <p className="text-sm font-semibold text-slate-950">{row.month}</p>
              <p className="text-sm tabular-nums text-emerald-600">Ricevuto {formatCurrency(row.received)}</p>
              <p className="text-sm tabular-nums text-red-600">Speso {formatCurrency(row.spent)}</p>
              <p className="text-sm font-semibold tabular-nums text-indigo-600">Residuo {formatCurrency(row.balance)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit({
              entryType: 'credit',
              amount: Number(credit.amount.replace(',', '.')),
              date: credit.date,
              referencePeriod: credit.referencePeriod || null,
              description: credit.description,
              note: credit.note || null,
            })
          }}
          className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <BadgeEuro className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-950">Registra accredito ADI</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">Entrata nel fondo ADI separato. Non aumenta reddito personale, margine o affordability.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Importo<input required type="number" min="0.01" step="0.01" value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
            <label className="text-sm font-medium text-slate-700">Data accredito<input required type="date" value={credit.date} onChange={(e) => setCredit({ ...credit, date: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
            <label className="text-sm font-medium text-slate-700">Periodo<input type="month" value={credit.referencePeriod} onChange={(e) => setCredit({ ...credit, referencePeriod: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
            <label className="text-sm font-medium text-slate-700">Descrizione<input required value={credit.description} onChange={(e) => setCredit({ ...credit, description: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">Nota<textarea value={credit.note} onChange={(e) => setCredit({ ...credit, note: e.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-[#e5e7f0] px-3 py-2" /></label>
          <Button type="submit" disabled={saving} className="mt-4 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Registra accredito ADI
          </Button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit({
              entryType: 'debit',
              amount: Number(debit.amount.replace(',', '.')),
              date: debit.date,
              adiCategory: debit.adiCategory,
              description: debit.description,
              note: debit.note || null,
              transactionId: debit.transactionId || null,
              paidWithAdi: true,
            })
          }}
          className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-950">Registra spesa ADI</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">Sono disponibili solo Supermercato, Benzina e Abbigliamento Aurora. Conferma sempre “Pagato con ADI”.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Importo<input required type="number" min="0.01" step="0.01" value={debit.amount} onChange={(e) => setDebit({ ...debit, amount: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
            <label className="text-sm font-medium text-slate-700">Data<input required type="date" value={debit.date} onChange={(e) => setDebit({ ...debit, date: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
            <label className="text-sm font-medium text-slate-700">Categoria ADI<select value={debit.adiCategory} onChange={(e) => setDebit({ ...debit, adiCategory: e.target.value as AdiCategory })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3">{ADI_CATEGORIES.map((key) => <option key={key} value={key}>{ADI_CATEGORY_LABELS[key]}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Transazione collegata<input value={debit.transactionId} onChange={(e) => setDebit({ ...debit, transactionId: e.target.value })} placeholder="UUID facoltativo" className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
            <label className="sm:col-span-2 text-sm font-medium text-slate-700">Descrizione<input required value={debit.description} onChange={(e) => setDebit({ ...debit, description: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked readOnly className="h-4 w-4" />Pagato con ADI</label>
          <label className="mt-3 block text-sm font-medium text-slate-700">Nota<textarea value={debit.note} onChange={(e) => setDebit({ ...debit, note: e.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-[#e5e7f0] px-3 py-2" /></label>
          <Button type="submit" disabled={saving} className="mt-4 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Registra spesa ADI
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-[#e5e7f0] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#e5e7f0] p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-950">Movimenti ADI</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="adi-month">Periodo</label>
            <input id="adi-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm" />
            <label className="sr-only" htmlFor="adi-category">Categoria</label>
            <select id="adi-category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-xl border border-[#e5e7f0] px-3 text-sm">
              <option value="">Tutte le categorie</option>
              {ADI_CATEGORIES.map((key) => <option key={key} value={key}>{ADI_CATEGORY_LABELS[key]}</option>)}
            </select>
          </div>
        </div>
        <div className="divide-y divide-[#e5e7f0]">
          {(data?.entries ?? []).length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Nessun movimento ADI nel filtro selezionato.</p>
          ) : data!.entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              {editing?.entryId === entry.id ? (
                <form onSubmit={updateEntry} className="w-full space-y-3 rounded-xl bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm font-medium text-slate-700">Importo<input required type="number" min="0.01" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
                    <label className="text-sm font-medium text-slate-700">Data<input required type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
                    {editing.entryType === 'credit' ? (
                      <label className="text-sm font-medium text-slate-700">Periodo<input type="month" value={editing.referencePeriod} onChange={(e) => setEditing({ ...editing, referencePeriod: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
                    ) : (
                      <label className="text-sm font-medium text-slate-700">Categoria<select value={editing.adiCategory} onChange={(e) => setEditing({ ...editing, adiCategory: e.target.value as AdiCategory })} className="mt-1 h-10 w-full rounded-xl border border-[#e5e7f0] px-3">{ADI_CATEGORIES.map((key) => <option key={key} value={key}>{ADI_CATEGORY_LABELS[key]}</option>)}</select></label>
                    )}
                    <label className="text-sm font-medium text-slate-700">Descrizione<input required value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e5e7f0] px-3" /></label>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">Nota<textarea value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} className="mt-1 min-h-16 w-full rounded-xl border border-[#e5e7f0] px-3 py-2" /></label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salva modifica</Button>
                    <button type="button" onClick={() => setEditing(null)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e5e7f0] bg-white px-4 text-sm font-semibold text-slate-700">
                      <X className="h-4 w-4" />Annulla
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">{entry.description}</p>
                    <p className="text-xs text-slate-500">
                      {entry.date} · {entry.entry_type === 'credit' ? 'Accredito' : ADI_CATEGORY_LABELS[entry.adi_category as AdiCategory]}
                      {entry.transaction_id ? ` · Transazione ${entry.transaction_id}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={entry.entry_type === 'credit' ? 'text-sm font-bold tabular-nums text-emerald-600' : 'text-sm font-bold tabular-nums text-red-600'}>
                      {entry.entry_type === 'credit' ? '+' : '-'}{formatCurrency(Number(entry.amount))}
                    </p>
                    <button type="button" onClick={() => startEdit(entry)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#e5e7f0] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <Pencil className="h-3.5 w-3.5" />Modifica
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
