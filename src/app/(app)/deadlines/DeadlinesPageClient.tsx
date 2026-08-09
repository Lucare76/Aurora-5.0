'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarClock, CheckCircle2, Edit2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import {
  DEADLINE_CATEGORIES,
  DEADLINE_CATEGORY_LABELS,
  DEADLINE_PRIORITY_LABELS,
  DEADLINE_RECURRENCE_LABELS,
  DEADLINE_REMINDER_OPTIONS,
  classifyDeadlineTemporalStatus,
  deadlineStats,
  daysUntilDeadline,
  sortDeadlines,
  temporalStatusLabel,
  todayDateOnly,
  type DeadlineCategory,
  type DeadlinePriority,
  type DeadlineRecurrence,
} from '@/lib/deadlines'
import type { PersonalDeadline } from '@/types/database'

type Filter = 'all' | 'overdue' | 'today' | 'next30' | 'completed'
type FormState = {
  id?: string
  title: string
  description: string
  category: DeadlineCategory
  due_date: string
  priority: DeadlinePriority
  recurrence: DeadlineRecurrence
  reminder_days_before: string
}

const today = todayDateOnly()
const emptyForm: FormState = {
  title: '',
  description: '',
  category: 'VEHICLE',
  due_date: today,
  priority: 'NORMAL',
  recurrence: 'NONE',
  reminder_days_before: '7',
}

const filterLabels: Record<Filter, string> = {
  all: 'Tutte',
  overdue: 'Scadute',
  today: 'Oggi',
  next30: 'Prossimi 30 giorni',
  completed: 'Completate',
}

