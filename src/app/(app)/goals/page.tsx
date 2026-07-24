'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { Archive, ArrowRight, CalendarDays, MoreHorizontal, Pencil, PiggyBank, Plus, Target, Trash2, WalletCards } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { GoalProgress } from '@/lib/goals/service'

const goalSchema = z.object({
  name: z.string().trim().min(1, 'Inserisci un nome.'),
  targetAmount: z.coerce.number({ message: 'Importo non valido.' }).positive('L’importo deve essere positivo.'),
  targetDate: z.string().optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

const contributionSchema = z.object({
  amount: z.coerce.number({ message: 'Importo non valido.' }).positive('L’importo deve essere positivo.'),
  date: z.string().min(1, 'Inserisci una data.'),
  note: z.string().trim().optional(),
})

type GoalForm = z.infer<typeof goalSchema>
type ContributionForm = z.infer<typeof contributionSchema>

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#14b8a6', '#64748b']
const TABS = [
  { key: 'ACTIVE', label: 'Attivi' },
  { key: 'COMPLETED', label: 'Completati' },
  { key: 'ARCHIVED', label: 'Archiviati' },
] as const

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn('h-11 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100', props.className)}
    />
  )
}

function TextareaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn('min-h-24 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100', props.className)}
    />
  )
}

function statusLabel(status: GoalProgress['status']) {
  if (status === 'COMPLETED') return 'Completato'
  if (status === 'ARCHIVED') return 'Archiviato'
  return 'Attivo'
}

function intelligentStatusLabel(status?: GoalProgress['intelligentStatus']) {
  switch (status) {
    case 'COMPLETED': return { label: 'Completato', cls: 'bg-emerald-100 text-emerald-700' }
    case 'AHEAD': return { label: 'In anticipo', cls: 'bg-emerald-100 text-emerald-700' }
    case 'ON_TRACK': return { label: 'In linea', cls: 'bg-indigo-50 text-indigo-700' }
    case 'SLIGHTLY_BEHIND': return { label: 'Leggermente in ritardo', cls: 'bg-amber-100 text-amber-700' }
    case 'BEHIND': return { label: 'In ritardo', cls: 'bg-red-100 text-red-700' }
    case 'OVERDUE': return { label: 'Scaduto', cls: 'bg-red-100 text-red-700' }
    case 'NO_DEADLINE': return { label: 'Senza scadenza', cls: 'bg-slate-100 text-slate-600' }
    case 'INSUFFICIENT_DATA': return { label: 'Dati insufficienti', cls: 'bg-slate-100 text-slate-600' }
    default: return { label: 'Attivo', cls: 'bg-indigo-50 text-indigo-700' }
  }
}

