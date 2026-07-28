'use client'

import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Home,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import type { AffordabilityClassification, Severity } from '@/lib/affordability/types'
import type { HomeAffordabilityResult } from '@/lib/affordability/home/types'
import {
  CURRENT_HOUSING_LABELS,
  HOME_CONDITION_LABELS,
  HOME_PAYMENT_MODE_LABELS,
  HOME_PURPOSE_LABELS,
  MORTGAGE_RATE_TYPE_LABELS,
} from '@/lib/affordability/home/constants'

const TODAY = new Date().toLocaleDateString('en-CA')

function parseNum(value: string): number | null {
  if (!value.trim()) return null
  const parsed = parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function fmt(value: number | null | undefined, currency = 'EUR') {
  return value == null ? '-' : formatCurrency(value, currency)
}

function fmtAxis(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
  return `€${v.toFixed(0)}`
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

function Input({ id, value, onChange, type = 'text', placeholder, min, max, step }: {
  id: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  min?: string
  max?: string
  step?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className="mt-1 block w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  )
}

function Select({ id, value, onChange, children }: { id: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 block w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      {children}
    </select>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

function Section({ title, helper, children, defaultOpen = false }: { title: string; helper?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-[#e5e7f0] bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          {title}
          {helper && <span className="mt-0.5 block text-xs font-normal text-slate-500">{helper}</span>}
        </span>
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

type HomeFormState = Record<string, string> & {
  condition: 'new_build' | 'used'
  purpose: 'primary_home' | 'other_home'
  paymentMode: 'IMMEDIATE' | 'MORTGAGE'
  mortgageRateType: '' | 'fixed' | 'variable'
  currentHousingType: '' | 'rent' | 'mortgage' | 'owned_no_mortgage' | 'other'
  recurringTaxesExempt: string
  includeGoalContributions: string
}

const INITIAL_FORM: HomeFormState = {
  simulationName: '',
  description: '',
  condition: 'used',
  purpose: 'primary_home',
  askingPrice: '',
  agreedPrice: '',
  purchaseDate: TODAY,
  ownershipYears: '20',
  surfaceSqm: '',
  householdMembers: '',
  discount: '',
  familyContribution: '',
  manualBenefit: '',
  propertySaleProceeds: '',
  otherContribution: '',
  depositPaid: '',
  paymentMode: 'MORTGAGE',
  accountId: '',
  cashPaymentAmount: '',
  downPayment: '',
  mortgageAmount: '',
  mortgageDurationMonths: '300',
  mortgageMonthlyPayment: '',
  firstMortgagePaymentDate: '',
  mortgageRateType: '',
  tan: '',
  taeg: '',
  mfOrigination: '',
  mfAppraisal: '',
  mfMandatoryInsurance: '',
  mfInstallmentCollection: '',
  mfPreAmortization: '',
  mfBalloonPayment: '',
  debitAccountId: '',
  notary: '',
  taxes: '',
  agency: '',
  appraisal: '',
  origination: '',
  initialInsurance: '',
  broker: '',
  registrations: '',
  certifications: '',
  technicalFees: '',
  moving: '',
  utilityConnections: '',
  deposits: '',
  acquisitionOther: '',
  renovationTotal: '',
  renovationAlreadyPaid: '',
  renovationDurationMonths: '',
  renovationMonthlyPayment: '',
  renovationInstallments: '',
  renovationUnexpected: '',
  renovationContingencyPercent: '',
  renovationFuture: '',
  furniture: '',
  kitchen: '',
  appliances: '',
  lighting: '',
  climate: '',
  smartHome: '',
  gardenTerrace: '',
  furnishingOther: '',
  furnishingDeferrable: '',
  furnishingMonthly: '',
  furnishingInstallments: '',
  condominiumMonthly: '',
  condominiumExtraordinary: '',
  condominiumReserve: '',
  condominiumOther: '',
  electricity: '',
  gas: '',
  water: '',
  internet: '',
  waste: '',
  utilitiesOther: '',
  currentUtilitiesMonthly: '',
  insuranceHome: '',
  insuranceFire: '',
  insuranceNatural: '',
  insuranceLiability: '',
  insuranceOther: '',
  imuAnnual: '',
  tariAnnual: '',
  recurringTaxesOther: '',
  recurringTaxesExempt: 'false',
  recurringTaxesExemptionYears: '',
  maintenanceOrdinary: '',
  maintenanceExtraordinary: '',
  boilerAnnual: '',
  climateAnnual: '',
  systemsAnnual: '',
  gardenAnnual: '',
  maintenanceOther: '',
  currentHousingType: '',
  currentRent: '',
  currentMortgage: '',
  currentCondominium: '',
  currentUtilities: '',
  currentInsuranceAnnual: '',
  currentTaxesAnnual: '',
  currentMaintenanceAnnual: '',
  currentParking: '',
  currentOther: '',
  recoverableDeposit: '',
  futureRentalIncome: '',
  currentPropertySale: '',
  currentRemainingDebt: '',
  currentSellingCosts: '',
  residualPropertyValue: '',
  residualMortgageDebt: '',
  residualSellingCosts: '',
  residualTaxes: '',
  minimumLiquidityMonths: '6',
  maxInstallmentToMarginRatio: '35',
  horizonMonths: '360',
  includeGoalContributions: 'true',
}

function buildPayload(f: HomeFormState) {
  const pn = parseNum
  const num = (key: string) => pn(f[key])
  return {
    simulationName: f.simulationName,
    description: f.description || null,
    condition: f.condition,
    purpose: f.purpose,
    askingPrice: num('askingPrice') ?? 0,
    agreedPrice: num('agreedPrice') ?? num('askingPrice') ?? 0,
    purchaseDate: f.purchaseDate,
    currency: 'EUR',
    ownershipYears: num('ownershipYears') ?? 20,
    surfaceSqm: num('surfaceSqm'),
    householdMembers: num('householdMembers') ? parseInt(f.householdMembers) : null,
    discount: num('discount'),
    familyContribution: num('familyContribution'),
    manualBenefit: num('manualBenefit'),
    propertySaleProceeds: num('propertySaleProceeds'),
    otherContribution: num('otherContribution'),
    depositPaid: num('depositPaid'),
    paymentMode: f.paymentMode,
    accountId: f.accountId || null,
    cashPaymentAmount: num('cashPaymentAmount'),
    downPayment: num('downPayment'),
    mortgageAmount: num('mortgageAmount'),
    mortgageDurationMonths: num('mortgageDurationMonths') ? parseInt(f.mortgageDurationMonths) : null,
    mortgageMonthlyPayment: num('mortgageMonthlyPayment'),
    firstMortgagePaymentDate: f.firstMortgagePaymentDate || null,
    mortgageRateType: f.mortgageRateType || null,
    tan: num('tan'),
    taeg: num('taeg'),
    mortgageFees: {
      origination: num('mfOrigination'),
      appraisal: num('mfAppraisal'),
      mandatoryInsurance: num('mfMandatoryInsurance'),
      installmentCollection: num('mfInstallmentCollection'),
      preAmortization: num('mfPreAmortization'),
      balloonPayment: num('mfBalloonPayment'),
    },
    debitAccountId: f.debitAccountId || null,
    acquisitionCosts: {
      notary: num('notary'),
      taxes: num('taxes'),
      agency: num('agency'),
      appraisal: num('appraisal'),
      origination: num('origination'),
      initialInsurance: num('initialInsurance'),
      broker: num('broker'),
      registrations: num('registrations'),
      certifications: num('certifications'),
      technicalFees: num('technicalFees'),
      moving: num('moving'),
      utilityConnections: num('utilityConnections'),
      deposits: num('deposits'),
      other: num('acquisitionOther'),
    },
    renovation: {
      totalEstimated: num('renovationTotal'),
      alreadyPaid: num('renovationAlreadyPaid'),
      durationMonths: num('renovationDurationMonths') ? parseInt(f.renovationDurationMonths) : null,
      paymentMode: num('renovationMonthlyPayment') ? 'monthly' : 'one_time',
      monthlyPayment: num('renovationMonthlyPayment'),
      numberOfInstallments: num('renovationInstallments') ? parseInt(f.renovationInstallments) : null,
      unexpectedExtra: num('renovationUnexpected'),
      contingencyPercent: num('renovationContingencyPercent'),
      futurePlanned: num('renovationFuture'),
    },
    furnishing: {
      furniture: num('furniture'),
      kitchen: num('kitchen'),
      appliances: num('appliances'),
      lighting: num('lighting'),
      climate: num('climate'),
      smartHome: num('smartHome'),
      gardenTerrace: num('gardenTerrace'),
      otherInitial: num('furnishingOther'),
      deferrable: num('furnishingDeferrable'),
      monthlyInstallment: num('furnishingMonthly'),
      numberOfInstallments: num('furnishingInstallments') ? parseInt(f.furnishingInstallments) : null,
    },
    condominium: {
      monthly: num('condominiumMonthly'),
      extraordinaryKnown: num('condominiumExtraordinary'),
      reserveFund: num('condominiumReserve'),
      otherCommon: num('condominiumOther'),
    },
    utilities: {
      electricity: num('electricity'),
      gas: num('gas'),
      water: num('water'),
      internet: num('internet'),
      waste: num('waste'),
      other: num('utilitiesOther'),
      currentMonthly: num('currentUtilitiesMonthly'),
    },
    insurance: {
      homeAnnual: num('insuranceHome'),
      fireAnnual: num('insuranceFire'),
      naturalEventsAnnual: num('insuranceNatural'),
      liabilityAnnual: num('insuranceLiability'),
      otherAnnual: num('insuranceOther'),
    },
    recurringTaxes: {
      imuAnnual: num('imuAnnual'),
      tariAnnual: num('tariAnnual'),
      otherAnnual: num('recurringTaxesOther'),
      exempt: f.recurringTaxesExempt === 'true',
      exemptionYears: num('recurringTaxesExemptionYears') ? parseInt(f.recurringTaxesExemptionYears) : null,
    },
    maintenance: {
      ordinaryAnnual: num('maintenanceOrdinary'),
      extraordinaryEstimated: num('maintenanceExtraordinary'),
      boilerAnnual: num('boilerAnnual'),
      climateAnnual: num('climateAnnual'),
      systemsAnnual: num('systemsAnnual'),
      gardenAnnual: num('gardenAnnual'),
      otherAnnual: num('maintenanceOther'),
    },
    currentHousing: {
      type: f.currentHousingType || null,
      rentMonthly: num('currentRent'),
      mortgageMonthly: num('currentMortgage'),
      condominiumMonthly: num('currentCondominium'),
      utilitiesMonthly: num('currentUtilities'),
      insuranceAnnual: num('currentInsuranceAnnual'),
      taxesAnnual: num('currentTaxesAnnual'),
      maintenanceAnnual: num('currentMaintenanceAnnual'),
      parkingMonthly: num('currentParking'),
      otherMonthly: num('currentOther'),
      recoverableDeposit: num('recoverableDeposit'),
      futureRentalIncomeMonthly: num('futureRentalIncome'),
      propertySaleProceeds: num('currentPropertySale'),
      remainingMortgageDebt: num('currentRemainingDebt'),
      sellingCosts: num('currentSellingCosts'),
    },
    residualValue: {
      estimatedPropertyValue: num('residualPropertyValue'),
      residualMortgageDebt: num('residualMortgageDebt'),
      sellingCosts: num('residualSellingCosts'),
      taxesOrCommissions: num('residualTaxes'),
    },
    minimumLiquidityMonths: num('minimumLiquidityMonths') ?? 6,
    maxInstallmentToMarginRatio: num('maxInstallmentToMarginRatio') ? (num('maxInstallmentToMarginRatio') ?? 35) / 100 : 0.35,
    horizonMonths: num('horizonMonths') ? parseInt(f.horizonMonths) : 360,
    includeGoalContributions: f.includeGoalContributions === 'true',
  }
}

function ProjectionChart({ result }: { result: HomeAffordabilityResult }) {
  const points = result.projections
  if (points.length === 0) return null
  return (
    <div className="h-56 sm:h-72" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="homeBase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="homeScenario" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.ceil(points.length / 10) - 1)} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={fmtAxis} width={60} />
          <Tooltip formatter={(v, name) => [fmt(Number(v), result.currency), name === 'baselineLiquidity' ? 'Senza acquisto' : 'Con casa']} />
          <Legend formatter={(v) => v === 'baselineLiquidity' ? 'Senza acquisto' : 'Con casa'} wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="baselineLiquidity" stroke="#94a3b8" fill="url(#homeBase)" strokeWidth={1.5} dot={false} />
          <Area type="monotone" dataKey="scenarioLiquidity" stroke="#6366f1" fill="url(#homeScenario)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function ResultSection({ result }: { result: HomeAffordabilityResult }) {
  const style = CLASS_STYLES[result.classification]
  const Icon = style.icon
  const m = result.homeMetrics
  const c = result.currency
  return (
    <section id="home-result" aria-live="polite" className="space-y-5">
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
        <MetricCard label="Prezzo effettivo" value={fmt(m.effectivePropertyPrice, c)} highlight />
        <MetricCard label="Esborso iniziale" value={fmt(m.upfrontHomeCost, c)} />
        <MetricCard label="Rata mutuo" value={`${fmt(m.mortgageMonthlyPayment, c)}/mese`} />
        <MetricCard label="Costo abitativo medio" value={`${fmt(m.averageMonthlyHousingCost, c)}/mese`} highlight />
        <MetricCard label="Incremento vs oggi" value={`${fmt(m.incrementalMonthlyHousingCost, c)}/mese`} />
        <MetricCard label="Costo annuale" value={fmt(m.totalAnnualHousingCost, c)} />
        <MetricCard label="Costo totale periodo" value={fmt(m.totalOwnershipCost, c)} />
        <MetricCard label="Valore netto stimato" value={fmt(m.estimatedNetEquity, c)} sub="Stima inserita dall'utente" />
      </div>

      <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Dettaglio dei costi</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {m.costBreakdown.filter((row) => row.amount > 0).map((row) => (
            <div key={row.label} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-medium text-slate-900">{fmt(row.amount, c)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Proiezione liquidità</p>
        <ProjectionChart result={result} />
        <p className="mt-2 text-xs text-slate-500">
          Il grafico distingue la liquidità senza acquisto e con acquisto. I costi annuali restano eventi/stime della simulazione, non movimenti reali.
        </p>
      </div>

      {result.maxAffordablePriceNote && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-sm font-semibold text-indigo-800">Prezzo massimo compatibile</p>
          <p className="mt-1 text-xl font-bold text-indigo-700">{fmt(result.maxAffordablePrice, c)}</p>
          <p className="mt-1 text-xs text-indigo-600">{result.maxAffordablePriceNote}</p>
        </div>
      )}

      {result.reasons.length > 0 && (
        <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Motivazioni</p>
          <ul className="space-y-2">
            {result.reasons.slice(0, 8).map((reason, index) => (
              <li key={index} className={cn('text-sm', SEVERITY_COLORS[reason.severity])}>{reason.text}</li>
            ))}
          </ul>
        </div>
      )}

      {result.risks.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">Rischi e limiti</p>
          <ul className="space-y-1 text-sm text-amber-700">
            {result.risks.map((risk, index) => <li key={index}>{risk.text}</li>)}
          </ul>
        </div>
      )}

      {result.alternatives.length > 0 && (
        <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Alternative deterministiche</p>
          <ul className="space-y-2 text-sm text-slate-600">
            {result.alternatives.slice(0, 8).map((alt, index) => (
              <li key={index} className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />{alt.text}</li>
            ))}
          </ul>
        </div>
      )}

      {result.missingData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Costi mancanti</p>
          <p className="text-sm text-slate-600">{result.missingData.join(' ')}</p>
        </div>
      )}
    </section>
  )
}

export default function HomeEvaluation() {
  const [form, setForm] = useState<HomeFormState>(INITIAL_FORM)
  const [result, setResult] = useState<HomeAffordabilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof HomeFormState) {
    return (value: string) => setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/affordability/home/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message ?? 'Dati non validi per la valutazione casa.')
      setResult(body.data)
      setTimeout(() => document.getElementById('home-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non è stato possibile completare la valutazione. Nessun dato finanziario è stato modificato.')
    } finally {
      setLoading(false)
    }
  }

  const effectivePreview = Math.max(0, (parseNum(form.agreedPrice) ?? parseNum(form.askingPrice) ?? 0) -
    ((parseNum(form.discount) ?? 0) + (parseNum(form.familyContribution) ?? 0) + (parseNum(form.manualBenefit) ?? 0) + (parseNum(form.propertySaleProceeds) ?? 0) + (parseNum(form.otherContribution) ?? 0)))

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex items-start gap-3">
          <Home className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold text-indigo-900">Posso permettermi questa casa?</p>
            <p className="mt-1 text-sm text-indigo-700">
              La simulazione considera prezzo, anticipo, mutuo, costi iniziali e costi abitativi ricorrenti. Nessun saldo o movimento reale viene modificato.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Section title="1. Immobile" defaultOpen>
          <FieldGrid>
            <div><Label htmlFor="simulationName">Nome simulazione *</Label><Input id="simulationName" value={form.simulationName} onChange={set('simulationName')} placeholder="Casa Ischia" /></div>
            <div><Label htmlFor="description">Descrizione o indirizzo</Label><Input id="description" value={form.description} onChange={set('description')} placeholder="Facoltativo" /></div>
            <div><Label htmlFor="condition">Tipo immobile</Label><Select id="condition" value={form.condition} onChange={set('condition')}>{Object.entries(HOME_CONDITION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
            <div><Label htmlFor="purpose">Uso</Label><Select id="purpose" value={form.purpose} onChange={set('purpose')}>{Object.entries(HOME_PURPOSE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
            <div><Label htmlFor="askingPrice">Prezzo richiesto (€) *</Label><Input id="askingPrice" value={form.askingPrice} onChange={set('askingPrice')} type="number" min="1" step="1000" /></div>
            <div><Label htmlFor="agreedPrice">Prezzo concordato (€) *</Label><Input id="agreedPrice" value={form.agreedPrice} onChange={set('agreedPrice')} type="number" min="1" step="1000" /></div>
            <div><Label htmlFor="purchaseDate">Data prevista acquisto *</Label><Input id="purchaseDate" value={form.purchaseDate} onChange={set('purchaseDate')} type="date" /></div>
            <div><Label htmlFor="ownershipYears">Anni previsti di possesso</Label><Input id="ownershipYears" value={form.ownershipYears} onChange={set('ownershipYears')} type="number" min="1" max="60" /></div>
          </FieldGrid>
        </Section>

        <Section title="2. Prezzo e contributi" helper="Inserisci soltanto contributi o agevolazioni di cui conosci già l'importo." defaultOpen>
          <FieldGrid>
            <div><Label htmlFor="discount">Sconto (€)</Label><Input id="discount" value={form.discount} onChange={set('discount')} type="number" min="0" /></div>
            <div><Label htmlFor="familyContribution">Contributo familiare (€)</Label><Input id="familyContribution" value={form.familyContribution} onChange={set('familyContribution')} type="number" min="0" /></div>
            <div><Label htmlFor="manualBenefit">Agevolazione manuale (€)</Label><Input id="manualBenefit" value={form.manualBenefit} onChange={set('manualBenefit')} type="number" min="0" /></div>
            <div><Label htmlFor="propertySaleProceeds">Ricavo vendita immobile (€)</Label><Input id="propertySaleProceeds" value={form.propertySaleProceeds} onChange={set('propertySaleProceeds')} type="number" min="0" /></div>
            <div><Label htmlFor="otherContribution">Altro contributo (€)</Label><Input id="otherContribution" value={form.otherContribution} onChange={set('otherContribution')} type="number" min="0" /></div>
            <div><Label htmlFor="depositPaid">Caparra già versata (€)</Label><Input id="depositPaid" value={form.depositPaid} onChange={set('depositPaid')} type="number" min="0" /></div>
          </FieldGrid>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Prezzo effettivo stimato: <strong className="text-slate-900">{fmt(effectivePreview)}</strong>. La caparra non riduce il costo totale: viene trattata come quota già sostenuta.
          </div>
        </Section>

        <Section title="3. Mutuo o pagamento">
          <FieldGrid>
            <div><Label htmlFor="paymentMode">Modalità</Label><Select id="paymentMode" value={form.paymentMode} onChange={set('paymentMode')}>{Object.entries(HOME_PAYMENT_MODE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
            <div><Label htmlFor="accountId">UUID conto pagamento</Label><Input id="accountId" value={form.accountId} onChange={set('accountId')} placeholder="Facoltativo" /></div>
            {form.paymentMode === 'IMMEDIATE' && <div><Label htmlFor="cashPaymentAmount">Importo pagamento (€)</Label><Input id="cashPaymentAmount" value={form.cashPaymentAmount} onChange={set('cashPaymentAmount')} type="number" min="0" /></div>}
            {form.paymentMode === 'MORTGAGE' && (
              <>
                <div><Label htmlFor="downPayment">Anticipo (€)</Label><Input id="downPayment" value={form.downPayment} onChange={set('downPayment')} type="number" min="0" /></div>
                <div><Label htmlFor="mortgageAmount">Importo mutuo (€)</Label><Input id="mortgageAmount" value={form.mortgageAmount} onChange={set('mortgageAmount')} type="number" min="0" /></div>
                <div><Label htmlFor="mortgageMonthlyPayment">Rata mensile (€) *</Label><Input id="mortgageMonthlyPayment" value={form.mortgageMonthlyPayment} onChange={set('mortgageMonthlyPayment')} type="number" min="0" /></div>
                <div><Label htmlFor="mortgageDurationMonths">Durata mutuo (mesi) *</Label><Input id="mortgageDurationMonths" value={form.mortgageDurationMonths} onChange={set('mortgageDurationMonths')} type="number" min="1" max="600" /></div>
                <div><Label htmlFor="firstMortgagePaymentDate">Prima rata</Label><Input id="firstMortgagePaymentDate" value={form.firstMortgagePaymentDate} onChange={set('firstMortgagePaymentDate')} type="date" /></div>
                <div><Label htmlFor="mortgageRateType">Tipo tasso</Label><Select id="mortgageRateType" value={form.mortgageRateType} onChange={set('mortgageRateType')}><option value="">Non indicato</option>{Object.entries(MORTGAGE_RATE_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
              </>
            )}
          </FieldGrid>
        </Section>

        <Section title="4. Costi iniziali">
          <FieldGrid>
            <div><Label htmlFor="notary">Notaio (€)</Label><Input id="notary" value={form.notary} onChange={set('notary')} type="number" min="0" /></div>
            <div><Label htmlFor="taxes">Imposte (€)</Label><Input id="taxes" value={form.taxes} onChange={set('taxes')} type="number" min="0" /></div>
            <div><Label htmlFor="agency">Agenzia immobiliare (€)</Label><Input id="agency" value={form.agency} onChange={set('agency')} type="number" min="0" /></div>
            <div><Label htmlFor="appraisal">Perizia (€)</Label><Input id="appraisal" value={form.appraisal} onChange={set('appraisal')} type="number" min="0" /></div>
            <div><Label htmlFor="origination">Istruttoria (€)</Label><Input id="origination" value={form.origination} onChange={set('origination')} type="number" min="0" /></div>
            <div><Label htmlFor="moving">Trasloco (€)</Label><Input id="moving" value={form.moving} onChange={set('moving')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        <Section title="5. Lavori e arredamento" helper="Aurora non stima automaticamente lavori o mobili.">
          <FieldGrid>
            <div><Label htmlFor="renovationTotal">Ristrutturazione stimata (€)</Label><Input id="renovationTotal" value={form.renovationTotal} onChange={set('renovationTotal')} type="number" min="0" /></div>
            <div><Label htmlFor="renovationContingencyPercent">Margine imprevisti (%)</Label><Input id="renovationContingencyPercent" value={form.renovationContingencyPercent} onChange={set('renovationContingencyPercent')} type="number" min="0" max="100" /></div>
            <div><Label htmlFor="kitchen">Cucina (€)</Label><Input id="kitchen" value={form.kitchen} onChange={set('kitchen')} type="number" min="0" /></div>
            <div><Label htmlFor="furniture">Mobili (€)</Label><Input id="furniture" value={form.furniture} onChange={set('furniture')} type="number" min="0" /></div>
            <div><Label htmlFor="appliances">Elettrodomestici (€)</Label><Input id="appliances" value={form.appliances} onChange={set('appliances')} type="number" min="0" /></div>
            <div><Label htmlFor="furnishingDeferrable">Arredamento rinviabile (€)</Label><Input id="furnishingDeferrable" value={form.furnishingDeferrable} onChange={set('furnishingDeferrable')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        <Section title="6. Costi abitativi ricorrenti">
          <FieldGrid>
            <div><Label htmlFor="condominiumMonthly">Condominio mensile (€)</Label><Input id="condominiumMonthly" value={form.condominiumMonthly} onChange={set('condominiumMonthly')} type="number" min="0" /></div>
            <div><Label htmlFor="electricity">Energia elettrica (€ / mese)</Label><Input id="electricity" value={form.electricity} onChange={set('electricity')} type="number" min="0" /></div>
            <div><Label htmlFor="gas">Gas (€ / mese)</Label><Input id="gas" value={form.gas} onChange={set('gas')} type="number" min="0" /></div>
            <div><Label htmlFor="water">Acqua (€ / mese)</Label><Input id="water" value={form.water} onChange={set('water')} type="number" min="0" /></div>
            <div><Label htmlFor="internet">Internet (€ / mese)</Label><Input id="internet" value={form.internet} onChange={set('internet')} type="number" min="0" /></div>
            <div><Label htmlFor="waste">Rifiuti (€ / mese)</Label><Input id="waste" value={form.waste} onChange={set('waste')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        <Section title="7. Assicurazione, imposte, manutenzione">
          <FieldGrid>
            <div><Label htmlFor="insuranceHome">Assicurazione casa (€ / anno)</Label><Input id="insuranceHome" value={form.insuranceHome} onChange={set('insuranceHome')} type="number" min="0" /></div>
            <div><Label htmlFor="insuranceFire">Incendio e scoppio (€ / anno)</Label><Input id="insuranceFire" value={form.insuranceFire} onChange={set('insuranceFire')} type="number" min="0" /></div>
            <div><Label htmlFor="imuAnnual">IMU (€ / anno)</Label><Input id="imuAnnual" value={form.imuAnnual} onChange={set('imuAnnual')} type="number" min="0" /></div>
            <div><Label htmlFor="tariAnnual">TARI (€ / anno)</Label><Input id="tariAnnual" value={form.tariAnnual} onChange={set('tariAnnual')} type="number" min="0" /></div>
            <div><Label htmlFor="maintenanceOrdinary">Manutenzione ordinaria (€ / anno)</Label><Input id="maintenanceOrdinary" value={form.maintenanceOrdinary} onChange={set('maintenanceOrdinary')} type="number" min="0" /></div>
            <div><Label htmlFor="maintenanceExtraordinary">Manutenzione straordinaria (€)</Label><Input id="maintenanceExtraordinary" value={form.maintenanceExtraordinary} onChange={set('maintenanceExtraordinary')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        <Section title="8. Abitazione attuale" helper="Serve a calcolare l'incremento reale, non solo il costo totale della nuova casa.">
          <FieldGrid>
            <div><Label htmlFor="currentHousingType">Situazione attuale</Label><Select id="currentHousingType" value={form.currentHousingType} onChange={set('currentHousingType')}><option value="">Non indicata</option>{Object.entries(CURRENT_HOUSING_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
            <div><Label htmlFor="currentRent">Affitto mensile (€)</Label><Input id="currentRent" value={form.currentRent} onChange={set('currentRent')} type="number" min="0" /></div>
            <div><Label htmlFor="currentMortgage">Rata mutuo attuale (€)</Label><Input id="currentMortgage" value={form.currentMortgage} onChange={set('currentMortgage')} type="number" min="0" /></div>
            <div><Label htmlFor="currentCondominium">Condominio attuale (€ / mese)</Label><Input id="currentCondominium" value={form.currentCondominium} onChange={set('currentCondominium')} type="number" min="0" /></div>
            <div><Label htmlFor="currentUtilities">Utenze attuali (€ / mese)</Label><Input id="currentUtilities" value={form.currentUtilities} onChange={set('currentUtilities')} type="number" min="0" /></div>
            <div><Label htmlFor="futureRentalIncome">Reddito locazione futuro (€ / mese)</Label><Input id="futureRentalIncome" value={form.futureRentalIncome} onChange={set('futureRentalIncome')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        <Section title="9. Valore residuo e prudenza">
          <FieldGrid>
            <div><Label htmlFor="residualPropertyValue">Valore immobile a fine periodo (€)</Label><Input id="residualPropertyValue" value={form.residualPropertyValue} onChange={set('residualPropertyValue')} type="number" min="0" /></div>
            <div><Label htmlFor="residualMortgageDebt">Debito mutuo residuo (€)</Label><Input id="residualMortgageDebt" value={form.residualMortgageDebt} onChange={set('residualMortgageDebt')} type="number" min="0" /></div>
            <div><Label htmlFor="minimumLiquidityMonths">Fondo minimo (mesi di spese)</Label><Input id="minimumLiquidityMonths" value={form.minimumLiquidityMonths} onChange={set('minimumLiquidityMonths')} type="number" min="0" max="60" /></div>
            <div><Label htmlFor="maxInstallmentToMarginRatio">Rata massima (% margine)</Label><Input id="maxInstallmentToMarginRatio" value={form.maxInstallmentToMarginRatio} onChange={set('maxInstallmentToMarginRatio')} type="number" min="0" max="100" /></div>
          </FieldGrid>
        </Section>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <p>Riepilogo prima del calcolo: prezzo effettivo {fmt(effectivePreview)}, modalità {HOME_PAYMENT_MODE_LABELS[form.paymentMode]}, orizzonte {form.ownershipYears || '?'} anni.</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading || !form.simulationName || !form.askingPrice} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Home className="h-4 w-4" />}
            {loading ? 'Valutazione in corso…' : 'Valuta acquisto casa'}
          </Button>
          {result && (
            <button type="button" onClick={() => setResult(null)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
              <RefreshCw className="h-3 w-3" />
              Nuova valutazione
            </button>
          )}
        </div>
      </form>

      {result && <ResultSection result={result} />}
    </div>
  )
}
