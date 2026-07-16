'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
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
  Search,
  Trash2,
  Upload,
  X,
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
import {
  calculateExpenseTotal,
  calculateIncomeTotal,
  calculateNetTotal,
} from '@/domain/accounting/aggregations'
import { adaptTransactionRow, type AppTransaction } from '@/domain/accounting/transaction-adapter'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import type { CategoryTreeNode } from '@/hooks/use-categories'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import type { Account, Category, Transaction, TransactionType } from '@/types/database'

const BORDER = '#e5e7f0'
const TRANSACTION_SELECT = 'id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at'

interface ImportRow {
  date: string
  type: 'income' | 'expense'
  description: string
  categoryName: string
  amount: number
  categoryId: string | null
  valid: boolean
  error?: string
}

function parseCSV(text: string): string[][] {
  const cleaned = text.replace(/^﻿/, '')
  const rows: string[][] = []
  for (const line of cleaned.split('\n')) {
    if (!line.trim()) continue
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(current); current = ''
      } else {
        current += ch
      }
    }
    cells.push(current)
    rows.push(cells)
  }
  return rows
}

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
type TypeFilter = 'all' | 'income' | 'expense' | 'transfer'

interface TransactionWithPeer extends Transaction {
  destination_account_id?: string
  peer?: Transaction | null
  app?: AppTransaction
}

const defaultValues: TransactionForm = {
  type: 'expense',
  amount: 0,
  description: '',
  date: new Date().toLocaleDateString('en-CA'),
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
    start: start.toLocaleDateString('en-CA'),
    end: end.toLocaleDateString('en-CA'),
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

async function transactionRequest(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) {
  const response = await fetch('/api/transactions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Errore durante il salvataggio')
  }

  return payload
}