function GoalCard({
  goal,
  onEdit,
  onArchive,
  onDelete,
  onContribution,
}: {
  goal: GoalProgress
  onEdit: (goal: GoalProgress) => void
  onArchive: (goal: GoalProgress) => void
  onDelete: (goal: GoalProgress) => void
  onContribution: (goal: GoalProgress) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const percent = Math.min(goal.completionPercentage, 100)
  const isArchived = goal.status === 'ARCHIVED' || goal.archived
  const isComplete = goal.status === 'COMPLETED'
  const smart = intelligentStatusLabel(goal.intelligentStatus)

  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl text-white" style={{ backgroundColor: goal.color ?? '#6366f1' }}>
              {goal.icon || '🎯'}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-950">{goal.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={cn('rounded-full px-2 py-0.5 font-semibold', isArchived ? 'bg-slate-100 text-slate-500' : isComplete ? 'bg-emerald-100 text-emerald-700' : smart.cls)}>
                  {isArchived ? statusLabel(goal.status) : smart.label}
                </span>
                {goal.target_date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(goal.target_date)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMenuOpen((open) => !open)} aria-label={`Azioni per ${goal.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                <Link href={`/goals/${goal.id}`} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                  <ArrowRight className="h-4 w-4" />
                  Dettagli
                </Link>
                {!isArchived && (
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-indigo-700 hover:bg-indigo-50" onClick={() => { setMenuOpen(false); onContribution(goal) }}>
                    <Plus className="h-4 w-4" />
                    Versamento
                  </button>
                )}
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenuOpen(false); onEdit(goal) }}>
                  <Pencil className="h-4 w-4" />
                  Modifica
                </button>
                {!isArchived && (
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenuOpen(false); onArchive(goal) }}>
                    <Archive className="h-4 w-4" />
                    Archivia
                  </button>
                )}
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => { setMenuOpen(false); onDelete(goal) }}>
                  <Trash2 className="h-4 w-4" />
                  Elimina
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-[#f8f9fc] p-3 text-sm">
          <div>
            <p className="text-xs text-slate-500">Accumulato</p>
            <p className="mt-1 font-bold tabular-nums text-slate-950">{formatCurrency(goal.current_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Target</p>
            <p className="mt-1 font-bold tabular-nums text-slate-950">{formatCurrency(goal.target_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Residuo</p>
            <p className="mt-1 font-bold tabular-nums text-indigo-600">{formatCurrency(goal.remainingAmount)}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Avanzamento</span>
            <span>{goal.completionPercentage}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          {goal.completionPercentage > 100 && (
            <p className="mt-2 text-xs font-medium text-emerald-600">Obiettivo superato: ottimo margine extra.</p>
          )}
        </div>

        <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="font-medium text-slate-700">Previsione: </span>
            {goal.estimatedCompletionDate ? formatDate(goal.estimatedCompletionDate) : 'servono altri versamenti'}
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="font-medium text-slate-700">Quota/mese: </span>
            {goal.requiredMonthlyContribution != null ? formatCurrency(goal.requiredMonthlyContribution) : 'non necessaria'}
          </div>
        </div>

        {goal.primaryInsight && (
          <div className={cn(
            'mt-3 rounded-xl border px-3 py-2 text-xs font-medium',
            goal.primaryInsight.severity === 'DANGER' ? 'border-red-200 bg-red-50 text-red-700'
              : goal.primaryInsight.severity === 'WARNING' ? 'border-amber-200 bg-amber-50 text-amber-800'
              : goal.primaryInsight.severity === 'SUCCESS' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-indigo-100 bg-indigo-50 text-indigo-800',
          )}>
            <span className="font-bold">{goal.primaryInsight.title}: </span>{goal.primaryInsight.message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function GoalsPage() {
  const [initialAction] = useState(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('action'))
  const [goals, setGoals] = useState<GoalProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['key']>('ACTIVE')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<GoalProgress | null>(null)
  const [deleting, setDeleting] = useState<GoalProgress | null>(null)
  const [archiving, setArchiving] = useState<GoalProgress | null>(null)
  const [contributionGoal, setContributionGoal] = useState<GoalProgress | null>(null)

  const goalForm = useForm<GoalForm>({
    resolver: zodResolver(goalSchema) as Resolver<GoalForm>,
    defaultValues: { name: '', targetAmount: 0, targetDate: '', icon: '🎯', color: '#6366f1', notes: '' },
  })
  const contributionForm = useForm<ContributionForm>({
    resolver: zodResolver(contributionSchema) as Resolver<ContributionForm>,
    defaultValues: { amount: 0, date: new Date().toLocaleDateString('en-CA'), note: '' },
  })

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/goals')
      if (res.status === 401) { toast.error('Sessione scaduta. Accedi di nuovo.'); return }
      if (!res.ok) { toast.error('Errore caricamento obiettivi'); return }
      const body = await res.json() as { data: GoalProgress[] }
      setGoals(body.data ?? [])
    } catch {
      toast.error('Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const summary = useMemo(() => {
    const visible = goals.filter((goal) => goal.status !== 'ARCHIVED')
    return {
      totalTarget: visible.reduce((sum, goal) => sum + goal.target_amount, 0),
      totalSaved: visible.reduce((sum, goal) => sum + goal.current_amount, 0),
      active: visible.filter((goal) => goal.status === 'ACTIVE').length,
      completed: visible.filter((goal) => goal.status === 'COMPLETED').length,
    }
  }, [goals])

  const filteredGoals = useMemo(() => goals.filter((goal) => {
    if (activeTab === 'ARCHIVED') return goal.status === 'ARCHIVED' || goal.archived
    if (activeTab === 'COMPLETED') return goal.status === 'COMPLETED' && !goal.archived
    return goal.status === 'ACTIVE' && !goal.archived
  }), [activeTab, goals])

  const openCreate = () => {
    goalForm.reset({ name: '', targetAmount: 0, targetDate: '', icon: '🎯', color: '#6366f1', notes: '' })
    setCreateOpen(true)
  }

  const openEdit = (goal: GoalProgress) => {
    goalForm.reset({
      name: goal.name,
      targetAmount: goal.target_amount,
      targetDate: goal.target_date ?? '',
      icon: goal.icon ?? '🎯',
      color: goal.color ?? '#6366f1',
      notes: goal.notes ?? '',
    })
    setEditing(goal)
  }

  const submitGoal: SubmitHandler<GoalForm> = async (values) => {
    const payload = {
      name: values.name,
      targetAmount: values.targetAmount,
      targetDate: values.targetDate || null,
      icon: values.icon || null,
      color: values.color || null,
      notes: values.notes || null,
    }
    const res = await fetch(editing ? `/api/goals/${editing.id}` : '/api/goals', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) { toast.error('Errore durante il salvataggio'); return }
    toast.success(editing ? 'Obiettivo aggiornato' : 'Obiettivo creato')
    setCreateOpen(false)
    setEditing(null)
    await fetchGoals()
  }

  const submitContribution: SubmitHandler<ContributionForm> = async (values) => {
    if (!contributionGoal) return
    const res = await fetch(`/api/goals/${contributionGoal.id}/contributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: values.amount, date: values.date, note: values.note || null }),
    })
    if (!res.ok) { toast.error('Errore durante il versamento'); return }
    toast.success('Versamento registrato')
    setContributionGoal(null)
    contributionForm.reset({ amount: 0, date: new Date().toLocaleDateString('en-CA'), note: '' })
    await fetchGoals()
  }

  const confirmArchive = async () => {
    if (!archiving) return
    const res = await fetch(`/api/goals/${archiving.id}?archive=1`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Errore durante l’archiviazione'); return }
    toast.success('Obiettivo archiviato')
    setArchiving(null)
    await fetchGoals()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const res = await fetch(`/api/goals/${deleting.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Errore durante l’eliminazione'); return }
    toast.success('Obiettivo eliminato')
    setDeleting(null)
    await fetchGoals()
  }

  useEffect(() => {
    if (initialAction === 'create') {
      openCreate()
    } else if (initialAction === 'contribution') {
      const firstActiveGoal = goals.find((goal) => goal.status === 'ACTIVE' && !goal.archived)
      if (firstActiveGoal) setContributionGoal(firstActiveGoal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction, goals])

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-indigo-600">Pianificazione</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Obiettivi di risparmio</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Tieni separati i traguardi personali dalla contabilità: i versamenti aggiornano solo l’avanzamento dell’obiettivo.
            </p>
          </div>
          <Button onClick={openCreate} className="h-11 gap-2">
            <Plus className="h-4 w-4" />
            Nuovo obiettivo
          </Button>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-4 sm:p-5"><p className="text-xs font-medium text-slate-500">Target totale</p><p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{formatCurrency(summary.totalTarget)}</p></CardContent></Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-4 sm:p-5"><p className="text-xs font-medium text-slate-500">Accumulato</p><p className="mt-2 text-xl font-bold tabular-nums text-indigo-600 sm:text-2xl">{formatCurrency(summary.totalSaved)}</p></CardContent></Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-4 sm:p-5"><p className="text-xs font-medium text-slate-500">Attivi</p><p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{summary.active}</p></CardContent></Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-4 sm:p-5"><p className="text-xs font-medium text-slate-500">Completati</p><p className="mt-2 text-xl font-bold tabular-nums text-emerald-600 sm:text-2xl">{summary.completed}</p></CardContent></Card>
        </section>

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-[#e5e7f0] bg-white p-1 shadow-sm">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={cn('rounded-xl px-4 py-2 text-sm font-semibold transition', activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />)}
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState
              icon={PiggyBank}
              title={goals.length === 0 ? 'Nessun obiettivo di risparmio' : 'Nessun obiettivo in questa sezione'}
              description={goals.length === 0 ? 'Crea un traguardo, registra i versamenti e segui quanto manca per raggiungerlo.' : 'Cambia sezione oppure crea un nuovo obiettivo.'}
              action={<Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Crea obiettivo</Button>}
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onEdit={openEdit} onArchive={setArchiving} onDelete={setDeleting} onContribution={setContributionGoal} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen || Boolean(editing)} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null) } }}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>{editing ? 'Modifica obiettivo' : 'Nuovo obiettivo'}</DialogTitle></DialogHeader>
          <form onSubmit={goalForm.handleSubmit(submitGoal)} className="mt-4 space-y-5">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...goalForm.register('name')} className="h-11 border-[#e5e7f0] bg-white" placeholder="Es. Fondo emergenza" />
              {goalForm.formState.errors.name && <p className="text-sm text-red-600">{goalForm.formState.errors.name.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Importo target</Label>
                <Input type="number" step="0.01" min="0.01" {...goalForm.register('targetAmount')} className="h-11 border-[#e5e7f0] bg-white tabular-nums" />
                {goalForm.formState.errors.targetAmount && <p className="text-sm text-red-600">{goalForm.formState.errors.targetAmount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Data obiettivo</Label>
                <Input type="date" {...goalForm.register('targetDate')} className="h-11 border-[#e5e7f0] bg-white" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Icona</Label>
                <SelectField {...goalForm.register('icon')}>
                  {['🎯', '🏠', '🚗', '✈️', '🛡️', '💻', '🎓', '💍', '📈', '✨'].map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                </SelectField>
              </div>
              <div className="space-y-2">
                <Label>Colore</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <label key={color} className="relative">
                      <input type="radio" value={color} className="peer sr-only" {...goalForm.register('color')} />
                      <span className="block h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-slate-200 peer-checked:ring-2 peer-checked:ring-indigo-500" style={{ backgroundColor: color }} />
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <TextareaField {...goalForm.register('notes')} placeholder="Facoltative" />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={goalForm.formState.isSubmitting}>
              {goalForm.formState.isSubmitting ? 'Salvataggio...' : 'Salva obiettivo'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(contributionGoal)} onOpenChange={(open) => { if (!open) setContributionGoal(null) }}>
        <DialogContent className="max-w-md border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>Nuovo versamento</DialogTitle></DialogHeader>
          <form onSubmit={contributionForm.handleSubmit(submitContribution)} className="mt-4 space-y-5">
            <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800">
              <WalletCards className="mb-2 h-4 w-4" />
              Il versamento aggiorna solo l’obiettivo “{contributionGoal?.name}”, non i saldi dei conti.
            </div>
            <div className="space-y-2">
              <Label>Importo</Label>
              <Input type="number" step="0.01" min="0.01" {...contributionForm.register('amount')} className="h-14 border-[#e5e7f0] bg-white text-2xl font-semibold tabular-nums" />
              {contributionForm.formState.errors.amount && <p className="text-sm text-red-600">{contributionForm.formState.errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" {...contributionForm.register('date')} className="h-11 border-[#e5e7f0] bg-white" />
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Input {...contributionForm.register('note')} className="h-11 border-[#e5e7f0] bg-white" placeholder="Facoltativa" />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={contributionForm.formState.isSubmitting}>
              {contributionForm.formState.isSubmitting ? 'Salvataggio...' : 'Registra versamento'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiving)} onOpenChange={(open) => { if (!open) setArchiving(null) }}>
        <DialogContent className="max-w-sm border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>Archivia obiettivo</DialogTitle></DialogHeader>
          <p className="mt-2 text-sm text-slate-600">L’obiettivo resterà consultabile nella sezione Archiviati.</p>
          <div className="mt-6 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setArchiving(null)}>Annulla</Button><Button className="flex-1" onClick={confirmArchive}>Archivia</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <DialogContent className="max-w-sm border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>Elimina obiettivo</DialogTitle></DialogHeader>
          <p className="mt-2 text-sm text-slate-600">Eliminerai anche lo storico dei versamenti. Questa azione non può essere annullata.</p>
          <div className="mt-6 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setDeleting(null)}>Annulla</Button><Button variant="destructive" className="flex-1" onClick={confirmDelete}>Elimina</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
