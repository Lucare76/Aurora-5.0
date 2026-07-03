'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import type { Account, Category, Transaction, TransactionType } from '@/types/database'

const BORDER = '#e5e7f0'

const transactionSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.coerce.number({ error: 'Inserisci un importo valido' }).positive('L’importo deve essere positivo'),
    description: z.string().trim().min(1, 'La descrizione è obbligatoria'),
    date: z.string().min(1, 'La data è obbligatoria'),
    account_id: z.string().min(1, 'Seleziona un conto'),
    destination_account_id: z.string().optional(),
    category_id: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.type !== 'transfer' || Boolean(data.destination_account_id), {
    message: 'Seleziona il conto di destinazione',
    path: ['destination_account_id'],
  })
  .refine((data) => data.type !== 'transfer' || data.account_id !== data.destination_account_id, {
    message: 'Il conto di destinazione deve essere diverso',
    path: ['destination_account_id'],
  })

type TransactionForm = z.infer<typeof transactionSchema>
type TypeFilter = 'all' | 'income' | 'expense'

interface TransactionWithPeer extends Transaction {
  destination_account_id?: string
}

const defaultValues: TransactionForm = {
  type: 'expense',
  amount: 0,
  description: '',
  date: new Date().toISOString().split('T')[0],
  account_id: '',
  destination_account_id: '',
  category_id: '',
  notes: '',
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100',
        props.className,
      )}
      style={{ borderColor: BORDER }}
    />
  )
}

function TextareaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'min-h-24 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100',
        props.className,
      )}
      style={{ borderColor: BORDER }}
    />
  )
}

function transactionDelta(type: TransactionType, amount: number) {
  if (type === 'income') return amount
  if (type === 'expense') return -amount
  return -amount
}

function dateLabel(date: string) {
  const parsed = parseISO(date)
  if (isToday(parsed)) return 'Oggi'
  if (isYesterday(parsed)) return 'Ieri'
  return format(parsed, 'EEEE d MMMM', { locale: it })
}

function monthLabel(date: Date) {
  return format(date, 'MMMM yyyy', { locale: it })
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function TransactionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />
      ))}
    </div>
  )
}