export function DeadlinesPageClient() {
  const searchParams = useSearchParams()
  const [deadlines, setDeadlines] = useState<PersonalDeadline[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PersonalDeadline | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [filter, setFilter] = useState<Filter>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | DeadlineCategory>('all')
  const stats = useMemo(() => deadlineStats(deadlines, today), [deadlines])
  const visible = useMemo(() => {
    return sortDeadlines(deadlines, today)
      .filter((item) => categoryFilter === 'all' || item.category === categoryFilter)
      .filter((item) => {
        const temporal = classifyDeadlineTemporalStatus(item, today)
        if (filter === 'overdue') return temporal === 'OVERDUE'
        if (filter === 'today') return temporal === 'TODAY'
        if (filter === 'next30') {
          const days = daysUntilDeadline(item, today)
          return item.status === 'ACTIVE' && days >= 0 && days <= 30
        }
        if (filter === 'completed') return item.status === 'COMPLETED'
        return item.status !== 'CANCELLED'
      })
  }, [categoryFilter, deadlines, filter])

  useEffect(() => { void loadDeadlines() }, [])
  useEffect(() => {
    if (searchParams.get('action') === 'create') openCreate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function loadDeadlines() {
    try {
      setLoading(true)
      const response = await fetch('/api/deadlines', { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as { data?: PersonalDeadline[] } | null
      if (!response.ok || !payload?.data) throw new Error('Scadenze non disponibili')
      setDeadlines(payload.data)
    } catch {
      toast.error('Scadenze non disponibili')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(deadline: PersonalDeadline) {
    setForm({
      id: deadline.id,
      title: deadline.title,
      description: deadline.description ?? '',
      category: deadline.category,
      due_date: deadline.due_date,
      priority: deadline.priority,
      recurrence: deadline.recurrence,
      reminder_days_before: String(deadline.reminder_days_before),
    })
    setFormOpen(true)
  }

  async function saveDeadline() {
    const body = {
      title: form.title,
      description: form.description || null,
      category: form.category,
      due_date: form.due_date,
      priority: form.priority,
      recurrence: form.recurrence,
      reminder_days_before: Number(form.reminder_days_before),
    }
    const response = await fetch(form.id ? `/api/deadlines/${form.id}` : '/api/deadlines', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) {
      toast.error(payload?.error === 'INVALID_DEADLINE' ? 'Controlla i campi della scadenza.' : 'Salvataggio non riuscito')
      return
    }
    toast.success('Scadenza salvata')
    setFormOpen(false)
    await loadDeadlines()
  }

  async function patchStatus(deadline: PersonalDeadline, status: 'ACTIVE' | 'COMPLETED') {
    const response = await fetch(`/api/deadlines/${deadline.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      toast.error('Aggiornamento non riuscito')
      return
    }
    toast.success(status === 'COMPLETED' ? 'Scadenza completata' : 'Scadenza riaperta')
    await loadDeadlines()
  }

  async function deleteDeadline() {
    if (!deleteTarget) return
    const response = await fetch(`/api/deadlines/${deleteTarget.id}`, { method: 'DELETE' })
    if (!response.ok) {
      toast.error('Eliminazione non riuscita')
      return
    }
    toast.success('Scadenza eliminata')
    setDeleteTarget(null)
    await loadDeadlines()
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Modulo privato</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Scadenze</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Tieni sotto controllo documenti, auto, visite e rinnovi.</p>
        </div>
        <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />Nuova scadenza</Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Scadute" value={stats.overdue} tone="critical" />
        <Metric label="Oggi" value={stats.today} tone="warning" />
        <Metric label="Prossimi 30 giorni" value={stats.next30Days} tone="info" />
        <Metric label="Totale attive" value={stats.activeTotal} tone="success" />
      </div>

      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-indigo-600" />Elenco scadenze</CardTitle>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(filterLabels) as Filter[]).map((key) => (
                <Button key={key} variant={filter === key ? 'default' : 'outline'} size="sm" onClick={() => setFilter(key)}>{filterLabels[key]}</Button>
              ))}
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | DeadlineCategory)} className="h-9 rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm">
                <option value="all">Tutte le categorie</option>
                {DEADLINE_CATEGORIES.map((category) => <option key={category} value={category}>{DEADLINE_CATEGORY_LABELS[category]}</option>)}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-500">Caricamento scadenze...</p> : null}
          {!loading && visible.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#d8dceb] bg-[#f8f9fc] p-8 text-center">
              <CalendarClock className="mx-auto h-10 w-10 text-indigo-500" />
              <p className="mt-3 text-lg font-bold text-slate-950">Nessuna scadenza da mostrare</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Registra documenti, visite, bollo auto o rinnovi per vederli ordinati per urgenza.</p>
              <Button className="mt-4 gap-2" onClick={openCreate}><Plus className="h-4 w-4" />Crea la prima scadenza</Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {visible.map((deadline) => <DeadlineRow key={deadline.id} deadline={deadline} onEdit={openEdit} onComplete={patchStatus} onDelete={setDeleteTarget} />)}
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader><DialogTitle>{form.id ? 'Modifica scadenza' : 'Nuova scadenza'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titolo *"><Input value={form.title} onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))} /></Field>
            <Field label="Data *"><Input type="date" value={form.due_date} onChange={(event) => setForm((f) => ({ ...f, due_date: event.target.value }))} /></Field>
            <Field label="Categoria"><Select value={form.category} onChange={(value) => setForm((f) => ({ ...f, category: value as DeadlineCategory }))}>{DEADLINE_CATEGORIES.map((category) => <option key={category} value={category}>{DEADLINE_CATEGORY_LABELS[category]}</option>)}</Select></Field>
            <Field label="Priorità"><Select value={form.priority} onChange={(value) => setForm((f) => ({ ...f, priority: value as DeadlinePriority }))}>{Object.entries(DEADLINE_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Ricorrenza"><Select value={form.recurrence} onChange={(value) => setForm((f) => ({ ...f, recurrence: value as DeadlineRecurrence }))}>{Object.entries(DEADLINE_RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Promemoria"><Select value={form.reminder_days_before} onChange={(value) => setForm((f) => ({ ...f, reminder_days_before: value }))}>{DEADLINE_REMINDER_OPTIONS.map((days) => <option key={days} value={days}>{days === 0 ? 'Il giorno stesso' : `${days} giorni prima`}</option>)}</Select></Field>
            <div className="md:col-span-2"><Field label="Descrizione"><Input value={form.description} onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))} /></Field></div>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setFormOpen(false)}>Annulla</Button><Button onClick={saveDeadline}>Salva scadenza</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader><DialogTitle>Elimina scadenza</DialogTitle></DialogHeader>
          <p className="mt-3 text-sm text-slate-600">Vuoi eliminare “{deleteTarget?.title}”? L’operazione non modifica alcun dato contabile.</p>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)}>Annulla</Button><Button variant="destructive" onClick={deleteDeadline}>Elimina</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: StatusTone }) {
  return <Card className="border-[#e5e7f0] bg-white shadow-sm"><CardContent className="p-5"><StatusBadge tone={tone} label={label} /><p className="mt-4 text-3xl font-bold tabular-nums text-slate-950">{value}</p></CardContent></Card>
}

function DeadlineRow({ deadline, onEdit, onComplete, onDelete }: { deadline: PersonalDeadline; onEdit: (deadline: PersonalDeadline) => void; onComplete: (deadline: PersonalDeadline, status: 'ACTIVE' | 'COMPLETED') => void; onDelete: (deadline: PersonalDeadline) => void }) {
  const temporal = classifyDeadlineTemporalStatus(deadline, today)
  const tone: StatusTone = temporal === 'OVERDUE' ? 'critical' : temporal === 'TODAY' ? 'warning' : temporal === 'UPCOMING' ? 'info' : deadline.status === 'COMPLETED' ? 'success' : 'neutral'
  const days = daysUntilDeadline(deadline, today)
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e5e7f0] p-4 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-slate-950">{deadline.title}</p>
          <StatusBadge tone={tone} label={deadline.status === 'COMPLETED' ? 'Completata' : temporalStatusLabel(temporal)} />
          {deadline.priority === 'HIGH' ? <StatusBadge tone="warning" label="Alta priorità" /> : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {DEADLINE_CATEGORY_LABELS[deadline.category]} · {deadline.due_date} · {days >= 0 ? `${days} giorni mancanti` : `${Math.abs(days)} giorni fa`} · {DEADLINE_RECURRENCE_LABELS[deadline.recurrence]}
        </p>
        {deadline.description ? <p className="mt-1 text-sm text-slate-600">{deadline.description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {deadline.status === 'COMPLETED'
          ? <Button variant="outline" size="sm" className="gap-2" onClick={() => onComplete(deadline, 'ACTIVE')}><RotateCcw className="h-4 w-4" />Riapri</Button>
          : <Button variant="outline" size="sm" className="gap-2" onClick={() => onComplete(deadline, 'COMPLETED')}><CheckCircle2 className="h-4 w-4" />Completa</Button>}
        <Button variant="ghost" size="icon" onClick={() => onEdit(deadline)} aria-label="Modifica scadenza"><Edit2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(deadline)} aria-label="Elimina scadenza"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">{children}</select>
}
