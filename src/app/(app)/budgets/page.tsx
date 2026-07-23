'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertTriangle, ArrowRight, BarChart2, CalendarDays, ChevronLeft, ChevronRight,
  Lightbulb, MoreHorizontal, Pencil, PiggyBank, Plus, TrendingDown, TrendingUp, Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { useCategories } from '@/hooks/use-categories'
import { cn, formatCurrency } from '@/lib/utils'
import type { BudgetInsight, BudgetStatus, EnrichedBudgetEntry } from '@/lib/budgets/service'

// ── Schema ─────────────────────────────────────────────────────────────────

const createSchema = z.object({
  categoryId: z.string().min(1, 'Seleziona una categoria'),
  amount: z.coerce.number({ message: 'Importo non valido' }).positive('L\'importo deve essere positivo'),
})

const editSchema = z.object({
  amount: z.coerce.number({ message: 'Importo non valido' }).positive('L\'importo deve essere positivo'),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm   = z.infer<typeof editSchema>

// ── Helpers ────────────────────────────────────────────────────────────────

function statusTone(status: BudgetStatus) {
  switch (status) {
    case 'exceeded': return { bar: 'bg-red-500',    text: 'text-red-600',    badge: 'bg-red-100 text-red-700',      label: 'Sforato' }
    case 'critical': return { bar: 'bg-orange-500', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', label: 'Critico' }
    case 'warning':  return { bar: 'bg-amber-500',  text: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700',  label: 'Attenzione' }
    default:         return { bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Ok' }
  }
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-11 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100',
        props.className,
      )}
    />
  )
}

function InsightRow({ insight }: { insight: BudgetInsight }) {
  const isPositive = insight.type === 'spending_down_vs_last_month' || insight.type === 'consistently_within_budget' || insight.type === 'best_month_in_period'
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium', isPositive ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{insight.message}</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { categories } = useCategories()
  const [selectedMonth, setSelectedMonth]     = useState(new Date())
  const [entries, setEntries]                 = useState<EnrichedBudgetEntry[]>([])
  const [insights, setInsights]               = useState<BudgetInsight[]>([])
  const [loading, setLoading]                 = useState(true)
  const [openMenuId, setOpenMenuId]           = useState<string | null>(null)
  const [createOpen, setCreateOpen]           = useState(false)
  const [editEntry, setEditEntry]             = useState<EnrichedBudgetEntry | null>(null)
  const [deleteEntry, setDeleteEntry]         = useState<EnrichedBudgetEntry | null>(null)
  const [deleting, setDeleting]               = useState(false)

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' || c.type === 'both'),
    [categories],
  )

  const budgetedCatIds = useMemo(
    () => new Set(entries.map((e) => e.categoryId)),
    [entries],
  )

  const totals = useMemo(() => {
    const totalAmount     = entries.reduce((s, e) => s + e.amount, 0)
    const totalSpent      = entries.reduce((s, e) => s + e.spent, 0)
    const totalRemaining  = entries.reduce((s, e) => s + e.remaining, 0)
    const atRiskCount     = entries.filter((e) => e.status !== 'safe').length
    const exceededCount   = entries.filter((e) => e.status === 'exceeded').length
    const projectedOverrun = entries.reduce((s, e) => s + (e.forecast?.projectedOverrun ?? 0), 0)
    return { totalAmount, totalSpent, totalRemaining, atRiskCount, exceededCount, projectedOverrun }
  }, [entries])

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        year:     String(selectedMonth.getFullYear()),
        month:    String(selectedMonth.getMonth() + 1),
        enriched: '1',
      })
      const res = await fetch(`/api/budgets?${p}`)
      if (!res.ok) { toast.error('Errore caricamento budget'); return }
      const body = await res.json() as { data: EnrichedBudgetEntry[]; insights?: BudgetInsight[] }
      setEntries(body.data ?? [])
      setInsights(body.insights ?? [])
    } catch {
      toast.error('Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // ── Create ───────────────────────────────────────────────────────────────

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema) as Resolver<CreateForm>,
    defaultValues: { categoryId: '', amount: 0 },
  })

  const onCreateSubmit: SubmitHandler<CreateForm> = async (values) => {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: values.categoryId,
        year:  selectedMonth.getFullYear(),
        month: selectedMonth.getMonth() + 1,
        amount: values.amount,
      }),
    })
    if (res.status === 409) { toast.error('Esiste già un budget per questa categoria nel mese'); return }
    if (!res.ok) { toast.error('Errore durante il salvataggio'); return }
    toast.success('Budget creato')
    setCreateOpen(false)
    createForm.reset()
    await fetchEntries()
  }

  // ── Edit ─────────────────────────────────────────────────────────────────

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema) as Resolver<EditForm>,
    defaultValues: { amount: 0 },
  })

  const openEdit = (entry: EnrichedBudgetEntry) => {
    setOpenMenuId(null)
    setEditEntry(entry)
    editForm.reset({ amount: entry.amount })
  }

  const onEditSubmit: SubmitHandler<EditForm> = async (values) => {
    if (!editEntry) return
    const res = await fetch(`/api/budgets/${editEntry.budgetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: values.amount }),
    })
    if (!res.ok) { toast.error('Errore durante il salvataggio'); return }
    toast.success('Budget aggiornato')
    setEditEntry(null)
    await fetchEntries()
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteEntry) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/budgets/${deleteEntry.budgetId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Errore durante l\'eliminazione'); return }
      toast.success('Budget eliminato')
      setDeleteEntry(null)
      await fetchEntries()
    } finally {
      setDeleting(false)
    }
  }

  const shiftMonth = (delta: number) => {
    setSelectedMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + delta, 1))
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-indigo-600">Pianificazione</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Budget</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Monitora quanto hai speso rispetto all&apos;obiettivo mensile.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-2xl border border-[#e5e7f0] bg-white p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex min-w-36 items-center justify-center gap-2 px-3 text-sm font-semibold capitalize sm:min-w-44">
                <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
                {format(selectedMonth, 'MMMM yyyy', { locale: it })}
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={() => { createForm.reset({ categoryId: '', amount: 0 }); setCreateOpen(true) }}
              className="h-11 gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuovo budget</span>
              <span className="sm:hidden">Nuovo</span>
            </Button>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">Budget totale</p>
              <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{formatCurrency(totals.totalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">Speso</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-red-600 sm:text-2xl">{formatCurrency(totals.totalSpent)}</p>
            </CardContent>
          </Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">Rimanente</p>
              <p className={cn('mt-2 text-xl font-bold tabular-nums sm:text-2xl', totals.totalRemaining >= 0 ? 'text-indigo-600' : 'text-red-600')}>
                {formatCurrency(totals.totalRemaining)}
              </p>
            </CardContent>
          </Card>
          <Card className={cn('border-[#e5e7f0] bg-white shadow-sm', totals.projectedOverrun > 0 && 'border-amber-200 bg-amber-50')}>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">Superamento previsto</p>
              <p className={cn('mt-2 text-xl font-bold tabular-nums sm:text-2xl', totals.projectedOverrun > 0 ? 'text-amber-600' : 'text-slate-400')}>
                {totals.projectedOverrun > 0 ? formatCurrency(totals.projectedOverrun) : '—'}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Alert banner */}
        {!loading && totals.atRiskCount > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              {totals.exceededCount > 0 && (
                <span className="font-semibold">{totals.exceededCount} {totals.exceededCount === 1 ? 'budget sforato' : 'budget sforati'}. </span>
              )}
              {totals.atRiskCount - totals.exceededCount > 0 && (
                <span>{totals.atRiskCount - totals.exceededCount} {totals.atRiskCount - totals.exceededCount === 1 ? 'categoria a rischio' : 'categorie a rischio'}.</span>
              )}
            </p>
          </div>
        )}

        {/* Insights */}
        {!loading && insights.length > 0 && (
          <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {insights.slice(0, 5).map((ins, i) => (
              <InsightRow key={i} insight={ins} />
            ))}
          </section>
        )}

        {/* Budget list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState
              icon={PiggyBank}
              title="Nessun budget"
              description="Imposta un obiettivo mensile per categoria: Aurora confronterà speso e rimanente automaticamente."
              action={
                <Button onClick={() => { createForm.reset(); setCreateOpen(true) }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Crea budget
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const tone = statusTone(entry.status)
              const fc   = entry.forecast
              const cmp  = entry.comparison
              return (
                <Card key={entry.budgetId} className="border-[#e5e7f0] bg-white shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-950">
                            {entry.categoryIcon ? `${entry.categoryIcon} ` : ''}{entry.categoryName}
                          </span>
                          {entry.parentCategoryName && (
                            <span className="text-xs text-slate-400">in {entry.parentCategoryName}</span>
                          )}
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tone.badge)}>
                            {tone.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatCurrency(entry.spent)} / {formatCurrency(entry.amount)}
                          <span className={cn('ml-2 font-medium', entry.remaining >= 0 ? 'text-slate-600' : 'text-red-600')}>
                            ({entry.remaining >= 0
                              ? `${formatCurrency(entry.remaining)} rimanente`
                              : `${formatCurrency(Math.abs(entry.remaining))} sforato`})
                          </span>
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn('text-sm font-bold tabular-nums sm:text-base', tone.text)}>
                          {entry.percentage}%
                        </span>
                        <div className="relative">
                          <Button
                            variant="ghost" size="icon" className="h-9 w-9"
                            onClick={() => setOpenMenuId(openMenuId === entry.budgetId ? null : entry.budgetId)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {openMenuId === entry.budgetId && (
                            <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                              <Link
                                href={`/budgets/${entry.budgetId}`}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => setOpenMenuId(null)}
                              >
                                <BarChart2 className="h-4 w-4" />
                                Dettagli
                              </Link>
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => openEdit(entry)}
                              >
                                <Pencil className="h-4 w-4" />
                                Modifica
                              </button>
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                onClick={() => { setDeleteEntry(entry); setOpenMenuId(null) }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Elimina
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn('h-full rounded-full transition-all', tone.bar)}
                        style={{ width: `${Math.min(entry.percentage, 100)}%` }}
                      />
                    </div>

                    {/* Forecast + comparison row */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                      {fc.hasEnoughData ? (
                        <span className="flex items-center gap-1">
                          <BarChart2 className="h-3 w-3" />
                          Prev. {formatCurrency(fc.projectedSpent)}
                          {fc.projectedOverrun > 0 && (
                            <span className="ml-1 font-semibold text-amber-600">
                              (+{formatCurrency(fc.projectedOverrun)})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">Previsione: dati insufficienti</span>
                      )}

                      {cmp && cmp.trend !== 'unavailable' && (
                        <span className={cn('flex items-center gap-0.5', cmp.trend === 'down' ? 'text-emerald-600' : cmp.trend === 'up' ? 'text-red-500' : 'text-slate-400')}>
                          {cmp.trend === 'up'   && <TrendingUp   className="h-3 w-3" />}
                          {cmp.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                          {cmp.trend === 'stable'
                            ? 'Stabile vs. mese scorso'
                            : `${cmp.trend === 'down' ? '-' : '+'}${Math.abs(cmp.percentageDiff)}% vs. mese scorso`}
                        </span>
                      )}
                    </div>

                    {/* Top alert */}
                    {entry.topAlert && (
                      <div className={cn('mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium', entry.topAlert.priority <= 2 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{entry.topAlert.message}</span>
                      </div>
                    )}

                    {/* Detail link */}
                    <div className="mt-3 flex justify-end">
                      <Link
                        href={`/budgets/${entry.budgetId}`}
                        className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Dettagli <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) createForm.reset() }}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Nuovo budget</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="mt-4 space-y-5">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <SelectField {...createForm.register('categoryId')}>
                <option value="">Seleziona categoria</option>
                {expenseCategories
                  .filter((c) => !budgetedCatIds.has(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </option>
                  ))}
              </SelectField>
              {createForm.formState.errors.categoryId && (
                <p className="text-sm text-red-600">{createForm.formState.errors.categoryId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Importo mensile</Label>
              <Input
                type="number" step="0.01" min="0.01"
                {...createForm.register('amount')}
                className="h-14 border-[#e5e7f0] bg-white text-2xl font-semibold tabular-nums text-slate-950"
              />
              {createForm.formState.errors.amount && (
                <p className="text-sm text-red-600">{createForm.formState.errors.amount.message}</p>
              )}
            </div>
            <Button type="submit" className="h-12 w-full" disabled={createForm.formState.isSubmitting}>
              {createForm.formState.isSubmitting ? 'Salvataggio...' : 'Salva budget'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={Boolean(editEntry)} onOpenChange={(open) => { if (!open) setEditEntry(null) }}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Modifica budget — {editEntry?.categoryName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="mt-4 space-y-5">
            <div className="space-y-2">
              <Label>Nuovo importo mensile</Label>
              <Input
                type="number" step="0.01" min="0.01"
                {...editForm.register('amount')}
                className="h-14 border-[#e5e7f0] bg-white text-2xl font-semibold tabular-nums text-slate-950"
              />
              {editForm.formState.errors.amount && (
                <p className="text-sm text-red-600">{editForm.formState.errors.amount.message}</p>
              )}
            </div>
            <Button type="submit" className="h-12 w-full" disabled={editForm.formState.isSubmitting}>
              {editForm.formState.isSubmitting ? 'Salvataggio...' : 'Salva modifiche'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(deleteEntry)} onOpenChange={(open) => { if (!open) setDeleteEntry(null) }}>
        <DialogContent className="max-w-sm border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Elimina budget</DialogTitle>
          </DialogHeader>
          <p className="mt-2 text-sm text-slate-600">
            Sei sicuro di voler eliminare il budget per{' '}
            <span className="font-semibold">{deleteEntry?.categoryName}</span>?
            Questa azione non può essere annullata.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteEntry(null)} disabled={deleting}>
              Annulla
            </Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Eliminazione...' : 'Elimina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
