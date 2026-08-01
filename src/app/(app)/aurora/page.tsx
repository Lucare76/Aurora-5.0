'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeftRight, BadgeCheck, Landmark, Loader2, Plus, RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

type Account = { id: string; name: string; balance: number; currency: string; is_active: boolean; type: string; color?: string | null }
type Tx = { id: string; account_id: string; type: string; amount: number; date: string; description: string | null; transfer_peer_id: string | null }
type Summary = {
  balance: number
  liquidity: number
  investments: number
  income: number
  expenses: number
  transfersIn: number
  transfersOut: number
  periodChange: number
  activeAccountsCount: number
  lastMovementDate: string | null
  byAccount: Array<{ accountId: string; name: string; balance: number; share: number; currency: string; isActive: boolean; type: string }>
  monthlyTrend: Array<{ month: string; income: number; expenses: number; transfersIn: number; transfersOut: number; balance: number }>
  recentTransactions: Tx[]
}
type Payload = {
  linkedAccount: Account | null
  suggestedAccount: Account | null
  accounts: Account[]
  auroraAccounts: Account[]
  transactions: Tx[]
  summary: Summary
  monitoredTotal: { personal: number; aurora: number; adi: number; total: number; disclaimer: string }
  schemaReady: boolean
  schemaMessage: string | null
}

const today = new Date().toLocaleDateString('en-CA')

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-[#e5e7f0] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-medium text-slate-700">{label}{children}</label>
}

