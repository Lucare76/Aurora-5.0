'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarDays, Download, Edit2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  annualVacationAllowance,
  annualVacationRemaining,
  annualVacationUsed,
  monthlyPermitAllowance,
  monthlyPermitRemaining,
  monthlyPermitUsed,
  permitUsagePercentage,
  usageTone,
  vacationUsagePercentage,
} from '@/lib/leave/calculations'
import type { LeaveEntry, LeaveEntryType, LeaveSettings } from '@/types/database'

type FormState = {
  id?: string
  type: LeaveEntryType
  start_date: string
  end_date: string
  days: string
  hours: string
  start_time: string
  end_time: string
  note: string
}

const today = new Date().toLocaleDateString('en-CA')
const defaultSettings: LeaveSettings = {
  id: '',
  user_id: '',
  vacation_days_per_year: 30,
  permit_104_hours_per_month: 24,
  timezone: 'Europe/Rome',
  created_at: '',
  updated_at: '',
}

const emptyForm: FormState = {
  type: 'VACATION',
  start_date: today,
  end_date: today,
  days: '1',
  hours: '',
  start_time: '',
  end_time: '',
  note: '',
}

export function LeavePageClient() {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<LeaveSettings>(defaultSettings)
  const [entries, setEntries] = useState<LeaveEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const vacationEntries = entries.filter((entry) => entry.type === 'VACATION' && Number(entry.start_date.slice(0, 4)) === year)
  const permitEntries = entries.filter((entry) => entry.type === 'PERMIT_104' && entry.start_date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
  const vacationUsed = annualVacationUsed(entries, year)
  const vacationRemaining = annualVacationRemaining(settings, entries, year)
  const vacationPercent = vacationUsagePercentage(settings, entries, year)
  const permitUsed = monthlyPermitUsed(entries, year, month)
  const permitRemaining = monthlyPermitRemaining(settings, entries, year, month)
  const permitPercent = permitUsagePercentage(settings, entries, year, month)
  const nextVacation = [...vacationEntries].filter((entry) => entry.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  const lastVacation = [...vacationEntries].filter((entry) => entry.start_date <= today).sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
  const lastPermit = [...entries].filter((entry) => entry.type === 'PERMIT_104' && entry.start_date <= today).sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
  const permitYearHours = entries
    .filter((entry) => entry.type === 'PERMIT_104' && Number(entry.start_date.slice(0, 4)) === year)
    .reduce((sum, entry) => sum + Number(entry.hours ?? 0), 0)

  const permitMonths = useMemo(() => {
    const totals = new Map<number, number>()
    entries.filter((entry) => entry.type === 'PERMIT_104' && Number(entry.start_date.slice(0, 4)) === year)
      .forEach((entry) => totals.set(Number(entry.start_date.slice(5, 7)), (totals.get(Number(entry.start_date.slice(5, 7))) ?? 0) + Number(entry.hours ?? 0)))
    return totals
  }, [entries, year])

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'vacation') openCreate('VACATION')
    if (action === 'permit') openCreate('PERMIT_104')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function loadData() {
    try {
      setLoading(true)
      const [settingsResponse, entriesResponse] = await Promise.all([
        fetch('/api/leave/settings', { cache: 'no-store' }),
        fetch('/api/leave/entries', { cache: 'no-store' }),
      ])
      const settingsPayload = await settingsResponse.json()
      const entriesPayload = await entriesResponse.json()
      if (!settingsResponse.ok || !entriesResponse.ok) throw new Error('Dati ferie non disponibili')
      setSettings(settingsPayload.data)
      setEntries(entriesPayload.data)
    } catch {
      toast.error('Ferie e permessi non disponibili')
    } finally {
      setLoading(false)
    }
  }

  function openCreate(type: LeaveEntryType) {
    setForm({ ...emptyForm, type, days: type === 'VACATION' ? '1' : '', hours: type === 'PERMIT_104' ? '1' : '' })
    setFormOpen(true)
  }

  function openEdit(entry: LeaveEntry) {
    setForm({
      id: entry.id,
      type: entry.type,
      start_date: entry.start_date,
      end_date: entry.end_date,
      days: entry.days?.toString() ?? '',
      hours: entry.hours?.toString() ?? '',
      start_time: entry.start_time?.slice(0, 5) ?? '',
      end_time: entry.end_time?.slice(0, 5) ?? '',
      note: entry.note ?? '',
    })
    setFormOpen(true)
  }

  async function saveEntry() {
    const body = form.type === 'VACATION'
      ? { type: form.type, start_date: form.start_date, end_date: form.end_date, days: Number(form.days), hours: null, start_time: null, end_time: null, note: form.note || null }
      : { type: form.type, start_date: form.start_date, end_date: form.start_date, days: null, hours: Number(form.hours), start_time: form.start_time || null, end_time: form.end_time || null, note: form.note || null }
    const url = form.id ? `/api/leave/entries/${form.id}` : '/api/leave/entries'
    const response = await fetch(url, { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) {
      toast.error('Salvataggio non riuscito')
      return
    }
    toast.success('Elemento salvato')
    setFormOpen(false)
    await loadData()
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('Eliminare questa voce?')) return
    const response = await fetch(`/api/leave/entries/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      toast.error('Eliminazione non riuscita')
      return
    }
    toast.success('Elemento eliminato')
    await loadData()
  }

  async function saveSettings() {
    const response = await fetch('/api/leave/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vacation_days_per_year: Number(settings.vacation_days_per_year),
        permit_104_hours_per_month: Number(settings.permit_104_hours_per_month),
        timezone: settings.timezone,
      }),
    })
    if (!response.ok) {
      toast.error('Impostazioni non salvate')
      return
    }
    toast.success('Impostazioni salvate')
    setSettingsOpen(false)
    await loadData()
  }

  function exportPdf(kind: 'vacation' | 'permits' | 'summary') {
    window.location.href = `/api/leave/export/pdf?kind=${kind}&year=${year}&month=${month}`
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Modulo privato</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Ferie e permessi</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Gestisci ferie annuali e permessi 104 in modo completamente separato dalla contabilità.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>Impostazioni</Button>
          <Button variant="outline" className="gap-2" onClick={() => openCreate('PERMIT_104')}><Plus className="h-4 w-4" />Nuovo permesso</Button>
          <Button className="gap-2" onClick={() => openCreate('VACATION')}><Plus className="h-4 w-4" />Nuove ferie</Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Ferie" available={`${annualVacationAllowance(settings)} giorni`} used={`${vacationUsed} giorni`} remaining={`${vacationRemaining} giorni`} percent={vacationPercent} />
        <SummaryCard title="Permessi 104" available={`${monthlyPermitAllowance(settings)} ore`} used={`${permitUsed} ore`} remaining={`${permitRemaining} ore`} percent={permitPercent} />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <SmallMetric label="Ultime ferie" value={lastVacation ? `${lastVacation.start_date} · ${lastVacation.days}g` : 'Nessuna'} />
        <SmallMetric label="Prossime ferie" value={nextVacation ? `${nextVacation.start_date} · ${nextVacation.days}g` : 'Nessuna'} />
        <SmallMetric label="Ultimo permesso" value={lastPermit ? `${lastPermit.start_date} · ${lastPermit.hours}h` : 'Nessuno'} />
        <SmallMetric label="Ore 104 anno" value={`${permitYearHours} ore`} />
        <SmallMetric label="Giorni ferie anno" value={`${vacationUsed} giorni`} />
      </div>

      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Storico e filtri</CardTitle>
            <div className="flex gap-2">
              <Input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 w-28" aria-label="Anno" />
              <Input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} className="h-10 w-24" aria-label="Mese" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <HistoryList title="Ferie" entries={vacationEntries} onEdit={openEdit} onDelete={deleteEntry} />
          <HistoryList title="Permessi 104" entries={permitEntries} onEdit={openEdit} onDelete={deleteEntry} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-indigo-600" />Calendario interno</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />Ferie</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Permessi 104</span>
            </div>
            <div className="grid grid-cols-7 gap-2 text-xs">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const hasVacation = vacationEntries.some((entry) => entry.start_date <= date && entry.end_date >= date)
                const hasPermit = permitEntries.some((entry) => entry.start_date === date)
                return (
                  <div key={date} className="min-h-14 rounded-xl border border-[#e5e7f0] p-2">
                    <span className="font-semibold text-slate-700">{day}</span>
                    <div className="mt-2 flex gap-1">
                      {hasVacation ? <span className="h-2 w-2 rounded-full bg-indigo-500" /> : null}
                      {hasPermit ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader><CardTitle>Statistiche</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <SmallMetric label="Numero periodi ferie" value={String(vacationEntries.length)} />
            <SmallMetric label="Durata media ferie" value={`${average(vacationEntries.map((entry) => Number(entry.days ?? 0)))} giorni`} />
            <SmallMetric label="Media mensile permessi" value={`${average([...permitMonths.values()])} ore`} />
            <SmallMetric label="Mese con più 104" value={topPermitMonth(permitMonths)} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" className="gap-2" onClick={() => exportPdf('vacation')}><Download className="h-4 w-4" />PDF ferie</Button>
              <Button variant="outline" className="gap-2" onClick={() => exportPdf('permits')}><Download className="h-4 w-4" />PDF permessi</Button>
              <Button variant="outline" className="gap-2" onClick={() => exportPdf('summary')}><Download className="h-4 w-4" />PDF riepilogo</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? <p className="text-sm text-slate-500">Caricamento ferie e permessi...</p> : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader><DialogTitle>{form.id ? 'Modifica' : 'Nuovo'} {form.type === 'VACATION' ? 'ferie' : 'permesso 104'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo"><Select ariaLabel="Tipo voce" value={form.type} onChange={(value) => setForm((f) => ({ ...f, type: value as LeaveEntryType }))}><option value="VACATION">Ferie</option><option value="PERMIT_104">Permesso 104</option></Select></Field>
            <Field label="Data inizio"><Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value, end_date: f.type === 'PERMIT_104' ? e.target.value : f.end_date }))} /></Field>
            {form.type === 'VACATION' ? <Field label="Data fine"><Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} /></Field> : null}
            {form.type === 'VACATION' ? <Field label="Giorni consumati"><Input type="number" step="0.5" min="0" value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} /></Field> : null}
            {form.type === 'PERMIT_104' ? <Field label="Ore"><Input type="number" step="0.25" min="0" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} /></Field> : null}
            {form.type === 'PERMIT_104' ? <Field label="Ora inizio"><Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} /></Field> : null}
            {form.type === 'PERMIT_104' ? <Field label="Ora fine"><Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} /></Field> : null}
            <div className="md:col-span-2"><Field label="Nota"><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field></div>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setFormOpen(false)}>Annulla</Button><Button onClick={saveEntry}>Salva</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader><DialogTitle>Impostazioni ferie e permessi</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Field label="Ferie disponibili all'anno"><Input type="number" min="0" step="0.5" value={settings.vacation_days_per_year} onChange={(e) => setSettings((s) => ({ ...s, vacation_days_per_year: Number(e.target.value) }))} /></Field>
            <Field label="Permessi 104 disponibili al mese"><Input type="number" min="0" step="0.25" value={settings.permit_104_hours_per_month} onChange={(e) => setSettings((s) => ({ ...s, permit_104_hours_per_month: Number(e.target.value) }))} /></Field>
            <Field label="Fuso orario"><Input value={settings.timezone} onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))} /></Field>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setSettingsOpen(false)}>Annulla</Button><Button onClick={saveSettings}>Salva impostazioni</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ title, available, used, remaining, percent }: { title: string; available: string; used: string; remaining: string; percent: number }) {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between"><CardTitle>{title}</CardTitle><StatusBadge tone={usageTone(percent)} label={percent >= 100 ? 'Critico' : percent >= 80 ? 'Da controllare' : 'Tutto ok'} /></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <SmallMetric label="Disponibili" value={available} />
          <SmallMetric label="Usate" value={used} />
          <SmallMetric label="Residue" value={remaining} />
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-600" style={{ width: `${Math.min(percent, 100)}%` }} /></div>
        <p className="mt-2 text-xs text-slate-500">{percent}% utilizzato</p>
      </CardContent>
    </Card>
  )
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#e5e7f0] bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-bold tabular-nums text-slate-950">{value}</p></div>
}

function HistoryList({ title, entries, onEdit, onDelete }: { title: string; entries: LeaveEntry[]; onEdit: (entry: LeaveEntry) => void; onDelete: (id: string) => void }) {
  return (
    <div>
      <h2 className="mb-3 font-semibold text-slate-950">{title}</h2>
      <div className="space-y-2">
        {entries.length === 0 ? <p className="rounded-2xl border border-dashed border-[#e5e7f0] p-4 text-sm text-slate-500">Nessun elemento registrato.</p> : entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-[#e5e7f0] p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-950">{entry.type === 'VACATION' ? `${entry.start_date} - ${entry.end_date}` : entry.start_date}</p>
              <p className="text-xs text-slate-500">{entry.type === 'VACATION' ? `${entry.days} giorni` : `${entry.hours} ore · ${entry.start_time ?? '--'}-${entry.end_time ?? '--'}`} {entry.note ? `· ${entry.note}` : ''}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onEdit(entry)} aria-label="Modifica"><Edit2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(entry.id)} aria-label="Elimina"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function Select({ ariaLabel, value, onChange, children }: { ariaLabel: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">{children}</select>
}

function average(values: number[]): string {
  const nonZero = values.filter((value) => value > 0)
  if (nonZero.length === 0) return '0'
  return (nonZero.reduce((sum, value) => sum + value, 0) / nonZero.length).toFixed(2)
}

function topPermitMonth(values: Map<number, number>): string {
  const top = [...values.entries()].sort((a, b) => b[1] - a[1])[0]
  return top ? `${String(top[0]).padStart(2, '0')} · ${top[1]} ore` : 'Nessuno'
}
