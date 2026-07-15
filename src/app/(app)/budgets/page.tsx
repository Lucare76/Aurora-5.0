'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import { useCategories } from '@/hooks/use-categories'
import type { Budget, Transaction } from '@/types/database'

const BORDER = '#e5e7f0'

const budgetSchema = z.object({
  category_id: z.string().min(1, 'Seleziona una categoria'),
  amount: z.coerce.number({ error: 'Inserisci un importo valido' }).positive('L’importo deve essere positivo'),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
})

type BudgetForm = z.infer<typeof budgetSchema>

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

function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    start: start.toLocaleDateString('en-CA'),
    end: end.toLocaleDateString('en-CA'),
  }
}

function progressTone(percent: number) {
  if (percent >= 100) return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' }
  if (percent >= 80) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' }
}

export default function BudgetsPage() {
  const supabase = createClient()
  const db = supabase
  const { categories } = useCategories()
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const range = useMemo(() => monthRange(selectedMonth), [selectedMonth])
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense' || category.type === 'both'),
    [categories],
  )
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])

  const form = useForm<BudgetForm>({
    resolver: zodResolver(budgetSchema) as Resolver<BudgetForm>,
    defaultValues: { category_id: '', amount: 0, month: range.month, year: range.year },
  })

  const fetchData = async () => {
    setLoading(true)
    const [{ data: budgetRows, error: budgetError }, { data: transactionRows, error: transactionError }] = await Promise.all([
      db.from('budgets').select('*').eq('month', range.month).eq('year', range.year),
      db
        .from('transactions')
        .select('*')
        .eq('type', 'expense')
        .gte('date', range.start)
        .lte('date', range.end),
    ])

    if (budgetError || transactionError) {
      toast.error('Errore nel caricamento dei budget')
    }

    setBudgets((budgetRows ?? []) as Budget[])
    setTransactions((transactionRows ?? []) as Transaction[])
    setLoading(false)
  }

  useEffect(() => {
    form.reset({ category_id: '', amount: 0, month: range.month, year: range.year })
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.month, range.year])

  const spentByCategory = useMemo(() => {
    return transactions.reduce<Record<string, number>>((totals, transaction) => {
      if (!transaction.category_id || transaction.transfer_peer_id) return totals
      totals[transaction.category_id] = (totals[transaction.category_id] ?? 0) + transaction.amount
      return totals
    }, {})
  }, [transactions])

  const totals = useMemo(() => {
    const budgetTotal = budgets.reduce((sum, budget) => sum + budget.amount, 0)
    const spentTotal = budgets.reduce((sum, budget) => sum + (spentByCategory[budget.category_id] ?? 0), 0)
    return { budgetTotal, spentTotal, remaining: budgetTotal - spentTotal }
  }, [budgets, spentByCategory])

  const atRiskBudgets = useMemo(() => {
    return budgets
      .filter((b) => {
        const spent = spentByCategory[b.category_id] ?? 0
        return b.amount > 0 && spent / b.amount >= 0.8
      })
      .map((b) => ({
        name: categoryById.get(b.category_id)?.name ?? 'Categoria',
        percent: Math.round(((spentByCategory[b.category_id] ?? 0) / b.amount) * 100),
      }))
      .sort((a, b) => b.percent - a.percent)
  }, [budgets, spentByCategory, categoryById])

  const onSubmit: SubmitHandler<BudgetForm> = async (values) => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

      const { error } = await db.from('budgets').upsert({
        user_id: user.id,
        category_id: values.category_id,
        amount: values.amount,
        month: values.month,
        year: values.year,
      }, { onConflict: 'user_id,category_id,month,year' })

      if (error) throw error
      toast.success('Budget salvato')
      setDialogOpen(false)
      form.reset({ category_id: '', amount: 0, month: range.month, year: range.year })
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il salvataggio del budget')
    }
  }

  const openEdit = (budget: Budget) => {
    setOpenMenuId(null)
    setEditingBudget(budget)
    form.reset({ category_id: budget.category_id, amount: budget.amount, month: budget.month, year: budget.year })
    setDialogOpen(true)
  }

  const deleteBudget = async (budget: Budget) => {
    try {
      const { error } = await db.from('budgets').delete().eq('id', budget.id)
      if (error) throw error
      toast.success('Budget eliminato')
      setOpenMenuId(null)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l\'eliminazione')
    }
  }

  const shiftMonth = (delta: number) => {
    setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-medium text-indigo-600">Pianificazione</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Budget</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center rounded-2xl border border-[#e5e7f0] bg-white p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex min-w-44 items-center justify-center gap-2 px-3 text-sm font-semibold capitalize">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                {format(selectedMonth, 'MMMM yyyy', { locale: it })}
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => { setEditingBudget(null); form.reset({ category_id: '', amount: 0, month: range.month, year: range.year }); setDialogOpen(true) }} className="h-11 gap-2">
              <Plus className="h-4 w-4" />
              Nuovo budget
            </Button>
          </div>
        </header>

        {!loading && atRiskBudgets.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">
                {atRiskBudgets.length === 1 ? '1 categoria vicina' : `${atRiskBudgets.length} categorie vicine`} o oltre il limite:
              </span>{' '}
              {atRiskBudgets.map((b, i) => (
                <span key={i}>
                  {b.name} <span className="font-semibold">({b.percent}%)</span>
                  {i < atRiskBudgets.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Budget totale mese</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums">{formatCurrency(totals.budgetTotal)}</p>
            </CardContent>
          </Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Speso totale</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-red-600">{formatCurrency(totals.spentTotal)}</p>
            </CardContent>
          </Card>
          <Card className="border-[#e5e7f0] bg-gradient-to-br from-indigo-50 to-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Rimanente</p>
              <p className={cn('mt-3 text-3xl font-semibold tabular-nums', totals.remaining >= 0 ? 'text-indigo-600' : 'text-red-600')}>
                {formatCurrency(totals.remaining)}
              </p>
            </CardContent>
          </Card>
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState
              icon={PiggyBank}
              title="Nessun budget"
              description="Imposta il primo limite mensile per controllare le spese per categoria."
              action={
                <Button onClick={() => { setEditingBudget(null); setDialogOpen(true) }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Crea budget
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {budgets.map((budget) => {
              const category = categoryById.get(budget.category_id)
              const spent = spentByCategory[budget.category_id] ?? 0
              const percent = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0
              const tone = progressTone(percent)

              return (
                <Card key={budget.id} className="border-[#e5e7f0] bg-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: category?.color ?? '#6366f1' }}
                          />
                          <h2 className="font-semibold text-slate-950">{category?.name ?? 'Categoria'}</h2>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {formatCurrency(spent)} spesi su {formatCurrency(budget.amount)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn('rounded-full px-3 py-1 text-sm font-semibold tabular-nums', tone.bg, tone.text)}>
                          {percent}%
                        </span>
                        <div className="relative">
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpenMenuId(openMenuId === budget.id ? null : budget.id)}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {openMenuId === budget.id && (
                            <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => openEdit(budget)}>
                                <Pencil className="h-4 w-4" />
                                Modifica
                              </button>
                              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => deleteBudget(budget)}>
                                <Trash2 className="h-4 w-4" />
                                Elimina
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn('h-full rounded-full transition-all', tone.bar)}
                        style={{ width: `${Math.min(percent, 140)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingBudget(null) }}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Modifica budget' : 'Nuovo budget'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-700">Categoria</Label>
              <SelectField {...form.register('category_id')} disabled={Boolean(editingBudget)}>
                <option value="">Seleziona categoria</option>
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectField>
              {form.formState.errors.category_id && (
                <p className="text-sm text-red-600">{form.formState.errors.category_id.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Importo</Label>
              <Input
                type="number"
                step="0.01"
                {...form.register('amount')}
                className="h-14 border-[#e5e7f0] bg-white text-2xl font-semibold tabular-nums text-slate-950"
              />
            </div>
            {!editingBudget && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-700">Mese</Label>
                  <Input type="number" min={1} max={12} {...form.register('month')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">Anno</Label>
                  <Input type="number" {...form.register('year')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
                </div>
              </div>
            )}
            <Button type="submit" className="h-12 w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvataggio...' : editingBudget ? 'Salva modifiche' : 'Salva budget'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