export default function AuroraSavingsPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState({ name: '', type: 'savings', balance: '0', currency: 'EUR', color: '#6366f1' })
  const [movement, setMovement] = useState({ type: 'income', accountId: '', amount: '', date: today, description: '', notes: '' })
  const [transfer, setTransfer] = useState({ sourceAccountId: '', destinationAccountId: '', amount: '', date: today, description: '', reason: '', notes: '' })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/aurora', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Risparmi di Aurora non disponibili.')
      setData(body.data)
      const firstAuroraAccount = body.data.auroraAccounts?.[0]?.id ?? ''
      setSelectedAccountId(firstAuroraAccount || body.data.suggestedAccount?.id || '')
      setMovement((current) => ({ ...current, accountId: current.accountId || firstAuroraAccount }))
      setTransfer((current) => ({ ...current, sourceAccountId: current.sourceAccountId || firstAuroraAccount }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Risparmi di Aurora non disponibili.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function submit(payload: unknown) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/aurora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'Operazione Aurora non riuscita.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione Aurora non riuscita.')
    } finally {
      setSaving(false)
    }
  }

  const maxMonthly = useMemo(() => Math.max(...(data?.summary.monthlyTrend.map((row) => Math.max(row.income + row.transfersIn, row.expenses + row.transfersOut)) ?? [0]), 1), [data?.summary.monthlyTrend])
  const hasAuroraAccounts = (data?.auroraAccounts.length ?? 0) > 0
  const schemaReady = data?.schemaReady ?? true

  if (loading && !data) {
    return <div className="rounded-2xl border border-[#e5e7f0] bg-white p-6 text-sm text-slate-500">Caricamento area Aurora...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Aurora</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Patrimonio dedicato ad Aurora, separato da personale e ADI. Conti, movimenti e statistiche usano solo il perimetro Aurora.
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e5e7f0] bg-white px-4 text-sm font-semibold text-slate-700">
          <RefreshCw className="h-4 w-4" />Aggiorna
        </button>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!schemaReady && (
        <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Schema Aurora non ancora attivo</p>
            <p className="mt-1">{data?.schemaMessage}</p>
          </div>
        </div>
      )}

      {!hasAuroraAccounts && (
        <section className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Wallet className="mt-1 h-5 w-5 text-indigo-600" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-950">Collega il primo conto Aurora</h2>
              <p className="mt-1 text-sm text-slate-500">
                Seleziona il conto reale già esistente. Il conto suggerito è “Aurora piano di accumulo” e non verrà copiato.
              </p>
              <form onSubmit={(event) => { event.preventDefault(); void submit({ action: 'linkAccount', accountId: selectedAccountId }) }} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm" aria-label="Conto da collegare ad Aurora">
                  <option value="">Seleziona conto...</option>
                  {data?.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} - {formatCurrency(Number(account.balance), account.currency)}</option>)}
                </select>
                <Button type="submit" disabled={!schemaReady || !selectedAccountId || saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Collega conto</Button>
              </form>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Patrimonio Aurora" value={formatCurrency(data?.summary.balance ?? 0)} helper={`${data?.summary.activeAccountsCount ?? 0} conti attivi`} />
        <MetricCard label="Liquidità Aurora" value={formatCurrency(data?.summary.liquidity ?? 0)} />
        <MetricCard label="Investimenti Aurora" value={formatCurrency(data?.summary.investments ?? 0)} />
        <MetricCard label="Variazione netta" value={formatCurrency(data?.summary.periodChange ?? 0)} helper={`Ricevuti da personale ${formatCurrency(data?.summary.transfersIn ?? 0)}`} />
      </section>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
        <div className="flex items-start gap-2">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{data?.monitoredTotal.disclaimer}</p>
        </div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
          <span>Personale: <strong>{formatCurrency(data?.monitoredTotal.personal ?? 0)}</strong></span>
          <span>Aurora: <strong>{formatCurrency(data?.monitoredTotal.aurora ?? 0)}</strong></span>
          <span>ADI: <strong>{formatCurrency(data?.monitoredTotal.adi ?? 0)}</strong></span>
          <span>Totale monitorato: <strong>{formatCurrency(data?.monitoredTotal.total ?? 0)}</strong></span>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Landmark className="h-5 w-5 text-indigo-600" /><h2 className="text-base font-semibold text-slate-950">Conti Aurora</h2></div>
          <div className="mt-4 space-y-3">
            {(data?.summary.byAccount ?? []).length === 0 ? <p className="text-sm text-slate-500">Collega o crea un conto per iniziare.</p> : data!.summary.byAccount.map((account) => (
              <div key={account.accountId} className="rounded-xl border border-[#e5e7f0] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-slate-950">{account.name}</p><p className="text-xs text-slate-500">{account.type} · {account.isActive ? 'Attivo' : 'Archiviato'}</p></div>
                  <p className="font-bold tabular-nums text-slate-950">{formatCurrency(account.balance, account.currency)}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, account.share)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void submit({ action: 'createAccount', ...accountForm, balance: Number(accountForm.balance.replace(',', '.')) }) }} className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Nuovo conto Aurora</h2>
          <p className="mt-1 text-sm text-slate-500">Il conto viene creato nel modello accounts esistente e marcato server-side come Aurora.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nome"><input required value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
            <Field label="Tipo"><select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3"><option value="savings">Risparmio</option><option value="checking">Conto corrente</option><option value="investment">Investimento</option><option value="cash">Contanti</option><option value="other">Altro</option></select></Field>
            <Field label="Saldo iniziale"><input type="number" step="0.01" value={accountForm.balance} onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
            <Field label="Valuta"><input value={accountForm.currency} onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value.toUpperCase() })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
          </div>
          <Button type="submit" disabled={!schemaReady || saving} className="mt-4 gap-2"><Plus className="h-4 w-4" />Nuovo conto Aurora</Button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={(event) => { event.preventDefault(); void submit({ action: 'createTransaction', type: movement.type, accountId: movement.accountId, amount: Number(movement.amount.replace(',', '.')), date: movement.date, description: movement.description, notes: movement.notes || null }) }} className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Nuovo movimento Aurora</h2>
          <p className="mt-1 text-sm text-slate-500">Entrate e uscite Aurora usano i conti dedicati e non entrano nelle statistiche personali.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Tipo"><select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3"><option value="income">Entrata</option><option value="expense">Uscita</option></select></Field>
            <Field label="Conto Aurora"><select required value={movement.accountId} onChange={(e) => setMovement({ ...movement, accountId: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3">{data?.auroraAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
            <Field label="Importo"><input required type="number" min="0.01" step="0.01" value={movement.amount} onChange={(e) => setMovement({ ...movement, amount: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
            <Field label="Data"><input required type="date" value={movement.date} onChange={(e) => setMovement({ ...movement, date: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
            <Field label="Descrizione"><input required value={movement.description} onChange={(e) => setMovement({ ...movement, description: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
            <Field label="Note"><input value={movement.notes} onChange={(e) => setMovement({ ...movement, notes: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
          </div>
          <Button type="submit" disabled={!schemaReady || saving || !hasAuroraAccounts} className="mt-4 gap-2"><Plus className="h-4 w-4" />Salva movimento Aurora</Button>
        </form>

        <form onSubmit={(event) => { event.preventDefault(); void submit({ action: 'createTransfer', sourceAccountId: transfer.sourceAccountId, destinationAccountId: transfer.destinationAccountId, amount: Number(transfer.amount.replace(',', '.')), date: transfer.date, description: transfer.description, reason: transfer.reason || null, notes: transfer.notes || null }) }} className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Nuovo giroconto Aurora</h2>
          <p className="mt-1 text-sm text-slate-500">Supporta Personale → Aurora, Aurora → Personale e Aurora → Aurora usando il motore giroconti atomico.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Da"><select required value={transfer.sourceAccountId} onChange={(e) => setTransfer({ ...transfer, sourceAccountId: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3"><option value="">Seleziona conto</option>{data?.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
            <Field label="A"><select required value={transfer.destinationAccountId} onChange={(e) => setTransfer({ ...transfer, destinationAccountId: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3"><option value="">Seleziona conto</option>{data?.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
            <Field label="Importo"><input required type="number" min="0.01" step="0.01" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
            <Field label="Data"><input required type="date" value={transfer.date} onChange={(e) => setTransfer({ ...transfer, date: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
            <Field label="Descrizione"><input required value={transfer.description} onChange={(e) => setTransfer({ ...transfer, description: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
            <Field label="Motivo se verso personale"><input value={transfer.reason} onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[#e5e7f0] px-3" /></Field>
          </div>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Se trasferisci denaro dal patrimonio dedicato ad Aurora a un conto personale, indica il motivo dell’utilizzo.</p>
          <Button type="submit" disabled={!schemaReady || saving || !hasAuroraAccounts} className="mt-4 gap-2"><ArrowLeftRight className="h-4 w-4" />Salva giroconto Aurora</Button>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Statistiche Aurora</h2>
          <div className="mt-4 space-y-3">
            {(data?.summary.monthlyTrend ?? []).length === 0 ? <p className="text-sm text-slate-500">Le statistiche compariranno dopo i primi movimenti Aurora.</p> : data!.summary.monthlyTrend.map((row) => (
              <div key={row.month}>
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{row.month}</span><span>{formatCurrency(row.balance)}</span></div>
                <div className="grid h-2 grid-cols-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${Math.min(100, ((row.income + row.transfersIn) / maxMonthly) * 100)}%` }} />
                  <div className="bg-red-500" style={{ width: `${Math.min(100, ((row.expenses + row.transfersOut) / maxMonthly) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#e5e7f0] bg-white shadow-sm">
          <div className="border-b border-[#e5e7f0] p-5"><h2 className="text-base font-semibold text-slate-950">Ultimi movimenti Aurora</h2></div>
          <div className="divide-y divide-[#e5e7f0]">
            {(data?.summary.recentTransactions ?? []).length === 0 ? <p className="p-5 text-sm text-slate-500">Nessun movimento Aurora registrato.</p> : data!.summary.recentTransactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-950">{tx.description ?? 'Movimento Aurora'}</p><p className="text-xs text-slate-500">{tx.date}</p></div>
                <p className={tx.type === 'expense' ? 'text-sm font-bold tabular-nums text-red-600' : 'text-sm font-bold tabular-nums text-emerald-600'}>{tx.type === 'expense' ? '-' : '+'}{formatCurrency(Number(tx.amount))}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
