'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CalendarDays, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { z } from 'zod'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { GoalDetail } from '@/lib/goals/service'

const contributionSchema = z.object({
  amount: z.coerce.number({ message: 'Importo non valido.' }).positive('L’importo deve essere positivo.'),
  date: z.string().min(1, 'Inserisci una data.'),
  note: z.string().trim().optional(),
})

type ContributionForm = z.infer<typeof contributionSchema>

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <p className="mb-1 font-semibold text-slate-900">{label}</p>
      <p className="font-bold tabular-nums text-indigo-600">{formatCurrency(Number(payload[0]?.value ?? 0))}</p>
    </div>
  )
}

function buildContributionChart(detail: GoalDetail) {
  const sorted = [...detail.contributions].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  let running = detail.goal.current_amount - sorted.reduce((sum, row) => sum + row.amount, 0)
  return sorted.map((row) => {
    running += row.amount
    return {
      date: formatDate(row.date),
      amount: row.amount,
      total: Math.max(0, Math.round(running * 100) / 100),
    }
  })
}

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<GoalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [contributionOpen, setContributionOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const form = useForm<ContributionForm>({
    resolver: zodResolver(contributionSchema) as Resolver<ContributionForm>,
    defaultValues: { amount: 0, date: new Date().toLocaleDateString('en-CA'), note: '' },
  })

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/goals/${params.id}`)
      if (res.status === 401) { toast.error('Sessione scaduta. Accedi di nuovo.'); router.push('/login'); return }
      if (res.status === 404) { toast.error('Obiettivo non trovato'); router.push('/goals'); return }
      if (!res.ok) { toast.error('Errore caricamento obiettivo'); return }
      const body = await res.json() as { data: GoalDetail }
      setDetail(body.data)
    } catch {
      toast.error('Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const chartData = useMemo(() => detail ? buildContributionChart(detail) : [], [detail])

  const onSubmit: SubmitHandler<ContributionForm> = async (values) => {
    const res = await fetch(`/api/goals/${params.id}/contributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: values.amount, date: values.date, note: values.note || null }),
    })
    if (!res.ok) { toast.error('Errore durante il versamento'); return }
    toast.success('Versamento registrato')
    setContributionOpen(false)
    form.reset({ amount: 0, date: new Date().toLocaleDateString('en-CA'), note: '' })
    await fetchDetail()
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    const res = await fetch(`/api/goals/contributions/${deleteId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Errore durante l’eliminazione'); return }
    toast.success('Versamento eliminato')
    setDeleteId(null)
    await fetchDetail()
  }

  if (loading || !detail) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-44 rounded-2xl" />
        <Skeleton className="h-56 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    )
  }

  const { goal, contributions, contributionCount } = detail
  const percent = Math.min(goal.completionPercentage, 100)
  const canAdd = goal.status !== 'ARCHIVED' && !goal.archived

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/goals" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}>
            <ArrowLeft className="h-4 w-4" />
            Obiettivi
          </Link>
          {canAdd && (
            <Button className="gap-2" onClick={() => setContributionOpen(true)}>
              <Plus className="h-4 w-4" />
              Aggiungi versamento
            </Button>
          )}
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-[#e5e7f0] bg-white shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-3xl text-white" style={{ backgroundColor: goal.color ?? '#6366f1' }}>
                  {goal.icon || '🎯'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-indigo-600">Obiettivo di risparmio</p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{goal.name}</h1>
                  {goal.notes && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{goal.notes}</p>}
                  {goal.target_date && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                      <CalendarDays className="h-4 w-4 text-indigo-500" />
                      Data obiettivo: {formatDate(goal.target_date)}
                    </p>
                  )}
                </div>
              </div>
              <div className={cn('rounded-full px-3 py-1 text-sm font-semibold', goal.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : goal.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-700')}>
                {goal.status === 'COMPLETED' ? 'Completato' : goal.status === 'ARCHIVED' ? 'Archiviato' : 'Attivo'}
              </div>
            </div>

            <div className="mt-8 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm font-semibold text-slate-500">
              <span>{goal.completionPercentage}% completato</span>
              {goal.completionPercentage > 100 && <span className="text-emerald-600">Oltre target</span>}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Importo target</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(goal.target_amount)}</p></CardContent></Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Accumulato</p><p className="mt-2 text-2xl font-bold tabular-nums text-indigo-600">{formatCurrency(goal.current_amount)}</p></CardContent></Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">Residuo</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{formatCurrency(goal.remainingAmount)}</p></CardContent></Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">Andamento versamenti</CardTitle>
              <p className="text-sm text-slate-500">Crescita cumulata dello storico registrato.</p>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] text-center">
                  <PiggyBank className="h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Nessun versamento registrato</p>
                  <p className="mt-1 text-sm text-slate-500">Aggiungi il primo versamento per vedere il grafico.</p>
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="goalTotal" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={11} />
                      <YAxis axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={11} width={70} tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '')} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#goalTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">Storico versamenti</CardTitle>
              <p className="text-sm text-slate-500">Mostrati gli ultimi {Math.min(contributionCount, 50)} di {contributionCount} versamenti.</p>
            </CardHeader>
            <CardContent>
              {contributions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">Nessun versamento</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {contributions.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Plus className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{formatDate(row.date)}</p>
                        {row.note && <p className="mt-0.5 truncate text-xs text-slate-500">{row.note}</p>}
                      </div>
                      <AmountDisplay amount={row.amount} type="income" className="shrink-0 text-sm font-bold" />
                      {canAdd && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => setDeleteId(row.id)} aria-label="Elimina versamento">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={contributionOpen} onOpenChange={setContributionOpen}>
        <DialogContent className="max-w-md border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>Aggiungi versamento</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-5">
            <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800">
              Il denaro viene conteggiato solo nell’obiettivo, senza modificare i saldi dei conti.
            </div>
            <div className="space-y-2">
              <Label>Importo</Label>
              <Input type="number" step="0.01" min="0.01" {...form.register('amount')} className="h-14 border-[#e5e7f0] bg-white text-2xl font-semibold tabular-nums" />
              {form.formState.errors.amount && <p className="text-sm text-red-600">{form.formState.errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" {...form.register('date')} className="h-11 border-[#e5e7f0] bg-white" />
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Input {...form.register('note')} className="h-11 border-[#e5e7f0] bg-white" placeholder="Facoltativa" />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvataggio...' : 'Registra versamento'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <DialogContent className="max-w-sm border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>Elimina versamento</DialogTitle></DialogHeader>
          <p className="mt-2 text-sm text-slate-600">Il totale accumulato dell’obiettivo verrà aggiornato automaticamente.</p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Annulla</Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDelete}>Elimina</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
