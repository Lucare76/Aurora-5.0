'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarDays, Edit2, Eye, History, MapPin, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import {
  TIMELINE_CATEGORIES,
  TIMELINE_CATEGORY_LABELS,
  TIMELINE_IMPORTANCE_LABELS,
  TIMELINE_SUBJECT_LABELS,
  TIMELINE_SUBJECTS,
  formatTimelinePeriod,
  groupTimelineByYearMonth,
  type PersonalTimelineEvent,
  type TimelineCategory,
  type TimelineImportance,
  type TimelineStatistics,
  type TimelineSubject,
} from '@/lib/timeline'

type TimelineResponse = {
  data: PersonalTimelineEvent[]
  pagination: { limit: number; offset: number; total: number; hasMore: boolean }
  years: number[]
  stats: TimelineStatistics
}

type FormState = {
  id?: string
  title: string
  subject: TimelineSubject
  category: TimelineCategory
  event_date: string
  end_date: string
  description: string
  location: string
  provider: string
  tags: string
  importance: TimelineImportance
}

const today = new Date().toLocaleDateString('en-CA')
const emptyForm: FormState = {
  title: '',
  subject: 'SELF',
  category: 'OTHER',
  event_date: today,
  end_date: '',
  description: '',
  location: '',
  provider: '',
  tags: '',
  importance: 'NORMAL',
}

const defaultStats: TimelineStatistics = {
  total: 0,
  currentYear: 0,
  bySubject: { SELF: 0, AURORA: 0, ILENIA: 0, FAMILY: 0 },
  byCategory: {
    HEALTH: 0,
    THERAPY: 0,
    SCHOOL: 0,
    DOCUMENT: 0,
    ADMINISTRATIVE: 0,
    TRAVEL: 0,
    FAMILY: 0,
    MILESTONE: 0,
    OTHER: 0,
  },
  mostFrequentSubject: null,
}