export default function TransactionsPage() {
  const supabase = createClient()
  const db = supabase as any
  const { accounts, refetch: refetchAccounts } = useAccounts()
  const { categories } = useCategories()
  const [transactions, setTransactions] = useState<TransactionWithPeer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithPeer | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionWithPeer | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const form = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues,
  })

  const editForm = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues,
  })

  const watchedType = form.watch('type')
  const watchedEditType = editForm.watch('type')
  const watchedAccount = form.watch('account_id')
  const watchedEditAccount = editForm.watch('account_id')

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])

  const filteredCreateCategories = useMemo(
    () => categories.filter((category) => category.type === watchedType || category.type === 'both'),
    [categories, watchedType],
  )
  const filteredEditCategories = useMemo(
    () => categories.filter((category) => category.type === watchedEditType || category.type === 'both'),
    [categories, watchedEditType],
  )

  const fetchTransactions = async () => {
    setLoading(true)
    const range = getMonthRange(selectedMonth)
    let query = db
      .from('transactions')
      .select('*')
      .gte('date', range.start)
      .lte('date', range.end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (typeFilter !== 'all') query = query.eq('type', typeFilter)
    if (accountFilter !== 'all') query = query.eq('account_id', accountFilter)

    const { data, error } = await query
    if (error) {
      toast.error('Errore nel caricamento delle transazioni')
      setTransactions([])
    } else {
      setTransactions((data ?? []) as TransactionWithPeer[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, typeFilter, accountFilter])

  const adjustBalance = async (accountId: string, delta: number) => {
    if (delta === 0) return
    const { error } = await db.rpc('adjust_account_balance', {
      p_account_id: accountId,
      p_delta: delta,
    })
    if (error) throw error
  }

  const getTransferPeer = async (transaction: Transaction) => {
    if (transaction.type !== 'transfer') return null

    if (transaction.transfer_peer_id) {
      const { data } = await db
        .from('transactions')
        .select('*')
        .eq('id', transaction.transfer_peer_id)
        .maybeSingle()
      return data as Transaction | null
    }

    const { data } = await db
      .from('transactions')
      .select('*')
      .eq('transfer_peer_id', transaction.id)
      .maybeSingle()
    return data as Transaction | null
  }

  const createTransfer = async (values: TransactionForm) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')
    if (!values.destination_account_id) throw new Error('Seleziona il conto di destinazione')

    const basePayload = {
      user_id: user.id,
      category_id: null,
      type: 'transfer' as TransactionType,
      amount: values.amount,
      description: values.description,
      notes: values.notes || null,
      date: values.date,
      recurring_id: null,
      receipt_url: null,
      receipt_data: null,
    }

    const { data: sourceTransaction, error: sourceError } = await db
      .from('transactions')
      .insert({
        ...basePayload,
        account_id: values.account_id,
        transfer_peer_id: null,
      })
      .select('*')
      .single()
    if (sourceError) throw sourceError

    const { data: destinationTransaction, error: destinationError } = await db
      .from('transactions')
      .insert({
        ...basePayload,
        account_id: values.destination_account_id,
        transfer_peer_id: sourceTransaction.id,
      })
      .select('*')
      .single()
    if (destinationError) throw destinationError

    const { error: peerError } = await db
      .from('transactions')
      .update({ transfer_peer_id: destinationTransaction.id })
      .eq('id', sourceTransaction.id)
    if (peerError) throw peerError

    await adjustBalance(values.account_id, -values.amount)
    await adjustBalance(values.destination_account_id, values.amount)
  }

  const onCreate: SubmitHandler<TransactionForm> = async (values) => {
    try {
      setBusy(true)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

      if (values.type === 'transfer') {
        await createTransfer(values)
      } else {
        const { error } = await db.from('transactions').insert({
          user_id: user.id,
          account_id: values.account_id,
          category_id: values.category_id || null,
          type: values.type,
          amount: values.amount,
          description: values.description,
          notes: values.notes || null,
          date: values.date,
          transfer_peer_id: null,
          recurring_id: null,
          receipt_url: null,
          receipt_data: null,
        })
        if (error) throw error
        await adjustBalance(values.account_id, transactionDelta(values.type, values.amount))
      }

      toast.success('Transazione creata')
      form.reset(defaultValues)
      setCreateOpen(false)
      await fetchTransactions()
      await refetchAccounts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il salvataggio')
    } finally {
      setBusy(false)
    }
  }

  const openEdit = async (transaction: TransactionWithPeer) => {
    setOpenMenuId(null)
    let destinationId = transaction.destination_account_id ?? ''

    if (transaction.type === 'transfer') {
      const peer = await getTransferPeer(transaction)
      destinationId = peer?.account_id ?? ''
    }

    setEditingTransaction({ ...transaction, destination_account_id: destinationId })
    editForm.reset({
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description ?? '',
      date: transaction.date,
      account_id: transaction.account_id,
      destination_account_id: destinationId,
      category_id: transaction.category_id ?? '',
      notes: transaction.notes ?? '',
    })
  }

  const reverseTransactionBalance = async (transaction: Transaction) => {
    if (transaction.type !== 'transfer') {
      await adjustBalance(transaction.account_id, -transactionDelta(transaction.type, transaction.amount))
      return
    }

    const peer = await getTransferPeer(transaction)
    await adjustBalance(transaction.account_id, transaction.amount)
    if (peer) await adjustBalance(peer.account_id, -transaction.amount)
  }

  const deleteTransaction = async () => {
    if (!deletingTransaction) return

    try {
      setBusy(true)
      const peer = await getTransferPeer(deletingTransaction)
      await reverseTransactionBalance(deletingTransaction)

      if (peer) {
        const { error: peerError } = await db.from('transactions').delete().eq('id', peer.id)
        if (peerError) throw peerError
      }

      const { error } = await db.from('transactions').delete().eq('id', deletingTransaction.id)
      if (error) throw error

      toast.success('Transazione eliminata')
      setDeletingTransaction(null)
      await fetchTransactions()
      await refetchAccounts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l’eliminazione')
    } finally {
      setBusy(false)
    }
  }

  const onEdit: SubmitHandler<TransactionForm> = async (values) => {
    if (!editingTransaction) return

    try {
      setBusy(true)
      await reverseTransactionBalance(editingTransaction)

      if (editingTransaction.type === 'transfer') {
        const oldPeer = await getTransferPeer(editingTransaction)
        if (oldPeer) await db.from('transactions').delete().eq('id', oldPeer.id)
      }

      const { error } = await db.from('transactions').delete().eq('id', editingTransaction.id)
      if (error) throw error

      if (values.type === 'transfer') {
        await createTransfer(values)
      } else {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

        const { error: insertError } = await db.from('transactions').insert({
          user_id: user.id,
          account_id: values.account_id,
          category_id: values.category_id || null,
          type: values.type,
          amount: values.amount,
          description: values.description,
          notes: values.notes || null,
          date: values.date,
          transfer_peer_id: null,
          recurring_id: null,
          receipt_url: null,
          receipt_data: null,
        })
        if (insertError) throw insertError
        await adjustBalance(values.account_id, transactionDelta(values.type, values.amount))
      }

      toast.success('Transazione aggiornata')
      setEditingTransaction(null)
      await fetchTransactions()
      await refetchAccounts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante la modifica')
    } finally {
      setBusy(false)
    }
  }

  const monthTransactions = useMemo(() => {
    return transactions.filter((transaction) => transaction.type !== 'transfer' || !transaction.transfer_peer_id)
  }, [transactions])

  const totalIncome = useMemo(
    () => monthTransactions.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0),
    [monthTransactions],
  )
  const totalExpense = useMemo(
    () => monthTransactions.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0),
    [monthTransactions],
  )
  const netTotal = totalIncome - totalExpense

  const groupedTransactions = useMemo(() => {
    return monthTransactions.reduce<Record<string, TransactionWithPeer[]>>((groups, transaction) => {
      const label = dateLabel(transaction.date)
      groups[label] ??= []
      groups[label].push(transaction)
      return groups
    }, {})
  }, [monthTransactions])

  const renderTypeToggle = (targetForm: typeof form) => {
    const currentType = targetForm.watch('type')
    return (
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
        {[
          { value: 'income', label: 'Entrata', icon: ArrowDownLeft },
          { value: 'expense', label: 'Uscita', icon: ArrowUpRight },
          { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => targetForm.setValue('type', item.value as TransactionType, { shouldValidate: true })}
            className={cn(
              'flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition',
              currentType === item.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>
    )
  }

  const renderTransactionForm = (
    targetForm: typeof form,
    submitLabel: string,
    onSubmit: SubmitHandler<TransactionForm>,
    selectedType: TransactionType,
    selectedAccount: string,
    filteredCategories: Category[],
  ) => (
    <form onSubmit={targetForm.handleSubmit(onSubmit)} className="mt-6 space-y-5">
      {renderTypeToggle(targetForm)}

      <div className="space-y-2 text-center">
        <Label className="text-slate-600">Importo</Label>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          {...targetForm.register('amount')}
          className="h-20 border-[#e5e7f0] bg-white text-center text-4xl font-semibold tabular-nums text-slate-950 placeholder:text-slate-300"
          placeholder="0,00"
        />
        {targetForm.formState.errors.amount && (
          <p className="text-sm text-red-600">{targetForm.formState.errors.amount.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-slate-700">Descrizione</Label>
          <Input
            {...targetForm.register('description')}
            placeholder="Es. Spesa supermercato"
            className="h-11 border-[#e5e7f0] bg-white text-slate-900 placeholder:text-slate-400"
          />
          {targetForm.formState.errors.description && (
            <p className="text-sm text-red-600">{targetForm.formState.errors.description.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700">Data</Label>
          <Input
            type="date"
            {...targetForm.register('date')}
            className="h-11 border-[#e5e7f0] bg-white text-slate-900"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-slate-700">{selectedType === 'transfer' ? 'Conto da' : 'Conto'}</Label>
          <SelectField {...targetForm.register('account_id')}>
            <option value="">Seleziona conto</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </SelectField>
          {targetForm.formState.errors.account_id && (
            <p className="text-sm text-red-600">{targetForm.formState.errors.account_id.message}</p>
          )}
        </div>

        {selectedType === 'transfer' ? (
          <div className="space-y-2">
            <Label className="text-slate-700">Conto a</Label>
            <SelectField {...targetForm.register('destination_account_id')}>
              <option value="">Seleziona conto</option>
              {accounts
                .filter((account) => account.id !== selectedAccount)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </SelectField>
            {targetForm.formState.errors.destination_account_id && (
              <p className="text-sm text-red-600">{targetForm.formState.errors.destination_account_id.message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-slate-700">Categoria</Label>
            <SelectField {...targetForm.register('category_id')}>
              <option value="">Nessuna categoria</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-slate-700">Note</Label>
        <TextareaField {...targetForm.register('notes')} placeholder="Aggiungi una nota opzionale" />
      </div>

      <Button type="submit" className="h-12 w-full" disabled={busy || targetForm.formState.isSubmitting}>
        {busy || targetForm.formState.isSubmitting ? 'Salvataggio...' : submitLabel}
      </Button>
    </form>
  )

  const shiftMonth = (delta: number) => {
    setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-medium text-indigo-600">Movimenti</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Transazioni</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-2xl border border-[#e5e7f0] bg-white p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex min-w-44 items-center justify-center gap-2 px-3 text-sm font-semibold capitalize text-slate-800">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                {monthLabel(selectedMonth)}
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="h-11 gap-2">
              <Plus className="h-4 w-4" />
              Nuova transazione
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="rounded-2xl border border-[#e5e7f0] bg-white p-2 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'all', label: 'Tutte' },
                { value: 'income', label: 'Entrate' },
                { value: 'expense', label: 'Uscite' },
              ].map((item) => (
                <button
                  key={item.value}
                  className={cn(
                    'h-10 rounded-xl text-sm font-medium transition',
                    typeFilter === item.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                  )}
                  onClick={() => setTypeFilter(item.value as TypeFilter)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <SelectField value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="min-w-56">
            <option value="all">Tutti i conti</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </SelectField>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Entrate mese</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-emerald-600">{formatCurrency(totalIncome)}</p>
            </CardContent>
          </Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Uscite mese</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-red-600">{formatCurrency(totalExpense)}</p>
            </CardContent>
          </Card>
          <Card className="border-[#e5e7f0] bg-gradient-to-br from-indigo-50 to-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Saldo netto</p>
              <p className={cn('mt-3 text-3xl font-semibold tabular-nums', netTotal >= 0 ? 'text-indigo-600' : 'text-red-600')}>
                {formatCurrency(netTotal)}
              </p>
            </CardContent>
          </Card>
        </section>

        {loading ? (
          <TransactionSkeleton />
        ) : monthTransactions.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState
              icon={ArrowLeftRight}
              title="Nessuna transazione"
              description="Aggiungi entrate, uscite o trasferimenti per iniziare a tracciare il mese."
              action={
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuova transazione
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([label, items]) => (
              <section key={label} className="space-y-3">
                <h2 className="text-sm font-semibold capitalize text-slate-500">{label}</h2>
                <div className="overflow-hidden rounded-2xl border border-[#e5e7f0] bg-white shadow-sm">
                  {items.map((transaction) => {
                    const account = accountById.get(transaction.account_id)
                    const category = transaction.category_id ? categoryById.get(transaction.category_id) : null
                    const isIncome = transaction.type === 'income'
                    const isExpense = transaction.type === 'expense'
                    const Icon = isIncome ? ArrowDownLeft : isExpense ? ArrowUpRight : ArrowLeftRight

                    return (
                      <div key={transaction.id} className="relative flex items-center justify-between gap-4 border-b border-[#e5e7f0] px-4 py-4 last:border-b-0 hover:bg-slate-50/80">
                        <div className="flex min-w-0 items-center gap-4">
                          <div
                            className={cn(
                              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                              isIncome ? 'bg-emerald-50 text-emerald-600' : isExpense ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600',
                            )}
                            style={category?.color ? { color: category.color, backgroundColor: `${category.color}18` } : undefined}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {transaction.description || 'Transazione'}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {category?.name ?? (transaction.type === 'transfer' ? 'Trasferimento' : 'Senza categoria')} · {account?.name ?? 'Conto'} · {format(parseISO(transaction.date), 'dd/MM/yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <AmountDisplay
                            amount={transaction.amount}
                            type={isIncome ? 'income' : isExpense ? 'expense' : 'neutral'}
                            className="text-sm font-semibold"
                          />
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => setOpenMenuId(openMenuId === transaction.id ? null : transaction.id)}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            {openMenuId === transaction.id && (
                              <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                                <button
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  onClick={() => openEdit(transaction)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Modifica
                                </button>
                                <button
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setDeletingTransaction(transaction)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Elimina
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Nuova transazione</DialogTitle>
          </DialogHeader>
          {renderTransactionForm(form, 'Salva transazione', onCreate, watchedType, watchedAccount, filteredCreateCategories)}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingTransaction)} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Modifica transazione</DialogTitle>
          </DialogHeader>
          {renderTransactionForm(editForm, 'Salva modifiche', onEdit, watchedEditType, watchedEditAccount, filteredEditCategories)}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingTransaction)} onOpenChange={(open) => !open && setDeletingTransaction(null)}>
        <DialogContent className="max-w-md border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Elimina transazione</DialogTitle>
          </DialogHeader>
          <div className="mt-5 space-y-5">
            <p className="text-sm leading-6 text-slate-600">
              Vuoi eliminare definitivamente questa transazione? Il saldo del conto verrà aggiornato automaticamente in direzione inversa.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingTransaction(null)}>
                Annulla
              </Button>
              <Button variant="destructive" onClick={deleteTransaction} disabled={busy}>
                Elimina
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
