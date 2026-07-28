'use client'

import { useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2, Plane, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import type { AffordabilityClassification, Severity } from '@/lib/affordability/types'
import type { TravelAffordabilityResult } from '@/lib/affordability/travel/types'
import { LODGING_TYPE_LABELS, MEAL_MODE_LABELS, TRANSPORT_MODE_LABELS } from '@/lib/affordability/travel/constants'

const TODAY = new Date().toLocaleDateString('en-CA')
const NEXT_MONTH = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('en-CA')

type FormState = Record<string, string> & {
  transportMode: 'car' | 'plane' | 'train' | 'ship' | 'bus'
  lodgingType: 'hotel' | 'apartment' | 'resort' | 'bb' | 'camping' | 'other'
  mealMode: 'daily_budget' | 'total'
}

const INITIAL_FORM: FormState = {
  simulationName: '',
  destination: '',
  country: '',
  travelers: '2',
  adults: '2',
  children: '0',
  bookingDate: TODAY,
  departureDate: NEXT_MONTH,
  returnDate: NEXT_MONTH,
  transportMode: 'plane',
  lodgingType: 'hotel',
  mealMode: 'daily_budget',
  mainTrip: '',
  fuel: '',
  tolls: '',
  parking: '',
  taxi: '',
  transfers: '',
  rentalCar: '',
  transportOther: '',
  lodgingTotal: '',
  lodgingDeposit: '',
  lodgingBalance: '',
  securityDeposit: '',
  cleaning: '',
  touristTax: '',
  dailyBudgetPerPerson: '',
  mealsTotal: '',
  excursions: '',
  museums: '',
  parks: '',
  events: '',
  beach: '',
  sports: '',
  rentals: '',
  activitiesOther: '',
  shopping: '',
  souvenirs: '',
  travelInsurance: '',
  roaming: '',
  tips: '',
  contingency: '',
  extrasOther: '',
  payment1Amount: '',
  payment1Date: TODAY,
  payment2Amount: '',
  payment2Date: NEXT_MONTH,
  payment3Amount: '',
  payment3Date: NEXT_MONTH,
  currentMonthlySaving: '',
  minimumLiquidityMonths: '3',
  horizonMonths: '24',
}

function parseNum(value: string): number | null {
  if (!value.trim()) return null
  const parsed = parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function fmt(value: number | null | undefined, currency = 'EUR') {
  return value == null ? '-' : formatCurrency(value, currency)
}

type ClassStyle = { bg: string; text: string; border: string; icon: typeof CheckCircle2 }

const CLASS_STYLES: Record<AffordabilityClassification, ClassStyle> = {
  AFFORDABLE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  CAUTION: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
  RISKY: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertCircle },
  NOT_AFFORDABLE: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
  INSUFFICIENT_DATA: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: Info },
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-slate-500',
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">{children}</label>
}

function Input({ id, value, onChange, type = 'text', min, max, step, placeholder }: {
  id: string
  value: string
  onChange: (value: string) => void
  type?: string
  min?: string
  max?: string
  step?: string
  placeholder?: string
}) {
  return <input id={id} value={value} onChange={(e) => onChange(e.target.value)} type={type} min={min} max={max} step={step} placeholder={placeholder} className="mt-1 block w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
}