export default function TransactionsPage() {
  const supabase = createClient()
  const db = supabase
  const { accounts, refetch: refetchAccounts } = useAccounts()
  const { categories, getCategoryTree } = useCategories()
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
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [useDateRange, setUseDateRange] = useState(false)
  const [dateRangeFrom, setDateRangeFrom] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
  )
  const [dateRangeTo, setDateRangeTo] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload')
  const [importAccount, setImportAccount] = useState('')
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importBusy, setImportBusy] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const form = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema) as Resolver<TransactionForm>,
    defaultValues,
  })

  const editForm = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema) as Resolver<TransactionForm>,
    defaultValues,
  })

  const watchedType = form.watch('type')
  const watchedEditType = editForm.watch('type')
  const watchedAccount = form.watch('account_id')
  const watchedEditAccount = editForm.watch('account_id')

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const parentCategoryByChildId = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]))
    return new Map(
      categories
        .filter((category) => category.parent_id)
        .map((category) => [category.id, byId.get(category.parent_id ?? '') ?? null]),
    )
  }, [categories])

  const createCategoryTree = useMemo(
    () => (watchedType === 'transfer' ? [] : getCategoryTree(watchedType)),
    [getCategoryTree, watchedType],
  )
  const editCategoryTree = useMemo(
    () => (watchedEditType === 'transfer' ? [] : getCategoryTree(watchedEditType)),
    [getCategoryTree, watchedEditType],
  )

  const fetchTransactions = async () => {
    setLoading(true)
    const range = useDateRange
      ? { start: dateRangeFrom, end: dateRangeTo }
      : getMonthRange(selectedMonth)
    let query = db
      .from('transactions')
      .select(TRANSACTION_SELECT)
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
      const rows = (data ?? []) as TransactionWithPeer[]
      const peerIds = rows.map((row) => row.transfer_peer_id).filter(Boolean) as string[]
      const { data: peers } = peerIds.length > 0
        ? await db.from('transactions').select(TRANSACTION_SELECT).in('id', peerIds)
        : { data: [] }
      const peerRows = (peers ?? []) as Transaction[]
      const peerById = new Map(peerRows.map((peer) => [peer.id, peer]))
      const accountById = new Map(accounts.map((account) => [account.id, account]))
      setTransactions(rows.map((row): TransactionWithPeer => ({
        ...row,
        peer: row.transfer_peer_id ? peerById.get(row.transfer_peer_id) ?? null : null,
        app: adaptTransactionRow(row, {
          peerTransaction: row.transfer_peer_id ? peerById.get(row.transfer_peer_id) ?? null : null,
          sourceAccount: accountById.get(row.account_id) ?? null,
          destinationAccount: row.transfer_peer_id ? accountById.get(row.transfer_peer_id) ?? null : null,
        }),
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, typeFilter, accountFilter, useDateRange, dateRangeFrom, dateRangeTo])

  const getTransferPeer = async (transaction: Transaction) => {
    if (!transaction.transfer_peer_id) return null
    const { data } = await db
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .eq('id', transaction.transfer_peer_id)
      .maybeSingle()
    return data as Transaction | null
  }

  const onCreate: SubmitHandler<TransactionForm> = async (values) => {
    try {
      setBusy(true)
      await transactionRequest('POST', {
        account_id: values.account_id,
        destination_account_id: values.type === 'transfer' ? values.destination_account_id : undefined,
        category_id: values.type === 'transfer' || !values.category_id ? null : values.category_id,
        type: values.type,
        amount: values.amount,
        description: values.description,
        notes: values.notes || null,
        date: values.date,
      })

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

    if (transaction.app?.destinationAccountId) {
      destinationId = transaction.app.destinationAccountId
    } else if (transaction.transfer_peer_id) {
      const peer = await getTransferPeer(transaction)
      destinationId = peer?.account_id ?? ''
    }

    setEditingTransaction({ ...transaction, destination_account_id: destinationId })
    editForm.reset({
      type: transaction.app && transaction.app.transferReferenceKind !== 'none' ? 'transfer' : transaction.type,
      amount: transaction.amount,
      description: transaction.description ?? '',
      date: transaction.date,
      account_id: transaction.account_id,
      destination_account_id: destinationId,
      category_id: transaction.category_id ?? '',
      notes: transaction.notes ?? '',
    })
  }

  const deleteTransaction = async () => {
    if (!deletingTransaction) return

    try {
      setBusy(true)
      await transactionRequest('DELETE', { transaction_id: deletingTransaction.id })

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
      await transactionRequest('PATCH', {
        transaction_id: editingTransaction.id,
        account_id: values.account_id,
        destination_account_id: values.type === 'transfer' ? values.destination_account_id : null,
        category_id: values.type === 'transfer' || !values.category_id ? null : values.category_id,
        clear_category: values.type === 'transfer' || !values.category_id,
        type: values.type,
        amount: values.amount,
        description: values.description,
        notes: values.notes || null,
        date: values.date,
      })

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
    return transactions.filter((transaction) => !(transaction.app && transaction.app.transferReferenceKind !== 'none' && transaction.type === 'income'))
  }, [transactions])

  const appMonthTransactions = useMemo(
    () => monthTransactions.map((transaction) => transaction.app).filter(Boolean) as AppTransaction[],
    [monthTransactions],
  )

  const totalIncome = useMemo(
    () => calculateIncomeTotal(appMonthTransactions),
    [appMonthTransactions],
  )
  const totalExpense = useMemo(
    () => calculateExpenseTotal(appMonthTransactions),
    [appMonthTransactions],
  )
  const netTotal = useMemo(() => calculateNetTotal(appMonthTransactions), [appMonthTransactions])

  const filteredTransactions = useMemo(() => {
    let list = monthTransactions
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q),
      )
    }
    if (categoryFilters.length > 0) {
      list = list.filter((t) => {
        if (!t.category_id) return categoryFilters.includes('none')
        const parentId = categoryById.get(t.category_id)?.parent_id ?? null
        return categoryFilters.includes(t.category_id) || (parentId !== null && categoryFilters.includes(parentId))
      })
    }
    const min = parseFloat(amountMin)
    const max = parseFloat(amountMax)
    if (!isNaN(min) && amountMin !== '') list = list.filter((t) => t.amount >= min)
    if (!isNaN(max) && amountMax !== '') list = list.filter((t) => t.amount <= max)
    return list
  }, [monthTransactions, searchQuery, categoryFilters, categoryById, amountMin, amountMax])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (searchQuery.trim()) n++
    if (typeFilter !== 'all') n++
    if (accountFilter !== 'all') n++
    if (categoryFilters.length > 0) n++
    if (amountMin !== '') n++
    if (amountMax !== '') n++
    return n
  }, [searchQuery, typeFilter, accountFilter, categoryFilters, amountMin, amountMax])

  const clearAllFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
    setAccountFilter('all')
    setCategoryFilters([])
    setAmountMin('')
    setAmountMax('')
  }

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce<Record<string, TransactionWithPeer[]>>((groups, transaction) => {
      const label = dateLabel(transaction.date)
      groups[label] ??= []
      groups[label].push(transaction)
      return groups
    }, {})
  }, [filteredTransactions])

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
    categoryTree: CategoryTreeNode[],
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
              {categoryTree.map(({ category, children }) => (
                children.length > 0 ? (
                  <optgroup key={category.id} label={category.name}>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                )
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

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const allRows = parseCSV(text)
      if (allRows.length < 2) { toast.error('File CSV vuoto o non valido'); return }
      const [header, ...dataRows] = allRows
      const isSixCol = header[4]?.trim() === 'Conto' && header[5]?.trim() === 'Importo (EUR)'
      const isFiveCol = header[4]?.trim() === 'Importo (EUR)'
      const baseMatch = ['Data', 'Tipo', 'Descrizione', 'Categoria'].every((h, i) => header[i]?.trim() === h)
      if (!baseMatch || (!isFiveCol && !isSixCol)) {
        toast.error('Formato non riconosciuto. Usa il CSV esportato da Aurora.')
        return
      }
      const amtCol = isSixCol ? 5 : 4
      const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))
      const parsed: ImportRow[] = dataRows.map((row) => {
        const [dateStr, tipoStr, desc, catName] = row
        const amtStr = row[amtCol]
        const date = dateStr?.trim() ?? ''
        const typeRaw = tipoStr?.trim().toLowerCase() ?? ''
        const type: 'income' | 'expense' = typeRaw === 'entrata' ? 'income' : 'expense'
        const description = desc?.trim() ?? ''
        const categoryName = catName?.trim() ?? ''
        const amount = parseFloat((amtStr?.trim() ?? '').replace(',', '.'))
        const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
        const isValidType = typeRaw === 'entrata' || typeRaw === 'uscita'
        const isValidAmount = !isNaN(amount) && amount > 0
        const valid = isValidDate && isValidType && isValidAmount && description.length > 0
        const cat = catByName.get(categoryName.toLowerCase()) ?? null
        let error: string | undefined
        if (!isValidDate) error = 'Data non valida'
        else if (!isValidType) error = 'Tipo non valido'
        else if (!isValidAmount) error = 'Importo non valido'
        else if (!description) error = 'Descrizione mancante'
        return { date, type, description, categoryName, amount, categoryId: cat?.id ?? null, valid, error }
      })
      setImportRows(parsed)
      setImportStep('preview')
    }
    reader.readAsText(file, 'utf-8')
  }

  const doImport = async () => {
    if (!importAccount) { toast.error('Seleziona un conto'); return }
    const validRows = importRows.filter((r) => r.valid)
    if (validRows.length === 0) { toast.error('Nessuna riga valida da importare'); return }
    setImportBusy(true)
    setImportProgress(0)
    let success = 0; let errors = 0
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      try {
        await transactionRequest('POST', {
          account_id: importAccount,
          category_id: row.categoryId,
          type: row.type,
          amount: row.amount,
          description: row.description,
          date: row.date,
        })
        success++
      } catch { errors++ }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100))
    }
    setImportBusy(false)
    if (errors === 0) toast.success(`${success} transazioni importate`)
    else toast.warning(`${success} importate, ${errors} errori`)
    setImportOpen(false); setImportStep('upload'); setImportRows([]); setImportAccount('')
    await fetchTransactions(); await refetchAccounts()
  }

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
            <div className="flex items-center gap-2">
              {!useDateRange ? (
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
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-indigo-300 bg-indigo-50 px-3 py-2 shadow-sm">
                  <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
                  <input
                    type="date"
                    value={dateRangeFrom}
                    onChange={(e) => setDateRangeFrom(e.target.value)}
                    className="h-7 rounded border border-[#e5e7f0] bg-white px-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                  />
                  <span className="text-sm text-slate-400">—</span>
                  <input
                    type="date"
                    value={dateRangeTo}
                    onChange={(e) => setDateRangeTo(e.target.value)}
                    className="h-7 rounded border border-[#e5e7f0] bg-white px-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseDateRange((v) => !v)}
                className={cn('h-9 gap-1.5 text-xs', useDateRange && 'border-indigo-400 bg-indigo-50 text-indigo-700')}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {useDateRange ? 'Per mese' : 'Intervallo'}
              </Button>
            </div>
            <Button variant="outline" onClick={() => { setImportOpen(true); setImportStep('upload'); setImportRows([]) }} className="h-11 gap-2">
              <Upload className="h-4 w-4" />
              Importa CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="h-11 gap-2">
              <Plus className="h-4 w-4" />
              Nuova transazione
            </Button>
          </div>
        </header>

        <section className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per descrizione o nota..."
              className="h-11 w-full rounded-xl border border-[#e5e7f0] bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-[#e5e7f0] bg-white p-2 shadow-sm">
              <div className="flex gap-1">
                {[
                  { value: 'all', label: 'Tutte' },
                  { value: 'income', label: 'Entrate' },
                  { value: 'expense', label: 'Uscite' },
                  { value: 'transfer', label: 'Giroconti' },
                ].map((item) => (
                  <button
                    key={item.value}
                    className={cn(
                      'h-9 rounded-xl px-4 text-sm font-medium transition',
                      typeFilter === item.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                    )}
                    onClick={() => setTypeFilter(item.value as TypeFilter)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <SelectField value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="min-w-44">
              <option value="all">Tutti i conti</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </SelectField>
            <div className="relative">
              {showCatDropdown && (
                <div className="fixed inset-0 z-20" onClick={() => setShowCatDropdown(false)} />
              )}
              <button
                onClick={() => setShowCatDropdown((s) => !s)}
                className={cn(
                  'relative z-30 h-11 rounded-xl border border-[#e5e7f0] bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-indigo-400',
                  categoryFilters.length > 0 && 'border-indigo-400 bg-indigo-50 text-indigo-700',
                )}
              >
                {categoryFilters.length === 0 ? 'Tutte le categorie' : `Categorie (${categoryFilters.length})`}
              </button>
              {showCatDropdown && (
                <div className="absolute left-0 top-12 z-30 max-h-64 w-56 overflow-y-auto rounded-xl border border-[#e5e7f0] bg-white p-2 shadow-xl">
                  {([{ id: 'none', name: 'Senza categoria' }, ...categories.filter((c) => !c.parent_id)] as { id: string; name: string }[]).map((cat) => (
                    <label key={cat.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={categoryFilters.includes(cat.id)}
                        onChange={(e) => {
                          setCategoryFilters((prev) =>
                            e.target.checked ? [...prev, cat.id] : prev.filter((id) => id !== cat.id),
                          )
                        }}
                        className="h-3.5 w-3.5 accent-indigo-600"
                      />
                      <span className="text-sm text-slate-700">{cat.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder="Min"
                  className="h-11 w-28 rounded-xl border border-[#e5e7f0] bg-white pl-7 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <span className="text-sm text-slate-400">—</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  placeholder="Max"
                  className="h-11 w-28 rounded-xl border border-[#e5e7f0] bg-white pl-7 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex h-11 items-center gap-2 rounded-xl bg-indigo-50 px-4 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100"
              >
                <X className="h-4 w-4" />
                Pulisci filtri ({activeFilterCount})
              </button>
            )}
          </div>
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
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState
              icon={activeFilterCount > 0 ? Search : ArrowLeftRight}
              title={activeFilterCount > 0 ? 'Nessun risultato' : 'Nessuna transazione'}
              description={
                activeFilterCount > 0
                  ? `${activeFilterCount} ${activeFilterCount === 1 ? 'filtro attivo' : 'filtri attivi'} — prova a modificarli o rimuoverli.`
                  : 'Aggiungi entrate, uscite o trasferimenti per iniziare a tracciare il mese.'
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" onClick={clearAllFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    Rimuovi tutti i filtri
                  </Button>
                ) : (
                  <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuova transazione
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([label, items]) => (
              <section key={label} className="space-y-3">
                <h2 className="text-sm font-semibold capitalize text-slate-500">{label}</h2>
                <div className="rounded-2xl border border-[#e5e7f0] bg-white shadow-sm">
                  {items.map((transaction) => {
                    const account = accountById.get(transaction.account_id)
                    const category = transaction.category_id ? categoryById.get(transaction.category_id) : null
                    const parentCategory = category ? parentCategoryByChildId.get(category.id) : null
                    const isTransfer = transaction.app ? transaction.app.transferReferenceKind !== 'none' : transaction.type === 'transfer'
                    const isIncome = transaction.type === 'income' && !isTransfer
                    const isExpense = transaction.type === 'expense' && !isTransfer
                    const peerAccount = transaction.app?.destinationAccountId
                      ? accountById.get(transaction.app.destinationAccountId)
                      : null
                    const Icon = isTransfer ? ArrowLeftRight : isIncome ? ArrowDownLeft : ArrowUpRight

                    return (
                      <div key={transaction.id} className="relative flex items-center justify-between gap-4 border-b border-[#e5e7f0] px-4 py-4 last:border-b-0 first:rounded-t-2xl last:rounded-b-2xl hover:bg-slate-50/80">
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
                              {transaction.description || (isTransfer ? 'Giroconto' : 'Transazione')}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {isTransfer
                                ? `${account?.name ?? 'Conto'} → ${peerAccount?.name ?? 'Conto destinazione'}`
                                : `${category?.name ?? 'Senza categoria'} · ${account?.name ?? 'Conto'}`} · {format(parseISO(transaction.date), 'dd/MM/yyyy')}
                            </p>
                            {!isTransfer && parentCategory && (
                              <p className="mt-0.5 truncate text-xs text-slate-400">{parentCategory.name}</p>
                            )}
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
          {renderTransactionForm(form, 'Salva transazione', onCreate, watchedType, watchedAccount, createCategoryTree)}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingTransaction)} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Modifica transazione</DialogTitle>
          </DialogHeader>
          {renderTransactionForm(editForm, 'Salva modifiche', onEdit, watchedEditType, watchedEditAccount, editCategoryTree)}
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

      <Dialog open={importOpen} onOpenChange={(open) => { if (!importBusy) setImportOpen(open) }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Importa transazioni da CSV</DialogTitle>
          </DialogHeader>

          {importStep === 'upload' && (
            <div className="mt-4 space-y-5">
              <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-6 text-center">
                <Upload className="mx-auto mb-3 h-8 w-8 text-indigo-400" />
                <p className="text-sm font-medium text-slate-700">Seleziona un file CSV</p>
                <p className="mt-1 text-xs text-slate-400">Usa il formato esportato da Aurora (Report → Esporta CSV)</p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="mt-4 block w-full cursor-pointer text-sm text-slate-500 file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-600 hover:file:bg-indigo-100"
                  onChange={handleImportFile}
                />
              </div>
              <div className="rounded-2xl border border-[#e5e7f0] bg-white p-4 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-700">Formato atteso:</p>
                <p className="font-mono">Data,Tipo,Descrizione,Categoria,Importo (EUR)</p>
                <p className="font-mono text-slate-400">2024-01-15,Uscita,"Spesa supermercato","Alimentari",45.80</p>
              </div>
            </div>
          )}

          {importStep === 'preview' && (
            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-700">Conto di destinazione</Label>
                <SelectField value={importAccount} onChange={(e) => setImportAccount(e.target.value)}>
                  <option value="">Seleziona un conto...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </SelectField>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">
                  Anteprima — {importRows.filter((r) => r.valid).length} righe valide
                  {importRows.some((r) => !r.valid) && (
                    <span className="ml-2 text-red-500">· {importRows.filter((r) => !r.valid).length} non valide (saltate)</span>
                  )}
                </p>
                <div className="max-h-72 overflow-y-auto rounded-2xl border border-[#e5e7f0]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-[#e5e7f0] text-left">
                        <th className="px-3 py-2 font-medium text-slate-500">Data</th>
                        <th className="px-3 py-2 font-medium text-slate-500">Tipo</th>
                        <th className="px-3 py-2 font-medium text-slate-500">Descrizione</th>
                        <th className="px-3 py-2 font-medium text-slate-500 text-right">Importo</th>
                        <th className="px-3 py-2 font-medium text-slate-500">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row, i) => (
                        <tr key={i} className={cn('border-b border-[#e5e7f0] last:border-0', !row.valid && 'bg-red-50/50')}>
                          <td className="px-3 py-2 tabular-nums text-slate-700">{row.date}</td>
                          <td className="px-3 py-2">
                            <span className={cn('rounded-full px-2 py-0.5 font-medium', row.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                              {row.type === 'income' ? 'Entrata' : 'Uscita'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            <p className="max-w-36 truncate">{row.description}</p>
                            {row.categoryName && <p className="text-slate-400">{row.categoryName}{!row.categoryId && ' ⚠ non trovata'}</p>}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-right font-medium text-slate-900">{row.amount.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            {row.valid
                              ? <span className="text-emerald-600">✓</span>
                              : <span className="text-red-500" title={row.error}>✗ {row.error}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {importBusy && (
                <div className="space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${importProgress}%` }} />
                  </div>
                  <p className="text-center text-xs text-slate-400">{importProgress}%</p>
                </div>
              )}

              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setImportStep('upload')} disabled={importBusy}>
                  Indietro
                </Button>
                <Button onClick={doImport} disabled={importBusy || !importAccount || importRows.filter((r) => r.valid).length === 0} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {importBusy ? `Importazione... ${importProgress}%` : `Importa ${importRows.filter((r) => r.valid).length} transazioni`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
