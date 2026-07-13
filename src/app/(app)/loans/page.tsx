'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { HandCoins, MoreHorizontal, Pencil, Plus, ReceiptText, ShieldCheck, Trash2 } from 'lucide-react'
import { isBefore, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { Loan, LoanType } from '@/types/database'

const BORDER = '#e5e7f0'

const loanSchema = z.object({
  type: z.enum(['given', 'received']),
  counterpart: z.string().trim().min(1, 'Inserisci il nome della persona'),
  amount: z.coerce.number({ error: 'Importo non valido' }).positive('L’importo deve essere positivo'),
  description: z.string().optional(),
  due_date: z.string().optional(),
})

const paymentSchema = z.object({
  amount: z.coerce.number({ error: 'Importo non valido' }).positive('L’importo deve essere positivo'),
  paid_at: z.string().min(1, 'Inserisci la data'),
  notes: z.string().optional(),
})

type LoanForm = z.infer<typeof loanSchema>
type PaymentForm = z.infer<typeof paymentSchema>
type LoanTab = 'given' | 'received'

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn('h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100', props.className)}
      style={{ borderColor: BORDER }}
    />
  )
}

export default function LoansPage() {
  const supabase = createClient()
  const db = supabase
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<LoanTab>('given')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loanForm = useForm<LoanForm>({
    resolver: zodResolver(loanSchema) as any,
    defaultValues: { type: 'given', counterpart: '', amount: 0, description: '', due_date: '' },
  })
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: { amount: 0, paid_at: new Date().toISOString().split('T')[0], notes: '' },
  })

  const fetchLoans = async () => {
    setLoading(true)
    const { data, error } = await db.from('loans').select('*').order('created_at', { ascending: false })
    if (error) toast.error('Errore nel caricamento dei prestiti')
    setLoans((data ?? []) as Loan[])
    setLoading(false)
  }

  useEffect(() => {
    fetchLoans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => {
    const given = loans.filter((loan) => loan.type === 'given' && !loan.is_settled).reduce((sum, loan) => sum + loan.remaining, 0)
    const received = loans.filter((loan) => loan.type === 'received' && !loan.is_settled).reduce((sum, loan) => sum + loan.remaining, 0)
    return { given, received, net: given - received }
  }, [loans])

  const visibleLoans = loans.filter((loan) => loan.type === tab)

  const openCreate = () => {
    setEditingLoan(null)
    loanForm.reset({ type: tab, counterpart: '', amount: 0, description: '', due_date: '' })
    setDialogOpen(true)
  }

  const openEdit = (loan: Loan) => {
    setOpenMenuId(null)
    setEditingLoan(loan)
    loanForm.reset({
      type: loan.type,
      counterpart: loan.counterpart,
      amount: loan.amount,
      description: loan.description ?? '',
      due_date: loan.due_date ?? '',
    })
    setDialogOpen(true)
  }

  const onSubmit: SubmitHandler<LoanForm> = async (values) => {
    try {
      setBusy(true)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

      const payload = {
        user_id: user.id,
        type: values.type as LoanType,
        counterpart: values.counterpart,
        amount: values.amount,
        remaining: editingLoan ? Math.min(editingLoan.remaining, values.amount) : values.amount,
        description: values.description || null,
        due_date: values.due_date || null,
        is_settled: false,
        settled_at: null,
      }
      const { error } = editingLoan
        ? await db.from('loans').update(payload).eq('id', editingLoan.id)
        : await db.from('loans').insert(payload)
      if (error) throw error
      toast.success(editingLoan ? 'Prestito aggiornato' : 'Prestito creato')
      setDialogOpen(false)
      setEditingLoan(null)
      await fetchLoans()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il salvataggio')
    } finally {
      setBusy(false)
    }
  }

  const onPayment: SubmitHandler<PaymentForm> = async (values) => {
    if (!paymentLoan) return
    try {
      setBusy(true)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

      const nextRemaining = Math.max(paymentLoan.remaining - values.amount, 0)
      const isSettled = nextRemaining === 0
      const { error: paymentError } = await db.from('loan_payments').insert({
        loan_id: paymentLoan.id,
        user_id: user.id,
        amount: values.amount,
        paid_at: values.paid_at,
        notes: values.notes || null,
      })
      if (paymentError) throw paymentError

      const { error } = await db
        .from('loans')
        .update({
          remaining: nextRemaining,
          is_settled: isSettled,
          settled_at: isSettled ? new Date().toISOString() : null,
        })
        .eq('id', paymentLoan.id)
      if (error) throw error

      toast.success(isSettled ? 'Prestito saldato' : 'Pagamento registrato')
      setPaymentLoan(null)
      paymentForm.reset({ amount: 0, paid_at: new Date().toISOString().split('T')[0], notes: '' })
      await fetchLoans()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il pagamento')
    } finally {
      setBusy(false)
    }
  }

  const settleLoan = async (loan: Loan) => {
    try {
      const { error } = await db.from('loans').update({ remaining: 0, is_settled: true, settled_at: new Date().toISOString() }).eq('id', loan.id)
      if (error) throw error
      toast.success('Prestito segnato come saldato')
      setOpenMenuId(null)
      await fetchLoans()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante la saldatura')
    }
  }

  const deleteLoan = async (loan: Loan) => {
    try {
      const { error } = await db.from('loans').delete().eq('id', loan.id)
      if (error) throw error
      toast.success('Prestito eliminato')
      setOpenMenuId(null)
      await fetchLoans()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l’eliminazione')
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Crediti e debiti</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Prestiti</h1>
          </div>
          <Button onClick={openCreate} className="h-11 gap-2">
            <Plus className="h-4 w-4" />
            Nuovo prestito
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Totale prestato</p><p className="mt-3 text-3xl font-semibold tabular-nums text-indigo-600">{formatCurrency(summary.given)}</p></CardContent></Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Totale ricevuto</p><p className="mt-3 text-3xl font-semibold tabular-nums text-amber-600">{formatCurrency(summary.received)}</p></CardContent></Card>
          <Card className="border-[#e5e7f0] bg-gradient-to-br from-indigo-50 to-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Saldo netto</p><p className={cn('mt-3 text-3xl font-semibold tabular-nums', summary.net >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(summary.net)}</p></CardContent></Card>
        </section>

        <div className="inline-flex rounded-2xl border border-[#e5e7f0] bg-white p-1 shadow-sm">
          {[{ value: 'given', label: 'Ho prestato' }, { value: 'received', label: 'Ho ricevuto' }].map((item) => (
            <button key={item.value} className={cn('h-10 rounded-xl px-5 text-sm font-semibold transition', tab === item.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500')} onClick={() => setTab(item.value as LoanTab)}>
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />)}</div>
        ) : visibleLoans.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState icon={HandCoins} title="Nessun prestito" description="Tieni traccia di soldi prestati o ricevuti." action={<Button onClick={openCreate}>Nuovo prestito</Button>} />
          </div>
        ) : (
          <div className="space-y-3">
            {visibleLoans.map((loan) => {
              const paid = loan.amount - loan.remaining
              const percent = loan.amount > 0 ? Math.round((paid / loan.amount) * 100) : 0
              const overdue = Boolean(loan.due_date && !loan.is_settled && isBefore(parseISO(loan.due_date), new Date()))
              return (
                <Card key={loan.id} className="border-[#e5e7f0] bg-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-slate-950">{loan.counterpart}</h2>
                          {loan.is_settled && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Saldato</span>}
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{loan.description || 'Nessuna descrizione'}</p>
                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{formatCurrency(paid)} pagati su {formatCurrency(loan.amount)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-4 lg:min-w-72 lg:justify-end">
                        <div className="text-right">
                          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(loan.remaining)}</p>
                          {loan.due_date && <p className={cn('mt-1 text-xs', overdue ? 'font-semibold text-red-600' : 'text-slate-500')}>Scadenza {formatDate(loan.due_date)}</p>}
                        </div>
                        <div className="relative">
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpenMenuId(openMenuId === loan.id ? null : loan.id)}><MoreHorizontal className="h-4 w-4" /></Button>
                          {openMenuId === loan.id && (
                            <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                              {!loan.is_settled && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setPaymentLoan(loan); paymentForm.reset({ amount: loan.remaining, paid_at: new Date().toISOString().split('T')[0], notes: '' }); setOpenMenuId(null) }}><ReceiptText className="h-4 w-4" />Registra pagamento</button>}
                              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50" onClick={() => openEdit(loan)}><Pencil className="h-4 w-4" />Modifica</button>
                              {!loan.is_settled && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50" onClick={() => settleLoan(loan)}><ShieldCheck className="h-4 w-4" />Segna saldato</button>}
                              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => deleteLoan(loan)}><Trash2 className="h-4 w-4" />Elimina</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>{editingLoan ? 'Modifica prestito' : 'Nuovo prestito'}</DialogTitle></DialogHeader>
          <form onSubmit={loanForm.handleSubmit(onSubmit)} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Tipo</Label><SelectField {...loanForm.register('type')}><option value="given">Dato</option><option value="received">Ricevuto</option></SelectField></div>
              <div className="space-y-2"><Label>Nome persona</Label><Input {...loanForm.register('counterpart')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Importo</Label><Input type="number" step="0.01" {...loanForm.register('amount')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
              <div className="space-y-2"><Label>Data scadenza opzionale</Label><Input type="date" {...loanForm.register('due_date')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
            </div>
            <div className="space-y-2"><Label>Descrizione</Label><Input {...loanForm.register('description')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
            <Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? 'Salvataggio...' : 'Salva prestito'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paymentLoan)} onOpenChange={(open) => !open && setPaymentLoan(null)}>
        <DialogContent className="max-w-lg border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>Registra pagamento</DialogTitle></DialogHeader>
          <form onSubmit={paymentForm.handleSubmit(onPayment)} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Importo parziale</Label><Input type="number" step="0.01" {...paymentForm.register('amount')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
              <div className="space-y-2"><Label>Data</Label><Input type="date" {...paymentForm.register('paid_at')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
            </div>
            <div className="space-y-2"><Label>Note</Label><Input {...paymentForm.register('notes')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
            <Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? 'Salvataggio...' : 'Registra pagamento'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