function Select({ id, value, onChange, children }: { id: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">{children}</select>
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-[#e5e7f0] bg-white">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50">
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-[#e5e7f0] px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

function MetricCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-4', highlight ? 'border-indigo-200 bg-indigo-50' : 'border-[#e5e7f0] bg-white')}>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={cn('mt-1 text-lg font-bold', highlight ? 'text-indigo-700' : 'text-slate-900')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function buildPayload(f: FormState) {
  const n = (key: string) => parseNum(f[key])
  const payments = [
    n('payment1Amount') ? { label: 'Acconto', amount: n('payment1Amount')!, date: f.payment1Date } : null,
    n('payment2Amount') ? { label: 'Saldo', amount: n('payment2Amount')!, date: f.payment2Date } : null,
    n('payment3Amount') ? { label: 'Dopo rientro', amount: n('payment3Amount')!, date: f.payment3Date } : null,
  ].filter(Boolean)
  return {
    simulationName: f.simulationName,
    destination: f.destination || null,
    country: f.country || null,
    currency: 'EUR',
    travelers: parseInt(f.travelers || '1'),
    adults: parseInt(f.adults || '0'),
    children: parseInt(f.children || '0'),
    bookingDate: f.bookingDate,
    departureDate: f.departureDate,
    returnDate: f.returnDate,
    transportMode: f.transportMode,
    lodgingType: f.lodgingType,
    transport: { mainTrip: n('mainTrip'), fuel: n('fuel'), tolls: n('tolls'), parking: n('parking'), taxi: n('taxi'), transfers: n('transfers'), rentalCar: n('rentalCar'), other: n('transportOther') },
    lodging: { totalCost: n('lodgingTotal'), deposit: n('lodgingDeposit'), balance: n('lodgingBalance'), securityDeposit: n('securityDeposit'), cleaning: n('cleaning'), touristTax: n('touristTax') },
    meals: { mode: f.mealMode, dailyBudgetPerPerson: n('dailyBudgetPerPerson'), totalCost: n('mealsTotal') },
    activities: { excursions: n('excursions'), museums: n('museums'), parks: n('parks'), events: n('events'), beach: n('beach'), sports: n('sports'), rentals: n('rentals'), other: n('activitiesOther') },
    extras: { shopping: n('shopping'), souvenirs: n('souvenirs'), travelInsurance: n('travelInsurance'), roaming: n('roaming'), tips: n('tips'), contingency: n('contingency'), other: n('extrasOther') },
    payments: payments.length > 0 ? payments : null,
    currentMonthlySaving: n('currentMonthlySaving'),
    minimumLiquidityMonths: n('minimumLiquidityMonths') ?? 3,
    horizonMonths: n('horizonMonths') ? parseInt(f.horizonMonths) : 24,
    includeGoalContributions: true,
  }
}

function ResultSection({ result }: { result: TravelAffordabilityResult }) {
  const style = CLASS_STYLES[result.classification]
  const Icon = style.icon
  const m = result.travelMetrics
  return (
    <section id="travel-result" aria-live="polite" className="space-y-5">
      <div className={cn('rounded-2xl border-2 p-5', style.bg, style.border)}>
        <div className="flex items-start gap-3">
          <Icon className={cn('mt-0.5 h-6 w-6 shrink-0', style.text)} />
          <div>
            <p className={cn('text-lg font-bold', style.text)}>{result.classificationLabel}</p>
            <p className="mt-1 text-sm text-slate-700">{result.summary}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Costo totale" value={fmt(m.totalTripCost, result.currency)} highlight />
        <MetricCard label="Durata" value={`${m.durationDays} giorni`} sub={`${m.nights} notti`} />
        <MetricCard label="Accantonamento" value={`${fmt(m.suggestedMonthlySaving, result.currency)}/mese`} />
        <MetricCard label="Liquidità dopo" value={fmt(result.liquidityAfter, result.currency)} />
        <MetricCard label="Mesi copertura" value={result.coverageMonthsAfter?.toFixed(1) ?? '-'} />
        <MetricCard label="Saldo minimo previsto" value={fmt(result.minimumProjectedLiquidity, result.currency)} />
        <MetricCard label="Mesi critici" value={String(result.negativeMonths)} />
        <MetricCard label="Budget max" value={m.maxSustainableBudgetLow != null ? `${fmt(m.maxSustainableBudgetLow, result.currency)} - ${fmt(m.maxSustainableBudgetHigh, result.currency)}` : '-'} />
      </div>
      <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Riepilogo costi</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {m.breakdown.map((row) => (
            <div key={row.label} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-medium text-slate-900">{fmt(row.amount, result.currency)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Calendario pagamenti</p>
        <div className="space-y-2">
          {m.payments.map((payment) => (
            <div key={`${payment.label}-${payment.date}`} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">{payment.label} · {payment.date}</span>
              <span className="font-medium text-slate-900">{fmt(payment.amount, result.currency)}</span>
            </div>
          ))}
        </div>
      </div>
      {result.alternatives.length > 0 && (
        <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Alternative</p>
          <ul className="space-y-2 text-sm text-slate-600">
            {result.alternatives.slice(0, 8).map((alt, index) => <li key={index} className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />{alt.text}</li>)}
          </ul>
        </div>
      )}
      {result.risks.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">Rischi e limiti</p>
          <ul className="space-y-1 text-sm text-amber-700">{result.risks.map((risk, index) => <li key={index} className={SEVERITY_COLORS[risk.severity]}>{risk.text}</li>)}</ul>
        </div>
      )}
    </section>
  )
}

export default function TravelEvaluation() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [result, setResult] = useState<TravelAffordabilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (field: keyof FormState) => (value: string) => setForm((current) => ({ ...current, [field]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/affordability/travel/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message ?? 'Dati non validi per la valutazione vacanza.')
      setResult(body.data)
      setTimeout(() => document.getElementById('travel-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non è stato possibile completare la valutazione. Nessun dato finanziario è stato modificato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex gap-3">
          <Plane className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold text-indigo-900">Posso permettermi questa vacanza?</p>
            <p className="mt-1 text-sm text-indigo-700">Analizza solo l'impatto finanziario di costi inseriti manualmente. Nessun prezzo online, nessuna prenotazione, nessun movimento reale.</p>
          </div>
        </div>
      </div>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Section title="1. Viaggio" defaultOpen>
          <FieldGrid>
            <div><Label htmlFor="simulationName">Nome simulazione *</Label><Input id="simulationName" value={form.simulationName} onChange={set('simulationName')} /></div>
            <div><Label htmlFor="destination">Destinazione</Label><Input id="destination" value={form.destination} onChange={set('destination')} /></div>
            <div><Label htmlFor="country">Paese</Label><Input id="country" value={form.country} onChange={set('country')} /></div>
            <div><Label htmlFor="travelers">Viaggiatori *</Label><Input id="travelers" value={form.travelers} onChange={set('travelers')} type="number" min="1" max="100" /></div>
            <div><Label htmlFor="adults">Adulti</Label><Input id="adults" value={form.adults} onChange={set('adults')} type="number" min="0" /></div>
            <div><Label htmlFor="children">Bambini</Label><Input id="children" value={form.children} onChange={set('children')} type="number" min="0" /></div>
            <div><Label htmlFor="bookingDate">Data prenotazione</Label><Input id="bookingDate" value={form.bookingDate} onChange={set('bookingDate')} type="date" /></div>
            <div><Label htmlFor="departureDate">Partenza *</Label><Input id="departureDate" value={form.departureDate} onChange={set('departureDate')} type="date" /></div>
            <div><Label htmlFor="returnDate">Rientro *</Label><Input id="returnDate" value={form.returnDate} onChange={set('returnDate')} type="date" /></div>
          </FieldGrid>
        </Section>
        <Section title="2. Trasporti">
          <FieldGrid>
            <div><Label htmlFor="transportMode">Mezzo principale</Label><Select id="transportMode" value={form.transportMode} onChange={set('transportMode')}>{Object.entries(TRANSPORT_MODE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
            {['mainTrip', 'fuel', 'tolls', 'parking', 'taxi', 'transfers', 'rentalCar', 'transportOther'].map((key) => <div key={key}><Label htmlFor={key}>{key}</Label><Input id={key} value={form[key]} onChange={set(key)} type="number" min="0" /></div>)}
          </FieldGrid>
        </Section>
        <Section title="3. Alloggio">
          <FieldGrid>
            <div><Label htmlFor="lodgingType">Tipo alloggio</Label><Select id="lodgingType" value={form.lodgingType} onChange={set('lodgingType')}>{Object.entries(LODGING_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
            {['lodgingTotal', 'lodgingDeposit', 'lodgingBalance', 'securityDeposit', 'cleaning', 'touristTax'].map((key) => <div key={key}><Label htmlFor={key}>{key}</Label><Input id={key} value={form[key]} onChange={set(key)} type="number" min="0" /></div>)}
          </FieldGrid>
        </Section>
        <Section title="4. Pasti, attività, extra">
          <FieldGrid>
            <div><Label htmlFor="mealMode">Pasti</Label><Select id="mealMode" value={form.mealMode} onChange={set('mealMode')}>{Object.entries(MEAL_MODE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
            <div><Label htmlFor="dailyBudgetPerPerson">Budget pasti giornaliero a persona</Label><Input id="dailyBudgetPerPerson" value={form.dailyBudgetPerPerson} onChange={set('dailyBudgetPerPerson')} type="number" min="0" /></div>
            <div><Label htmlFor="mealsTotal">Pasti costo totale</Label><Input id="mealsTotal" value={form.mealsTotal} onChange={set('mealsTotal')} type="number" min="0" /></div>
            {['excursions', 'museums', 'parks', 'events', 'beach', 'sports', 'rentals', 'activitiesOther', 'shopping', 'souvenirs', 'travelInsurance', 'roaming', 'tips', 'contingency', 'extrasOther'].map((key) => <div key={key}><Label htmlFor={key}>{key}</Label><Input id={key} value={form[key]} onChange={set(key)} type="number" min="0" /></div>)}
          </FieldGrid>
        </Section>
        <Section title="5. Calendario pagamenti e prudenza">
          <FieldGrid>
            <div><Label htmlFor="payment1Amount">Acconto (€)</Label><Input id="payment1Amount" value={form.payment1Amount} onChange={set('payment1Amount')} type="number" min="0" /></div>
            <div><Label htmlFor="payment1Date">Data acconto</Label><Input id="payment1Date" value={form.payment1Date} onChange={set('payment1Date')} type="date" /></div>
            <div><Label htmlFor="payment2Amount">Saldo (€)</Label><Input id="payment2Amount" value={form.payment2Amount} onChange={set('payment2Amount')} type="number" min="0" /></div>
            <div><Label htmlFor="payment2Date">Data saldo</Label><Input id="payment2Date" value={form.payment2Date} onChange={set('payment2Date')} type="date" /></div>
            <div><Label htmlFor="currentMonthlySaving">Accantonamento già previsto (€ / mese)</Label><Input id="currentMonthlySaving" value={form.currentMonthlySaving} onChange={set('currentMonthlySaving')} type="number" min="0" /></div>
            <div><Label htmlFor="minimumLiquidityMonths">Fondo minimo (mesi)</Label><Input id="minimumLiquidityMonths" value={form.minimumLiquidityMonths} onChange={set('minimumLiquidityMonths')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>
        {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading || !form.simulationName} className="gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plane className="h-4 w-4" />}{loading ? 'Valutazione in corso…' : 'Valuta vacanza'}</Button>
          {result && <button type="button" onClick={() => setResult(null)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"><RefreshCw className="h-3 w-3" />Nuova valutazione</button>}
        </div>
      </form>
      {result && <ResultSection result={result} />}
    </div>
  )
}
