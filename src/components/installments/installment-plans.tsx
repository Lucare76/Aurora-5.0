'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { installmentDate, latestPayment, unpaidNumbers, type InstallmentPlan, type InstallmentPayment, type InstallmentSchedule } from '@/lib/installments/schedule'
import { installmentScheduleSchema } from '@/lib/installments/schema'

type Expense = { id: string; account_id: string; type: string; amount: number | string; description: string | null; date: string; transfer_peer_id: string | null }

export function InstallmentPlans({ plans, payments, transactions, accounts, onRefresh, onRegister }: {
  plans: InstallmentPlan[]; payments: InstallmentPayment[]; transactions: Expense[]
  accounts: Array<{ id: string; name: string }>
  onRefresh: () => Promise<void>
  onRegister: (plan: InstallmentPlan, number: number) => void
}) {
  const [editing, setEditing] = useState<InstallmentPlan | null>(null)
  const [linking, setLinking] = useState<InstallmentPlan | null>(null)
  const [draft, setDraft] = useState<InstallmentSchedule>({ amount: 0, frequency: 'monthly', interval: 1, first_due_date: '', first_installment_number: 1, paused: false })
  const [transactionId, setTransactionId] = useState('')
  const [number, setNumber] = useState(1)
  const [busy, setBusy] = useState(false)
  const today = new Date().toLocaleDateString('en-CA')
  const usedIds = new Set(payments.map((p) => p.transaction_id))
  const candidates = transactions.filter((t) => t.type === 'expense' && !t.transfer_peer_id && !usedIds.has(t.id))

  function openSchedule(plan: InstallmentPlan) {
    const last = latestPayment(plan.id, payments)
    const next = unpaidNumbers(plan, payments)[0] ?? plan.total_installments
    const defaults: InstallmentSchedule = {
      amount: Number(last?.transaction?.amount ?? 0), frequency: 'monthly', interval: 1,
      first_due_date: last?.transaction?.date ?? today,
      first_installment_number: last?.installment_number ?? next, paused: false,
    }
    setDraft(plan.schedule ?? { ...defaults, first_due_date: installmentDate(defaults, next), first_installment_number: next })
    setEditing(plan)
  }

  async function request(url: string, method: string, body: unknown) {
    setBusy(true)
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Salvataggio non riuscito')
      await onRefresh()
      setEditing(null)
      setLinking(null)
      toast.success('Piano rateale aggiornato')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Salvataggio non riuscito') }
    finally { setBusy(false) }
  }

  if (!plans.length) return null
  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm" id="piani-rateali">
      <h2 className="text-sm font-semibold text-slate-900">Acquisti a rate</h2>
      <p className="mt-1 text-xs text-slate-500">Pianifica le scadenze nel calendario. Il saldo cambia solo quando registri un addebito reale.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => {
          const pending = unpaidNumbers(plan, payments)
          const next = pending[0]
          const transaction = latestPayment(plan.id, payments)?.transaction
          const account = accounts.find((a) => a.id === transaction?.account_id)
          return (
            <article key={plan.id} className="min-w-0 rounded-xl border border-slate-100 p-3">
              <p className="text-sm font-semibold text-slate-900">{plan.title}</p>
              <p className="mt-1 text-xs text-slate-500">{pending.length ? `${pending.length} rate ancora aperte su ${plan.total_installments}` : 'Piano completato'}{account ? ` · ${account.name}` : ''}</p>
              {plan.schedule ? (
                <div className="mt-2 text-xs text-slate-600">
                  <p>Residuo previsto: <strong>{formatCurrency(Math.round(plan.schedule.amount * pending.length * 100) / 100)}</strong>{plan.schedule.paused ? ' · Previsioni in pausa' : ''}</p>
                  {next && <p className="mt-1">Prossima rata {next}: <strong>{formatDate(installmentDate(plan.schedule, next))}</strong> · {formatCurrency(plan.schedule.amount)}</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-indigo-600">Mostra scadenze aperte</summary>
                    <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                      {pending.map((n) => { const date = installmentDate(plan.schedule!, n); return <li key={n} className="flex justify-between gap-2"><span>Rata {n} · {formatDate(date)}{date < today ? ' · da verificare' : ''}</span><span>{formatCurrency(plan.schedule!.amount)}</span></li> })}
                    </ul>
                  </details>
                </div>
              ) : <p className="mt-2 text-xs text-amber-700">Aggiungi importo e scadenze per includere il piano nelle previsioni.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => openSchedule(plan)}>{plan.schedule ? 'Modifica scadenze' : 'Pianifica rate'}</Button>
                {next && <>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setLinking(plan); setNumber(next); setTransactionId('') }}>Collega addebito</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onRegister(plan, next)}>Registra rata</Button>
                </>}
              </div>
            </article>
          )
        })}
      </div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !busy && !open && setEditing(null)}>
        <DialogContent className="max-h-[80dvh] max-w-lg overflow-y-auto bg-white p-4 text-slate-950">
          <DialogHeader><DialogTitle>Pianifica rate · {editing?.title}</DialogTitle></DialogHeader>
          <form className="mt-4 space-y-3" onSubmit={(event) => {
            event.preventDefault()
            const result = installmentScheduleSchema.safeParse(draft)
            if (!result.success || !editing || draft.first_installment_number > editing.total_installments) { toast.error('Controlla importo, date e numero della rata'); return }
            void request('/api/installments', 'PUT', { plan_id: editing.id, schedule: result.data })
          }}>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="schedule-amount">Importo di ogni rata (€)</Label><Input id="schedule-amount" type="number" min="0.01" step="0.01" value={draft.amount || ''} required onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></div>
              <div><Label htmlFor="schedule-frequency">Frequenza</Label><select id="schedule-frequency" className="h-10 w-full rounded-lg border px-2 text-sm" value={`${draft.frequency}:${draft.interval}`} onChange={(e) => { const [frequency, interval] = e.target.value.split(':'); setDraft({ ...draft, frequency: frequency as InstallmentSchedule['frequency'], interval: Number(interval) }) }}>
                <option value="monthly:1">Ogni mese</option><option value="monthly:2">Ogni 2 mesi</option><option value="monthly:3">Ogni 3 mesi</option><option value="monthly:6">Ogni 6 mesi</option><option value="monthly:12">Ogni anno</option><option value="weekly:1">Ogni settimana</option><option value="weekly:2">Ogni 2 settimane</option>
              </select></div>
              <div><Label htmlFor="schedule-number">Prima rata da pianificare</Label><Input id="schedule-number" type="number" min="1" max={editing?.total_installments} value={draft.first_installment_number} required onChange={(e) => setDraft({ ...draft, first_installment_number: Number(e.target.value) })} /></div>
              <div><Label htmlFor="schedule-date">Scadenza di questa rata</Label><DateInput id="schedule-date" value={draft.first_due_date} required onChange={(e) => setDraft({ ...draft, first_due_date: e.target.value })} /></div>
            </div>
            <p className="text-xs text-slate-500">Le rate già collegate restano pagate. Le nuove previsioni usano il conto dell’ultimo addebito collegato e non creano movimenti. Gli importi residui sono una stima.</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.paused} onChange={(e) => setDraft({ ...draft, paused: e.target.checked })} />Metti in pausa le previsioni di questo piano</label>
            <Button type="submit" className="w-full" disabled={busy}>Salva pianificazione</Button>
            {editing?.schedule && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void request('/api/installments', 'PUT', { plan_id: editing.id, schedule: null })}>Rimuovi solo la pianificazione</Button>}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(linking)} onOpenChange={(open) => !busy && !open && setLinking(null)}>
        <DialogContent className="max-h-[80dvh] max-w-lg overflow-y-auto bg-white p-4 text-slate-950">
          <DialogHeader><DialogTitle>Collega un addebito già registrato</DialogTitle></DialogHeader>
          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); if (linking) void request('/api/installments/link', 'POST', { plan_id: linking.id, transaction_id: transactionId, installment_number: number }) }}>
            <p className="text-sm text-slate-600">{linking?.title}. Il collegamento aggiorna il conteggio delle rate senza modificare il saldo.</p>
            <div><Label htmlFor="link-number">Numero della rata</Label><select id="link-number" value={number} onChange={(e) => setNumber(Number(e.target.value))} className="h-10 w-full rounded-lg border px-2">
              {linking && unpaidNumbers(linking, payments).map((n) => <option key={n} value={n}>Rata {n} di {linking.total_installments}</option>)}
            </select></div>
            <div><Label htmlFor="link-transaction">Spesa nel mese visualizzato</Label><select id="link-transaction" value={transactionId} required onChange={(e) => setTransactionId(e.target.value)} className="h-10 w-full rounded-lg border px-2 text-sm">
              <option value="">Seleziona un addebito</option>{candidates.map((t) => <option key={t.id} value={t.id}>{formatDate(t.date)} · {t.description || 'Spesa'} · {formatCurrency(Number(t.amount))}</option>)}
            </select></div>
            <p className="text-xs text-slate-500">Se il movimento è in un altro mese, chiudi e cambia mese. Puoi collegarlo anche da “Modifica movimento”.</p>
            <Button type="submit" className="w-full" disabled={busy || !transactionId}>Collega senza nuovo addebito</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