export function TimelinePageClient() {
  const searchParams = useSearchParams()
  const [events, setEvents] = useState<PersonalTimelineEvent[]>([])
  const [years, setYears] = useState<number[]>([])
  const [stats, setStats] = useState<TimelineStatistics>(defaultStats)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [subjectFilter, setSubjectFilter] = useState<'all' | TimelineSubject>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | TimelineCategory>('all')
  const [yearFilter, setYearFilter] = useState<'all' | string>('all')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState<PersonalTimelineEvent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PersonalTimelineEvent | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const grouped = useMemo(() => groupTimelineByYearMonth(events), [events])

  useEffect(() => {
    void loadEvents({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectFilter, categoryFilter, yearFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEvents({ reset: true })
    }, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    if (searchParams.get('action') === 'create') openCreate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function loadEvents({ reset }: { reset: boolean }) {
    try {
      if (reset) setLoading(true)
      else setLoadingMore(true)
      const offset = reset ? 0 : events.length
      const params = new URLSearchParams({ limit: '25', offset: String(offset) })
      if (subjectFilter !== 'all') params.set('subject', subjectFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (yearFilter !== 'all') params.set('year', yearFilter)
      if (search.trim()) params.set('search', search.trim())

      const response = await fetch(`/api/timeline?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as TimelineResponse | { error?: string } | null
      if (!response.ok || !payload || !('data' in payload)) throw new Error('TIMELINE_UNAVAILABLE')

      setEvents((current) => reset ? payload.data : [...current, ...payload.data])
      setYears(payload.years)
      setStats(payload.stats)
      setHasMore(payload.pagination.hasMore)
      setTotal(payload.pagination.total)
    } catch {
      toast.error('Timeline non disponibile.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function openCreate() {
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(event: PersonalTimelineEvent) {
    setForm({
      id: event.id,
      title: event.title,
      subject: event.subject,
      category: event.category,
      event_date: event.event_date,
      end_date: event.end_date ?? '',
      description: event.description ?? '',
      location: event.location ?? '',
      provider: event.provider ?? '',
      tags: event.tags.join(', '),
      importance: event.importance,
    })
    setFormOpen(true)
  }

  async function saveEvent() {
    const body = {
      title: form.title,
      subject: form.subject,
      category: form.category,
      event_date: form.event_date,
      end_date: form.end_date || null,
      description: form.description || null,
      location: form.location || null,
      provider: form.provider || null,
      tags: form.tags,
      importance: form.importance,
    }
    const response = await fetch(form.id ? `/api/timeline/${form.id}` : '/api/timeline', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) {
      toast.error(payload?.error === 'INVALID_TIMELINE_EVENT' ? 'Controlla i campi dell’evento.' : 'Salvataggio evento non riuscito.')
      return
    }
    toast.success('Evento salvato.')
    setFormOpen(false)
    await loadEvents({ reset: true })
  }

  async function deleteEvent() {
    if (!deleteTarget) return
    const response = await fetch(`/api/timeline/${deleteTarget.id}`, { method: 'DELETE' })
    if (!response.ok) {
      toast.error('Eliminazione evento non riuscita.')
      return
    }
    toast.success('Evento eliminato.')
    setDeleteTarget(null)
    await loadEvents({ reset: true })
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Modulo privato</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Timeline</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Una cronologia ordinata degli eventi importanti personali e familiari.</p>
        </div>
        <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />Nuovo evento</Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Eventi totali" value={stats.total} tone="info" />
        <Metric label="Eventi quest’anno" value={stats.currentYear} tone="success" />
        <Metric label="Soggetto più frequente" value={stats.mostFrequentSubject ? TIMELINE_SUBJECT_LABELS[stats.mostFrequentSubject] : 'N.d.'} tone="neutral" />
      </div>

      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-indigo-600" />Eventi</CardTitle>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={subjectFilter} onChange={(value) => setSubjectFilter(value as 'all' | TimelineSubject)} label="Soggetto">
                <option value="all">Tutti i soggetti</option>
                {TIMELINE_SUBJECTS.map((subject) => <option key={subject} value={subject}>{TIMELINE_SUBJECT_LABELS[subject]}</option>)}
              </Select>
              <Select value={categoryFilter} onChange={(value) => setCategoryFilter(value as 'all' | TimelineCategory)} label="Categoria">
                <option value="all">Tutte le categorie</option>
                {TIMELINE_CATEGORIES.map((category) => <option key={category} value={category}>{TIMELINE_CATEGORY_LABELS[category]}</option>)}
              </Select>
              <Select value={yearFilter} onChange={setYearFilter} label="Anno">
                <option value="all">Tutti gli anni</option>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </Select>
              <label className="relative block">
                <span className="sr-only">Ricerca testo</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca..." className="pl-9" />
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-500">Caricamento Timeline...</p> : null}
          {!loading && events.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#d8dceb] bg-[#f8f9fc] p-8 text-center">
              <History className="mx-auto h-10 w-10 text-indigo-500" />
              <p className="mt-3 text-lg font-bold text-slate-950">Nessun evento nella Timeline</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Registra visite, documenti, scuola, viaggi o note importanti per costruire una cronologia privata e ordinata.</p>
              <Button className="mt-4 gap-2" onClick={openCreate}><Plus className="h-4 w-4" />Crea il primo evento</Button>
            </div>
          ) : null}

          <div className="space-y-8">
            {grouped.map((year) => (
              <section key={year.year} aria-labelledby={`timeline-year-${year.year}`}>
                <h2 id={`timeline-year-${year.year}`} className="text-2xl font-bold text-slate-950">{year.year}</h2>
                <div className="mt-4 space-y-6">
                  {year.months.map((month) => (
                    <section key={month.monthKey} aria-label={month.monthLabel}>
                      <h3 className="mb-3 text-sm font-bold capitalize text-slate-500">{month.monthLabel}</h3>
                      <div className="space-y-3 border-l-2 border-indigo-100 pl-4">
                        {month.events.map((event) => (
                          <TimelineRow key={event.id} event={event} onDetail={setDetailTarget} onEdit={openEdit} onDelete={setDeleteTarget} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {!loading && hasMore ? (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => loadEvents({ reset: false })} disabled={loadingMore}>{loadingMore ? 'Caricamento...' : `Carica altri (${events.length}/${total})`}</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <TimelineFormDialog open={formOpen} form={form} onChange={setForm} onClose={() => setFormOpen(false)} onSave={saveEvent} />
      <TimelineDetailDialog event={detailTarget} onClose={() => setDetailTarget(null)} onEdit={(event) => { setDetailTarget(null); openEdit(event) }} />
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader><DialogTitle>Elimina evento</DialogTitle></DialogHeader>
          <p className="mt-3 text-sm text-slate-600">Vuoi eliminare “{deleteTarget?.title}”? L’operazione non modifica contabilità, patrimonio o moduli finanziari.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annulla</Button>
            <Button variant="destructive" onClick={deleteEvent}>Elimina</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: StatusTone }) {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardContent className="p-5">
        <StatusBadge tone={tone} label={label} />
        <p className="mt-4 text-3xl font-bold tabular-nums text-slate-950">{value}</p>
      </CardContent>
    </Card>
  )
}

function TimelineRow({ event, onDetail, onEdit, onDelete }: { event: PersonalTimelineEvent; onDetail: (event: PersonalTimelineEvent) => void; onEdit: (event: PersonalTimelineEvent) => void; onDelete: (event: PersonalTimelineEvent) => void }) {
  return (
    <article className="relative rounded-2xl border border-[#e5e7f0] bg-white p-4 shadow-sm">
      <span className="absolute -left-[1.38rem] top-5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow ring-2 ring-indigo-100" />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-slate-950">{event.title}</p>
            <StatusBadge tone={event.importance === 'HIGH' ? 'warning' : event.importance === 'LOW' ? 'neutral' : 'info'} label={TIMELINE_IMPORTANCE_LABELS[event.importance]} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatTimelinePeriod(event)} · {TIMELINE_SUBJECT_LABELS[event.subject]} · {TIMELINE_CATEGORY_LABELS[event.category]}
          </p>
          {event.description ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.description}</p> : null}
          {(event.location || event.provider) ? (
            <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" /> {[event.location, event.provider].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onDetail(event)}><Eye className="h-4 w-4" />Dettaglio</Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(event)} aria-label="Modifica evento Timeline"><Edit2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(event)} aria-label="Elimina evento Timeline"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </article>
  )
}

function TimelineFormDialog({ open, form, onChange, onClose, onSave }: { open: boolean; form: FormState; onChange: (form: FormState) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto bg-white">
        <DialogHeader><DialogTitle>{form.id ? 'Modifica evento' : 'Nuovo evento Timeline'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Titolo *"><Input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} /></Field>
          <Field label="Soggetto *"><NativeSelect value={form.subject} onChange={(value) => onChange({ ...form, subject: value as TimelineSubject })}>{TIMELINE_SUBJECTS.map((subject) => <option key={subject} value={subject}>{TIMELINE_SUBJECT_LABELS[subject]}</option>)}</NativeSelect></Field>
          <Field label="Categoria *"><NativeSelect value={form.category} onChange={(value) => onChange({ ...form, category: value as TimelineCategory })}>{TIMELINE_CATEGORIES.map((category) => <option key={category} value={category}>{TIMELINE_CATEGORY_LABELS[category]}</option>)}</NativeSelect></Field>
          <Field label="Importanza"><NativeSelect value={form.importance} onChange={(value) => onChange({ ...form, importance: value as TimelineImportance })}>{Object.entries(TIMELINE_IMPORTANCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
          <Field label="Data *"><Input type="date" value={form.event_date} onChange={(event) => onChange({ ...form, event_date: event.target.value })} /></Field>
          <Field label="Data fine"><Input type="date" value={form.end_date} onChange={(event) => onChange({ ...form, end_date: event.target.value })} /></Field>
          <Field label="Luogo"><Input value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })} /></Field>
          <Field label="Struttura/Professionista"><Input value={form.provider} onChange={(event) => onChange({ ...form, provider: event.target.value })} /></Field>
          <div className="md:col-span-2"><Field label="Descrizione"><textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} className="min-h-24 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /></Field></div>
          <div className="md:col-span-2"><Field label="Tag"><Input value={form.tags} onChange={(event) => onChange({ ...form, tags: event.target.value })} placeholder="controllo, documento, viaggio" /></Field></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={onSave}>Salva evento</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TimelineDetailDialog({ event, onClose, onEdit }: { event: PersonalTimelineEvent | null; onClose: () => void; onEdit: (event: PersonalTimelineEvent) => void }) {
  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader><DialogTitle>{event?.title}</DialogTitle></DialogHeader>
        {event ? (
          <div className="space-y-4 text-sm text-slate-600">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="info" label={TIMELINE_SUBJECT_LABELS[event.subject]} />
              <StatusBadge tone="neutral" label={TIMELINE_CATEGORY_LABELS[event.category]} />
              <StatusBadge tone={event.importance === 'HIGH' ? 'warning' : 'neutral'} label={TIMELINE_IMPORTANCE_LABELS[event.importance]} />
            </div>
            <p><CalendarDays className="mr-1 inline h-4 w-4 text-indigo-500" />{formatTimelinePeriod(event)}</p>
            {event.description ? <p className="whitespace-pre-wrap">{event.description}</p> : null}
            {event.location ? <p><strong>Luogo:</strong> {event.location}</p> : null}
            {event.provider ? <p><strong>Struttura/Professionista:</strong> {event.provider}</p> : null}
            {event.tags.length > 0 ? <p><strong>Tag:</strong> {event.tags.join(', ')}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Chiudi</Button>
              <Button onClick={() => onEdit(event)}>Modifica</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function NativeSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">{children}</select>
}

function Select({ value, onChange, label, children }: { value: string; onChange: (value: string) => void; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <NativeSelect value={value} onChange={onChange}>{children}</NativeSelect>
    </label>
  )
}
