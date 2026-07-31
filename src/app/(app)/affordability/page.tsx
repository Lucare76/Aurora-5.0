'use client'

import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Info,
  Loader2,
  RefreshCw,
  Home,
  Plane,
  ShoppingCart,
  TrendingDown,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import CarEvaluation from './CarEvaluation'
import HomeEvaluation from './HomeEvaluation'
import TravelEvaluation from './TravelEvaluation'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import type { AffordabilityResult, AffordabilityClassification, Severity } from '@/lib/affordability/types'
import { DISCLAIMER, SIMULATION_NOTE } from '@/lib/affordability/constants'

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, currency = 'EUR') {
  if (n == null) return '—'
  return formatCurrency(n, currency)
}

function fmtMonths(n: number | null | undefined) {
  if (n == null) return '—'
  return `${n.toFixed(1)} mesi`
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${Math.round(n * 100)}%`
}

function fmtAxis(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
  return `€${v.toFixed(0)}`
}

// ── Classification styles ─────────────────────────────────────────────────────

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

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  purchaseName: string
  totalPrice: string
  paymentMode: 'IMMEDIATE' | 'INSTALLMENTS'
  purchaseDate: string
  accountId: string
  additionalUpfrontCosts: string
  monthlyRecurringCost: string
  annualRecurringCost: string
  linkedMonthlyIncome: string
  recurringDurationMonths: string
  downPayment: string
  installmentAmount: string
  numberOfInstallments: string
  firstInstallmentDate: string
  balloonPayment: string
  debitAccountId: string
  notes: string
  minimumLiquidityMonths: string
  maxInstallmentToMarginRatio: string
  horizonMonths: string
  includeGoalContributions: boolean
}

const TODAY = new Date().toLocaleDateString('en-CA')
const DEFAULT_FIRST_INSTALLMENT = new Date(new Date().setMonth(new Date().getMonth() + 1))
  .toLocaleDateString('en-CA')

const INITIAL_FORM: FormState = {
  purchaseName: '',
  totalPrice: '',
  paymentMode: 'IMMEDIATE',
  purchaseDate: TODAY,
  accountId: '',
  additionalUpfrontCosts: '',
  monthlyRecurringCost: '',
  annualRecurringCost: '',
  linkedMonthlyIncome: '',
  recurringDurationMonths: '',
  downPayment: '',
  installmentAmount: '',
  numberOfInstallments: '',
  firstInstallmentDate: DEFAULT_FIRST_INSTALLMENT,
  balloonPayment: '',
  debitAccountId: '',
  notes: '',
  minimumLiquidityMonths: '3',
  maxInstallmentToMarginRatio: '35',
  horizonMonths: '12',
  includeGoalContributions: true,
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
}

function buildPayload(form: FormState) {
  const isInstallments = form.paymentMode === 'INSTALLMENTS'
  return {
    purchaseName: form.purchaseName,
    totalPrice: parseNum(form.totalPrice) ?? 0,
    paymentMode: form.paymentMode,
    purchaseDate: form.purchaseDate,
    currency: 'EUR',
    accountId: form.accountId || null,
    additionalUpfrontCosts: parseNum(form.additionalUpfrontCosts),
    monthlyRecurringCost: parseNum(form.monthlyRecurringCost),
    annualRecurringCost: parseNum(form.annualRecurringCost),
    linkedMonthlyIncome: parseNum(form.linkedMonthlyIncome),
    recurringDurationMonths: parseNum(form.recurringDurationMonths) ? parseInt(form.recurringDurationMonths) : null,
    notes: form.notes || null,
    ...(isInstallments ? {
      downPayment: parseNum(form.downPayment),
      installmentAmount: parseNum(form.installmentAmount),
      numberOfInstallments: parseNum(form.numberOfInstallments) ? parseInt(form.numberOfInstallments) : null,
      firstInstallmentDate: form.firstInstallmentDate || null,
      balloonPayment: parseNum(form.balloonPayment),
      debitAccountId: form.debitAccountId || null,
    } : {}),
    minimumLiquidityMonths: parseNum(form.minimumLiquidityMonths) ?? 3,
    maxInstallmentToMarginRatio: form.maxInstallmentToMarginRatio ? (parseNum(form.maxInstallmentToMarginRatio) ?? 35) / 100 : 0.35,
    horizonMonths: parseNum(form.horizonMonths) ? parseInt(form.horizonMonths) : 12,
    includeGoalContributions: form.includeGoalContributions,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
      {children}
    </label>
  )
}

function Input({
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
  max,
  step,
  required,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  min?: string
  max?: string
  step?: string
  required?: boolean
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      required={required}
      className="mt-1 block w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  )
}

function FieldGroup({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

// ── Result components ─────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function ProjectionChart({ points, currency }: { points: AffordabilityResult['projections']; currency: string }) {
  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#e5e7f0] text-slate-400">
        <p className="text-sm">Nessun dato di proiezione</p>
      </div>
    )
  }

  const fmtCurrency = (v: number) => formatCurrency(v, currency)
  const tickEvery = points.length <= 12 ? 1 : 2

  return (
    <div>
      <div className="h-52 sm:h-64" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradScen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={tickEvery - 1} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={fmtAxis} width={60} />
            <Tooltip
              formatter={(v, name) => [fmtCurrency(Number(v)), name === 'baselineLiquidity' ? 'Senza acquisto' : 'Con acquisto']}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', padding: '8px 12px' }}
              labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}
            />
            <Legend formatter={(v) => v === 'baselineLiquidity' ? 'Senza acquisto' : 'Con acquisto'} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="baselineLiquidity" stroke="#94a3b8" strokeWidth={1.5} fill="url(#gradBase)" dot={false} />
            <Area type="monotone" dataKey="scenarioLiquidity" stroke="#6366f1" strokeWidth={2} fill="url(#gradScen)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        Proiezione della liquidità nel periodo selezionato — stima, non previsione certa
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type EvalType = 'generic' | 'car' | 'home' | 'travel'

export default function AffordabilityPage() {
  const [evalType, setEvalType] = useState<EvalType>('generic')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [result, setResult] = useState<AffordabilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)

  function set(field: keyof FormState) {
    return (v: string | boolean) => setForm((f) => ({ ...f, [field]: v }))
  }

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/affordability/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? 'Errore durante la valutazione.')
      }
      const body = await res.json()
      setResult(body.data)
      setTimeout(() => {
        document.getElementById('affordability-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non è stato possibile completare la valutazione. Nessun dato finanziario è stato modificato.')
    } finally {
      setLoading(false)
    }
  }

  const style = result ? CLASS_STYLES[result.classification] : null
  const ClassIcon = style?.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Posso permettermelo?</h1>
            <p className="mt-1 text-sm text-slate-500">
              Simula un acquisto e valuta il suo impatto sulle tue finanze senza modificare i dati reali.
            </p>
          </div>
        </div>
        <Link
          href="/affordability/compare"
          className="flex shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
        >
          <GitCompare className="h-4 w-4" aria-hidden="true" />
          Confronta scenari
        </Link>
      </div>

      {/* Simulation badge */}
      <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600">
        <TrendingDown className="h-3.5 w-3.5" />
        {SIMULATION_NOTE}
      </div>

      {/* Type selector */}
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        role="tablist"
        aria-label="Tipo di valutazione"
      >
        <button
          type="button"
          onClick={() => { setEvalType('generic'); setResult(null) }}
          role="tab"
          aria-selected={evalType === 'generic'}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
            evalType === 'generic'
              ? 'border-indigo-300 bg-indigo-600 text-white'
              : 'border-[#e5e7f0] bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          Acquisto generico
        </button>
        <button
          type="button"
          onClick={() => { setEvalType('car'); setResult(null) }}
          role="tab"
          aria-selected={evalType === 'car'}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
            evalType === 'car'
              ? 'border-indigo-300 bg-indigo-600 text-white'
              : 'border-[#e5e7f0] bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          <Car className="h-4 w-4" />
          Auto
        </button>
        <button
          type="button"
          onClick={() => { setEvalType('home'); setResult(null) }}
          role="tab"
          aria-selected={evalType === 'home'}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
            evalType === 'home'
              ? 'border-indigo-300 bg-indigo-600 text-white'
              : 'border-[#e5e7f0] bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          <Home className="h-4 w-4" />
          Casa
        </button>
        <button
          type="button"
          onClick={() => { setEvalType('travel'); setResult(null) }}
          role="tab"
          aria-selected={evalType === 'travel'}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
            evalType === 'travel'
              ? 'border-indigo-300 bg-indigo-600 text-white'
              : 'border-[#e5e7f0] bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          <Plane className="h-4 w-4" />
          Vacanza
        </button>
      </div>

      {/* Car evaluation */}
      {evalType === 'car' && <CarEvaluation />}
      {evalType === 'home' && <HomeEvaluation />}
      {evalType === 'travel' && <TravelEvaluation />}

      {/* Generic form */}
      {evalType === 'generic' && (
      <>
      <form onSubmit={handleCalculate} noValidate>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left panel: purchase details */}
          <div className="space-y-4 rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Dettagli acquisto</h2>

            <FieldGroup label="Nome acquisto *" htmlFor="purchaseName">
              <Input id="purchaseName" value={form.purchaseName} onChange={set('purchaseName')} placeholder="es. Automobile, Laptop, Frigorifero…" required />
            </FieldGroup>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldGroup label="Prezzo totale (€) *" htmlFor="totalPrice">
                <Input id="totalPrice" value={form.totalPrice} onChange={set('totalPrice')} type="number" min="0.01" step="0.01" placeholder="0,00" required />
              </FieldGroup>
              <FieldGroup label="Data prevista *" htmlFor="purchaseDate">
                <Input id="purchaseDate" value={form.purchaseDate} onChange={set('purchaseDate')} type="date" required />
              </FieldGroup>
            </div>

            {/* Payment mode */}
            <div>
              <Label htmlFor="paymentMode">Modalità di pagamento</Label>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(['IMMEDIATE', 'INSTALLMENTS'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set('paymentMode')(mode)}
                    className={cn(
                      'flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all',
                      form.paymentMode === mode
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-[#e5e7f0] bg-white text-slate-600 hover:bg-slate-50',
                    )}
                    aria-pressed={form.paymentMode === mode}
                  >
                    {mode === 'IMMEDIATE' ? 'Pagamento immediato' : 'Pagamento rateale'}
                  </button>
                ))}
              </div>
            </div>

            {/* Immediate: account */}
            {form.paymentMode === 'IMMEDIATE' && (
              <FieldGroup label="UUID conto (opzionale)" htmlFor="accountId">
                <Input id="accountId" value={form.accountId} onChange={set('accountId')} placeholder="ID conto da addebitare (opzionale)" />
              </FieldGroup>
            )}

            {/* Installments */}
            {form.paymentMode === 'INSTALLMENTS' && (
              <div className="space-y-3 rounded-xl border border-[#e5e7f0] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dettagli rata</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldGroup label="Anticipo (€)" htmlFor="downPayment">
                    <Input id="downPayment" value={form.downPayment} onChange={set('downPayment')} type="number" min="0" step="0.01" placeholder="0,00" />
                  </FieldGroup>
                  <FieldGroup label="Rata mensile (€) *" htmlFor="installmentAmount">
                    <Input id="installmentAmount" value={form.installmentAmount} onChange={set('installmentAmount')} type="number" min="0.01" step="0.01" placeholder="0,00" />
                  </FieldGroup>
                  <FieldGroup label="Numero rate *" htmlFor="numberOfInstallments">
                    <Input id="numberOfInstallments" value={form.numberOfInstallments} onChange={set('numberOfInstallments')} type="number" min="1" max="360" step="1" placeholder="12" />
                  </FieldGroup>
                  <FieldGroup label="Prima rata" htmlFor="firstInstallmentDate">
                    <Input id="firstInstallmentDate" value={form.firstInstallmentDate} onChange={set('firstInstallmentDate')} type="date" />
                  </FieldGroup>
                </div>
                <FieldGroup label="Maxi-rata finale (€)" htmlFor="balloonPayment">
                  <Input id="balloonPayment" value={form.balloonPayment} onChange={set('balloonPayment')} type="number" min="0" step="0.01" placeholder="0,00" />
                </FieldGroup>
              </div>
            )}

            {/* Advanced optional fields */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-[#e5e7f0] px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
              aria-expanded={showAdvanced}
            >
              Costi aggiuntivi e dettagli opzionali
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldGroup label="Spese aggiuntive iniziali (€)" htmlFor="additionalUpfrontCosts">
                    <Input id="additionalUpfrontCosts" value={form.additionalUpfrontCosts} onChange={set('additionalUpfrontCosts')} type="number" min="0" step="0.01" placeholder="0,00" />
                  </FieldGroup>
                  <FieldGroup label="Costo mensile associato (€)" htmlFor="monthlyRecurringCost">
                    <Input id="monthlyRecurringCost" value={form.monthlyRecurringCost} onChange={set('monthlyRecurringCost')} type="number" min="0" step="0.01" placeholder="0,00" />
                  </FieldGroup>
                  <FieldGroup label="Costo annuale associato (€)" htmlFor="annualRecurringCost">
                    <Input id="annualRecurringCost" value={form.annualRecurringCost} onChange={set('annualRecurringCost')} type="number" min="0" step="0.01" placeholder="0,00" />
                  </FieldGroup>
                  <FieldGroup label="Entrata mensile collegata (€)" htmlFor="linkedMonthlyIncome">
                    <Input id="linkedMonthlyIncome" value={form.linkedMonthlyIncome} onChange={set('linkedMonthlyIncome')} type="number" min="0" step="0.01" placeholder="0,00" />
                  </FieldGroup>
                </div>
                <FieldGroup label="Note" htmlFor="notes">
                  <textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => set('notes')(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Note opzionali sull'acquisto…"
                    className="mt-1 block w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </FieldGroup>
              </div>
            )}
          </div>

          {/* Right panel: safety preferences */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={() => setShowPrefs(!showPrefs)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={showPrefs}
              >
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Parametri di prudenza</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Soglie usate per classificare la sostenibilità. Non rappresentano raccomandazioni finanziarie.
                  </p>
                </div>
                {showPrefs ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {showPrefs && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                    Puoi modificare questi parametri in base alle tue esigenze. Non rappresentano una raccomandazione finanziaria.
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldGroup label="Fondo minimo (mesi di spese)" htmlFor="minimumLiquidityMonths">
                      <Input id="minimumLiquidityMonths" value={form.minimumLiquidityMonths} onChange={set('minimumLiquidityMonths')} type="number" min="0" max="24" step="0.5" placeholder="3" />
                    </FieldGroup>
                    <FieldGroup label="Rata massima (% del margine)" htmlFor="maxInstallmentToMarginRatio">
                      <Input id="maxInstallmentToMarginRatio" value={form.maxInstallmentToMarginRatio} onChange={set('maxInstallmentToMarginRatio')} type="number" min="0" max="100" step="1" placeholder="35" />
                    </FieldGroup>
                    <FieldGroup label="Orizzonte di analisi (mesi)" htmlFor="horizonMonths">
                      <div className="mt-1 flex gap-2">
                        {[3, 6, 12, 24].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => set('horizonMonths')(String(m))}
                            className={cn(
                              'flex-1 rounded-xl border py-2 text-xs font-semibold transition-all',
                              form.horizonMonths === String(m)
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                : 'border-[#e5e7f0] bg-white text-slate-500 hover:bg-slate-50',
                            )}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </FieldGroup>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.includeGoalContributions}
                      onChange={(e) => set('includeGoalContributions')(e.target.checked)}
                      className="h-4 w-4 rounded border-[#e5e7f0] text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Includi contributi agli obiettivi di risparmio</span>
                  </label>
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Come funziona</h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-500">
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  Le entrate e uscite mensili sono stimate dalla media degli ultimi 3 mesi di transazioni registrate.
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  Il calcolo è basato esclusivamente sui tuoi dati. Nessuna AI, nessuna API esterna.
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  La simulazione è temporanea. Nessun saldo, movimento o notifica viene creato.
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  I dati rimangono all'interno di Aurora e non vengono inviati a servizi esterni.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" disabled={loading || !form.purchaseName || !form.totalPrice} className="gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Valutazione in corso…
              </>
            ) : (
              <>
                Calcola
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Result */}
      {result && style && ClassIcon && (
        <section id="affordability-result" aria-live="polite" className="space-y-5">
          {/* Classification card */}
          <div className={cn('rounded-2xl border p-5 shadow-sm', style.bg, style.border)}>
            <div className="flex items-start gap-3">
              <ClassIcon className={cn('mt-0.5 h-6 w-6 shrink-0', style.text)} aria-hidden="true" />
              <div className="flex-1">
                <p className={cn('text-lg font-bold', style.text)}>{result.classificationLabel}</p>
                <p className="mt-2 text-sm text-slate-700">{result.summary}</p>
              </div>
              <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold', style.bg, style.border, style.text)}>
                {result.dataQuality === 'ALTA' ? 'Dati di qualità alta' :
                 result.dataQuality === 'MEDIA' ? 'Dati di qualità media' :
                 result.dataQuality === 'BASSA' ? 'Dati di qualità bassa' :
                 'Dati insufficienti'}
              </span>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Liquidità prima"
              value={fmt(result.liquidityBefore, result.currency)}
              sub={fmtMonths(result.coverageMonthsBefore) + ' di copertura'}
            />
            <MetricCard
              label="Liquidità dopo"
              value={fmt(result.liquidityAfter, result.currency)}
              sub={fmtMonths(result.coverageMonthsAfter) + ' di copertura'}
            />
            <MetricCard
              label="Margine mensile prima"
              value={fmt(result.monthlyMarginBefore, result.currency)}
              sub="entrate − uscite − rate − obiettivi"
            />
            <MetricCard
              label="Margine mensile dopo"
              value={fmt(result.monthlyMarginAfter, result.currency)}
              sub={result.installmentToMarginRatio != null ? `Rata: ${fmtPct(result.installmentToMarginRatio)} del margine` : undefined}
            />
          </div>

          {/* Cost breakdown */}
          <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Riepilogo costi</h3>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-slate-500">Costo iniziale totale</dt>
                <dd className="font-medium text-slate-900">{fmt(result.upfrontCost, result.currency)}</dd>
              </div>
              {result.monthlyInstallment > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Rata mensile</dt>
                  <dd className="font-medium text-slate-900">{fmt(result.monthlyInstallment, result.currency)}/mese</dd>
                </div>
              )}
              {result.balloonPayment > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Maxi-rata finale</dt>
                  <dd className="font-medium text-amber-700">{fmt(result.balloonPayment, result.currency)}</dd>
                </div>
              )}
              {result.recurringMonthlyCost > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-500">Costo ricorrente</dt>
                  <dd className="font-medium text-slate-900">{fmt(result.recurringMonthlyCost, result.currency)}/mese</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-[#e5e7f0] pt-2 text-sm font-semibold">
                <dt className="text-slate-700">Costo totale stimato</dt>
                <dd className="text-slate-900">{fmt(result.totalCostEstimate, result.currency)}</dd>
              </div>
            </dl>
          </div>

          {/* Max affordable price */}
          {result.maxAffordablePrice != null && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-indigo-800">
                Prezzo massimo compatibile con i tuoi parametri
              </p>
              <p className="mt-1 text-2xl font-bold text-indigo-700">{fmt(result.maxAffordablePrice, result.currency)}</p>
              {result.maxAffordablePriceNote && (
                <p className="mt-1 text-xs text-indigo-600">{result.maxAffordablePriceNote}</p>
              )}
            </div>
          )}

          {/* Projection chart */}
          <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Proiezione liquidità</h3>
            <ProjectionChart points={result.projections} currency={result.currency} />
            <p className="sr-only">
              Il grafico mostra l'andamento della liquidità nel periodo analizzato, confrontando la situazione senza acquisto (baseline) e con l'acquisto simulato (scenario).
            </p>
          </div>

          {/* Reasons */}
          {result.reasons.length > 0 && (
            <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Motivazioni della valutazione</h3>
              <ul className="space-y-3">
                {result.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span
                      className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', {
                        'bg-red-500': r.severity === 'critical',
                        'bg-amber-400': r.severity === 'warning',
                        'bg-slate-300': r.severity === 'info',
                      })}
                      aria-label={r.severity === 'critical' ? 'Critico' : r.severity === 'warning' ? 'Attenzione' : 'Informazione'}
                    />
                    <span className={cn('text-slate-700', SEVERITY_COLORS[r.severity])}>{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {result.risks.length > 0 && (
            <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Elementi da considerare</h3>
              <ul className="space-y-2">
                {result.risks.map((r, i) => (
                  <li key={i} className={cn('flex items-start gap-2 text-sm', SEVERITY_COLORS[r.severity])}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <div className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Alternative e suggerimenti</h3>
              <ul className="space-y-2">
                {result.alternatives.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
                    {a.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing data warnings */}
          {result.missingData.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-xs font-semibold text-amber-700">Dati mancanti o limitati</p>
              <ul className="space-y-1">
                {result.missingData.map((d, i) => (
                  <li key={i} className="text-xs text-amber-700">{d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recalculate */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="flex items-center gap-2 rounded-xl border border-[#e5e7f0] bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Modifica e ricalcola
            </button>
          </div>

          {/* Disclaimer */}
          <div className="rounded-xl border border-[#e5e7f0] bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{result.disclaimer}</p>
          </div>
        </section>
      )}
      </>
      )}
    </div>
  )
}
