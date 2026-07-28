'use client'

import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
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
import type { AffordabilityClassification, Severity } from '@/lib/affordability/types'
import type { CarAffordabilityResult } from '@/lib/affordability/car/types'
import { FUEL_TYPE_LABELS, CAR_CONDITION_LABELS, CAR_PAYMENT_MODE_LABELS } from '@/lib/affordability/car/constants'
import { DISCLAIMER, SIMULATION_NOTE } from '@/lib/affordability/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY = new Date().toLocaleDateString('en-CA')

function fmt(n: number | null | undefined, currency = 'EUR') {
  if (n == null) return '—'
  return formatCurrency(n, currency)
}

function fmtAxis(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
  return `€${v.toFixed(0)}`
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
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

// ── UI primitives ──────────────────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
      {children}
    </label>
  )
}

function Input({
  id, value, onChange, type = 'text', placeholder, min, max, step,
}: {
  id: string; value: string; onChange: (v: string) => void; type?: string
  placeholder?: string; min?: string; max?: string; step?: string
}) {
  return (
    <input
      id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} min={min} max={max} step={step}
      className="mt-1 block w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  )
}

function Select({ id, value, onChange, children }: { id: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      id={id} value={value} onChange={(e) => onChange(e.target.value)}
      className="mt-1 block w-full rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      {children}
    </select>
  )
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-[#e5e7f0]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-[#e5e7f0] px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
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

// ── Form state ────────────────────────────────────────────────────────────────

type CarFormState = {
  carName: string; purchasePrice: string; paymentMode: 'IMMEDIATE' | 'FINANCING'
  purchaseDate: string; ownershipYears: string; condition: string; fuelType: string; annualKm: string
  listPrice: string; discount: string; incentive: string; subsidy: string; tradeInValue: string
  currentCarSaleProceeds: string; otherPriceContributions: string
  downPayment: string; installmentAmount: string; numberOfInstallments: string
  firstInstallmentDate: string; financingFees: string; balloonPayment: string
  icRegistration: string; icTransfer: string; icDelivery: string; icAccessories: string
  icInstallation: string; icInitialInsurance: string; icInitialTax: string; icWallbox: string; icOther: string
  insRcAnnual: string; insTheftFireAnnual: string; insKaskoAnnual: string; insOtherAnnual: string
  taxBolloAnnual: string; taxExempt: boolean; taxExemptionYears: string; taxOtherAnnual: string
  fuelMode: 'monthly_estimate' | 'usage_calculation'; fuelMonthlyEstimate: string
  fuelConsumptionPer100: string; fuelPrice: string
  maintOrdinaryAnnual: string; maintExtraordinaryAnnual: string; maintServiceAnnual: string
  maintRevisionCost: string; maintRevisionIntervalMonths: string
  maintTiresCost: string; maintTiresIntervalMonths: string; maintOtherAnnual: string
  addParkingMonthly: string; addGarageMonthly: string; addTollsMonthly: string
  addWashingMonthly: string; addRoadsideAnnual: string; addOtherMonthly: string
  ccMonthlyInstallment: string; ccInsuranceMonthly: string; ccBolloAnnual: string
  ccFuelMonthly: string; ccMaintenanceMonthly: string; ccParkingMonthly: string; ccOtherMonthly: string
  ccSaleValue: string; ccRemainingFinancing: string
  estimatedResidualValue: string
  minimumLiquidityMonths: string; horizonMonths: string; includeGoalContributions: boolean
}

const INITIAL_FORM: CarFormState = {
  carName: '', purchasePrice: '', paymentMode: 'IMMEDIATE',
  purchaseDate: TODAY, ownershipYears: '5', condition: '', fuelType: '', annualKm: '',
  listPrice: '', discount: '', incentive: '', subsidy: '', tradeInValue: '',
  currentCarSaleProceeds: '', otherPriceContributions: '',
  downPayment: '', installmentAmount: '', numberOfInstallments: '',
  firstInstallmentDate: '', financingFees: '', balloonPayment: '',
  icRegistration: '', icTransfer: '', icDelivery: '', icAccessories: '',
  icInstallation: '', icInitialInsurance: '', icInitialTax: '', icWallbox: '', icOther: '',
  insRcAnnual: '', insTheftFireAnnual: '', insKaskoAnnual: '', insOtherAnnual: '',
  taxBolloAnnual: '', taxExempt: false, taxExemptionYears: '', taxOtherAnnual: '',
  fuelMode: 'monthly_estimate', fuelMonthlyEstimate: '', fuelConsumptionPer100: '', fuelPrice: '',
  maintOrdinaryAnnual: '', maintExtraordinaryAnnual: '', maintServiceAnnual: '',
  maintRevisionCost: '', maintRevisionIntervalMonths: '24',
  maintTiresCost: '', maintTiresIntervalMonths: '48', maintOtherAnnual: '',
  addParkingMonthly: '', addGarageMonthly: '', addTollsMonthly: '',
  addWashingMonthly: '', addRoadsideAnnual: '', addOtherMonthly: '',
  ccMonthlyInstallment: '', ccInsuranceMonthly: '', ccBolloAnnual: '',
  ccFuelMonthly: '', ccMaintenanceMonthly: '', ccParkingMonthly: '', ccOtherMonthly: '',
  ccSaleValue: '', ccRemainingFinancing: '',
  estimatedResidualValue: '',
  minimumLiquidityMonths: '3', horizonMonths: '24', includeGoalContributions: true,
}

function buildPayload(f: CarFormState) {
  const pn = parseNum
  const isFinancing = f.paymentMode === 'FINANCING'

  const initialCosts = {
    registration: pn(f.icRegistration), transfer: pn(f.icTransfer), delivery: pn(f.icDelivery),
    accessories: pn(f.icAccessories), installation: pn(f.icInstallation),
    initialInsurance: pn(f.icInitialInsurance), initialTax: pn(f.icInitialTax),
    wallbox: pn(f.icWallbox), other: pn(f.icOther),
  }

  const insurance = {
    rcAnnual: pn(f.insRcAnnual), theftFireAnnual: pn(f.insTheftFireAnnual),
    kaskoAnnual: pn(f.insKaskoAnnual), otherAnnual: pn(f.insOtherAnnual),
  }

  const tax = {
    bolloAnnual: pn(f.taxBolloAnnual), exempt: f.taxExempt,
    exemptionYears: pn(f.taxExemptionYears) ? parseInt(f.taxExemptionYears) : null,
    otherAnnual: pn(f.taxOtherAnnual),
  }

  const fuel = f.fuelMode === 'usage_calculation'
    ? { mode: 'usage_calculation' as const, consumptionPer100: pn(f.fuelConsumptionPer100), price: pn(f.fuelPrice) }
    : { mode: 'monthly_estimate' as const, monthlyEstimate: pn(f.fuelMonthlyEstimate) }

  const maintenance = {
    ordinaryAnnual: pn(f.maintOrdinaryAnnual), extraordinaryAnnual: pn(f.maintExtraordinaryAnnual),
    serviceAnnual: pn(f.maintServiceAnnual),
    revisionCost: pn(f.maintRevisionCost), revisionIntervalMonths: pn(f.maintRevisionIntervalMonths) ? parseInt(f.maintRevisionIntervalMonths) : null,
    tiresCost: pn(f.maintTiresCost), tiresIntervalMonths: pn(f.maintTiresIntervalMonths) ? parseInt(f.maintTiresIntervalMonths) : null,
    otherAnnual: pn(f.maintOtherAnnual),
  }

  const additional = {
    parkingMonthly: pn(f.addParkingMonthly), garageMonthly: pn(f.addGarageMonthly),
    tollsMonthly: pn(f.addTollsMonthly), washingMonthly: pn(f.addWashingMonthly),
    roadsideAssistanceAnnual: pn(f.addRoadsideAnnual), otherMonthly: pn(f.addOtherMonthly),
  }

  const hasCurrentCar = [f.ccMonthlyInstallment, f.ccInsuranceMonthly, f.ccFuelMonthly,
    f.ccMaintenanceMonthly, f.ccParkingMonthly].some((v) => v !== '')
  const currentCar = hasCurrentCar ? {
    monthlyInstallment: pn(f.ccMonthlyInstallment), insuranceMonthly: pn(f.ccInsuranceMonthly),
    bolloAnnual: pn(f.ccBolloAnnual), fuelMonthly: pn(f.ccFuelMonthly),
    maintenanceMonthly: pn(f.ccMaintenanceMonthly), parkingMonthly: pn(f.ccParkingMonthly),
    otherMonthly: pn(f.ccOtherMonthly), saleValue: pn(f.ccSaleValue),
    remainingFinancing: pn(f.ccRemainingFinancing),
  } : null

  return {
    carName: f.carName,
    purchasePrice: pn(f.purchasePrice) ?? 0,
    paymentMode: f.paymentMode,
    purchaseDate: f.purchaseDate,
    currency: 'EUR',
    ownershipYears: pn(f.ownershipYears) ?? 5,
    condition: f.condition || null,
    fuelType: f.fuelType || null,
    annualKm: pn(f.annualKm),
    listPrice: pn(f.listPrice),
    discount: pn(f.discount), incentive: pn(f.incentive), subsidy: pn(f.subsidy),
    tradeInValue: pn(f.tradeInValue), currentCarSaleProceeds: pn(f.currentCarSaleProceeds),
    otherPriceContributions: pn(f.otherPriceContributions),
    ...(isFinancing ? {
      downPayment: pn(f.downPayment), installmentAmount: pn(f.installmentAmount),
      numberOfInstallments: pn(f.numberOfInstallments) ? parseInt(f.numberOfInstallments) : null,
      firstInstallmentDate: f.firstInstallmentDate || null,
      financingFees: pn(f.financingFees), balloonPayment: pn(f.balloonPayment),
    } : {}),
    initialCosts, insurance, tax, fuel, maintenance, additional, currentCar,
    estimatedResidualValue: pn(f.estimatedResidualValue),
    minimumLiquidityMonths: pn(f.minimumLiquidityMonths) ?? 3,
    horizonMonths: pn(f.horizonMonths) ? parseInt(f.horizonMonths) : 24,
    includeGoalContributions: f.includeGoalContributions,
  }
}

// ── Result section ─────────────────────────────────────────────────────────────

function ResultSection({ result }: { result: CarAffordabilityResult }) {
  const cs = CLASS_STYLES[result.classification]
  const Icon = cs.icon
  const c = result.currency
  const m = result.carMetrics

  return (
    <div id="car-result" className="space-y-6">
      {/* Classification */}
      <div className={cn('rounded-2xl border-2 p-5', cs.bg, cs.border)}>
        <div className="flex items-start gap-3">
          <Icon className={cn('mt-0.5 h-6 w-6 shrink-0', cs.text)} />
          <div>
            <p className={cn('text-lg font-bold', cs.text)}>{result.classificationLabel}</p>
            <p className="mt-1 text-sm text-slate-600">{result.summary}</p>
          </div>
        </div>
        {result.sustainabilityScore != null && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Indice di sostenibilità</span>
              <span className={cn('font-bold', cs.text)}>{result.sustainabilityScore}/100</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={cn('h-2 rounded-full transition-all', cs.text.replace('text-', 'bg-'))}
                style={{ width: `${result.sustainabilityScore}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Car metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard label="Costo medio mensile" value={fmt(m.averageMonthlyOwnershipCost, c)} sub="su tutto il periodo" highlight />
        <MetricCard label="Costo mensile ricorrente" value={fmt(m.totalMonthlyRunningCost, c)} sub="assicur. + bollo + carb. + manut." />
        <MetricCard label="Costo totale di possesso" value={fmt(m.totalOwnershipCost, c)} sub={`su ${result.carMetrics.ownershipPeriodMonths / 12} anni`} />
        <MetricCard label="Costo netto (con valore residuo)" value={fmt(m.netOwnershipCost, c)} />
        {m.costPerKilometer != null && (
          <MetricCard label="Costo per km" value={`${fmt(m.costPerKilometer, c)}/km`} />
        )}
        <MetricCard label="Liquidità prima" value={fmt(result.liquidityBefore, c)} />
        <MetricCard label="Liquidità dopo acquisto" value={fmt(result.liquidityAfter, c)} />
        {m.currentCarMonthlyCost > 0 && (
          <MetricCard
            label="Costo incrementale vs. auto attuale"
            value={fmt(m.incrementalMonthlyCost, c) + '/mese'}
            sub={m.incrementalMonthlyCost > 0 ? 'costo aggiuntivo' : 'risparmio'}
          />
        )}
      </div>

      {/* Cost breakdown */}
      <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">Dettaglio costi</p>
        <div className="space-y-1.5 text-sm">
          <Row label="Prezzo acquisto" value={fmt(m.carPurchasePrice, c)} />
          {m.totalReductions > 0 && <Row label="Riduzioni totali" value={`− ${fmt(m.totalReductions, c)}`} />}
          <Row label="Prezzo effettivo" value={fmt(m.effectivePurchasePrice, c)} bold />
          <div className="my-2 border-t border-slate-100" />
          {m.upfrontCarCost > 0 && <Row label="Costo iniziale (anticipo + spese)" value={fmt(m.upfrontCarCost, c)} />}
          {m.financingTotalCost > 0 && <Row label="Costo totale finanziamento (interessi)" value={fmt(m.financingTotalCost, c)} />}
          <div className="my-2 border-t border-slate-100" />
          <Row label="Assicurazione" value={`${fmt(m.insuranceMonthlyCost, c)}/mese`} />
          <Row label="Bollo auto" value={`${fmt(m.taxMonthlyCost, c)}/mese`} />
          <Row label="Carburante / Energia" value={`${fmt(m.energyMonthlyCost, c)}/mese`} />
          <Row label="Manutenzione" value={`${fmt(m.maintenanceMonthlyCost, c)}/mese`} />
          {m.additionalMonthlyCost > 0 && <Row label="Altri costi" value={`${fmt(m.additionalMonthlyCost, c)}/mese`} />}
          <div className="my-2 border-t border-slate-100" />
          <Row label="Totale mensile ricorrente" value={`${fmt(m.totalMonthlyRunningCost, c)}/mese`} bold />
        </div>
        {m.missingCosts.length > 0 && (
          <p className="mt-3 text-xs text-amber-600">
            Costi non inclusi: {m.missingCosts.join(', ')}. Inseriscili per un calcolo più preciso.
          </p>
        )}
      </div>

      {/* Payment comparison */}
      {result.paymentComparison && (
        <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Confronto modalità di pagamento</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {result.paymentComparison.map((p) => {
              const ps = CLASS_STYLES[p.classification]
              return (
                <div key={p.mode} className={cn('rounded-xl border p-3', ps.bg, ps.border)}>
                  <p className={cn('text-xs font-bold', ps.text)}>{p.label} — {p.classificationLabel}</p>
                  <p className="mt-1 text-xs text-slate-600">Costo iniziale: {fmt(p.upfrontCost, c)}</p>
                  {p.monthlyInstallment > 0 && <p className="text-xs text-slate-600">Rata: {fmt(p.monthlyInstallment, c)}/mese</p>}
                  <p className="text-xs text-slate-600">TCO netto: {fmt(p.totalOwnershipCost, c)}</p>
                  <p className="text-xs text-slate-600">Liquidità post-acquisto: {fmt(p.liquidityAfter, c)}</p>
                  {p.negativeMonths > 0 && <p className="text-xs text-red-500">Mesi in negativo: {p.negativeMonths}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Car comparison */}
      {result.carComparison && (
        <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Confronto auto</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([result.carComparison.carA, result.carComparison.carB] as const).map((side, i) => {
              const ss = CLASS_STYLES[side.classification]
              return (
                <div key={i} className={cn('rounded-xl border p-3', ss.bg, ss.border)}>
                  <p className={cn('text-xs font-bold', ss.text)}>{side.label} — {side.classificationLabel}</p>
                  <p className="mt-1 text-xs text-slate-600">Prezzo effettivo: {fmt(side.effectivePrice, c)}</p>
                  <p className="text-xs text-slate-600">TCO netto: {fmt(side.netOwnershipCost, c)}</p>
                  <p className="text-xs text-slate-600">Costo mensile: {fmt(side.averageMonthlyOwnershipCost, c)}/mese</p>
                  {side.negativeMonths > 0 && <p className="text-xs text-red-500">Mesi in negativo: {side.negativeMonths}</p>}
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-xs text-slate-500 space-y-0.5">
            {result.carComparison.winner.cheapestTotal !== 'equal' && (
              <p>TCO più basso: <strong>{result.carComparison.winner.cheapestTotal === 'A' ? result.carComparison.carA.label : result.carComparison.carB.label}</strong></p>
            )}
            {result.carComparison.winner.lowestMonthly !== 'equal' && (
              <p>Costo mensile più basso: <strong>{result.carComparison.winner.lowestMonthly === 'A' ? result.carComparison.carA.label : result.carComparison.carB.label}</strong></p>
            )}
          </div>
        </div>
      )}

      {/* Projection */}
      {result.projections.length > 0 && (
        <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Proiezione liquidità</p>
          <div className="h-52 sm:h-64" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={result.projections} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={fmtAxis} width={60} />
                <Tooltip
                  formatter={(v, name) => [fmt(Number(v), c), name === 'baselineLiquidity' ? 'Senza auto' : 'Con auto']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', padding: '8px 12px' }}
                  labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}
                />
                <Legend formatter={(v) => v === 'baselineLiquidity' ? 'Senza auto' : 'Con auto'} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="baselineLiquidity" stroke="#94a3b8" strokeWidth={1.5} fill="url(#gradBase)" dot={false} />
                <Area type="monotone" dataKey="scenarioLiquidity" stroke="#6366f1" strokeWidth={2} fill="url(#gradScen)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">Stima — non costituisce previsione certa</p>
        </div>
      )}

      {/* Reasons */}
      {result.reasons.length > 0 && (
        <div className="rounded-xl border border-[#e5e7f0] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Motivazioni</p>
          <ul className="space-y-2">
            {result.reasons.map((r, i) => (
              <li key={i} className={cn('text-sm', SEVERITY_COLORS[r.severity])}>
                {r.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {result.risks.length > 0 && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="mb-3 text-sm font-semibold text-red-700">Rischi</p>
          <ul className="space-y-2">
            {result.risks.map((r, i) => (
              <li key={i} className={cn('text-sm', SEVERITY_COLORS[r.severity])}>
                {r.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alternatives */}
      {result.alternatives.length > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="mb-3 text-sm font-semibold text-indigo-700">Alternative</p>
          <ul className="space-y-2">
            {result.alternatives.map((a, i) => (
              <li key={i} className="text-sm text-slate-700">{a.text}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing data */}
      {result.missingData.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-700">Dati mancanti</p>
          <ul className="list-inside list-disc space-y-1">
            {result.missingData.map((d, i) => (
              <li key={i} className="text-xs text-amber-600">{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 leading-relaxed">
        {SIMULATION_NOTE} {DISCLAIMER}
      </p>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn('text-slate-500', bold && 'font-semibold text-slate-700')}>{label}</span>
      <span className={cn('text-right text-slate-900 tabular-nums', bold && 'font-bold')}>{value}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CarEvaluation() {
  const [form, setForm] = useState<CarFormState>(INITIAL_FORM)
  const [result, setResult] = useState<CarAffordabilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof CarFormState) {
    return (v: string | boolean) => setForm((f) => ({ ...f, [field]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/affordability/car/calculate', {
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
        document.getElementById('car-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Valutazione non riuscita. Nessun dato finanziario è stato modificato.')
    } finally {
      setLoading(false)
    }
  }

  const isFinancing = form.paymentMode === 'FINANCING'

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Sezione 1: Veicolo ─────────────────────────────────────────── */}
        <Section title="1. Veicolo" defaultOpen>
          <FieldGrid>
            <div className="sm:col-span-2">
              <Label htmlFor="carName">Nome / modello *</Label>
              <Input id="carName" value={form.carName} onChange={set('carName')} placeholder="es. Toyota Yaris Hybrid 2024" />
            </div>
            <div>
              <Label htmlFor="purchasePrice">Prezzo di acquisto (€) *</Label>
              <Input id="purchasePrice" value={form.purchasePrice} onChange={set('purchasePrice')} type="number" min="0" step="100" placeholder="28000" />
            </div>
            <div>
              <Label htmlFor="listPrice">Prezzo di listino (€)</Label>
              <Input id="listPrice" value={form.listPrice} onChange={set('listPrice')} type="number" min="0" step="100" placeholder="31000" />
            </div>
            <div>
              <Label htmlFor="condition">Condizione</Label>
              <Select id="condition" value={form.condition} onChange={set('condition')}>
                <option value="">Seleziona...</option>
                {Object.entries(CAR_CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="fuelType">Alimentazione</Label>
              <Select id="fuelType" value={form.fuelType} onChange={set('fuelType')}>
                <option value="">Seleziona...</option>
                {Object.entries(FUEL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="annualKm">Km/anno stimati</Label>
              <Input id="annualKm" value={form.annualKm} onChange={set('annualKm')} type="number" min="0" step="500" placeholder="15000" />
            </div>
            <div>
              <Label htmlFor="ownershipYears">Anni di utilizzo *</Label>
              <Input id="ownershipYears" value={form.ownershipYears} onChange={set('ownershipYears')} type="number" min="0.5" max="20" step="0.5" placeholder="5" />
            </div>
            <div>
              <Label htmlFor="purchaseDate">Data acquisto *</Label>
              <Input id="purchaseDate" value={form.purchaseDate} onChange={set('purchaseDate')} type="date" />
            </div>
          </FieldGrid>
        </Section>

        {/* ── Sezione 2: Riduzioni prezzo ───────────────────────────────── */}
        <Section title="2. Riduzioni del prezzo">
          <FieldGrid>
            <div>
              <Label htmlFor="discount">Sconto concessionario (€)</Label>
              <Input id="discount" value={form.discount} onChange={set('discount')} type="number" min="0" step="100" />
            </div>
            <div>
              <Label htmlFor="incentive">Incentivo statale (€)</Label>
              <Input id="incentive" value={form.incentive} onChange={set('incentive')} type="number" min="0" step="100" />
            </div>
            <div>
              <Label htmlFor="subsidy">Contributo / sussidio (€)</Label>
              <Input id="subsidy" value={form.subsidy} onChange={set('subsidy')} type="number" min="0" step="100" />
            </div>
            <div>
              <Label htmlFor="tradeInValue">Valore permuta (€)</Label>
              <Input id="tradeInValue" value={form.tradeInValue} onChange={set('tradeInValue')} type="number" min="0" step="100" />
            </div>
            <div>
              <Label htmlFor="currentCarSaleProceeds">Ricavo vendita auto attuale (€)</Label>
              <Input id="currentCarSaleProceeds" value={form.currentCarSaleProceeds} onChange={set('currentCarSaleProceeds')} type="number" min="0" step="100" />
            </div>
            <div>
              <Label htmlFor="otherPriceContributions">Altre riduzioni (€)</Label>
              <Input id="otherPriceContributions" value={form.otherPriceContributions} onChange={set('otherPriceContributions')} type="number" min="0" step="100" />
            </div>
          </FieldGrid>
        </Section>

        {/* ── Sezione 3: Pagamento ──────────────────────────────────────── */}
        <Section title="3. Modalità di pagamento" defaultOpen>
          <div className="mb-4">
            <Label htmlFor="paymentMode">Modalità *</Label>
            <Select id="paymentMode" value={form.paymentMode} onChange={set('paymentMode')}>
              {Object.entries(CAR_PAYMENT_MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          {isFinancing && (
            <FieldGrid>
              <div>
                <Label htmlFor="downPayment">Anticipo (€)</Label>
                <Input id="downPayment" value={form.downPayment} onChange={set('downPayment')} type="number" min="0" step="100" />
              </div>
              <div>
                <Label htmlFor="installmentAmount">Rata mensile (€) *</Label>
                <Input id="installmentAmount" value={form.installmentAmount} onChange={set('installmentAmount')} type="number" min="0" step="10" />
              </div>
              <div>
                <Label htmlFor="numberOfInstallments">Numero rate *</Label>
                <Input id="numberOfInstallments" value={form.numberOfInstallments} onChange={set('numberOfInstallments')} type="number" min="1" max="360" step="1" />
              </div>
              <div>
                <Label htmlFor="firstInstallmentDate">Prima rata</Label>
                <Input id="firstInstallmentDate" value={form.firstInstallmentDate} onChange={set('firstInstallmentDate')} type="date" />
              </div>
              <div>
                <Label htmlFor="financingFees">Spese finanziamento (€)</Label>
                <Input id="financingFees" value={form.financingFees} onChange={set('financingFees')} type="number" min="0" step="10" />
              </div>
              <div>
                <Label htmlFor="balloonPayment">Maxi-rata finale (€)</Label>
                <Input id="balloonPayment" value={form.balloonPayment} onChange={set('balloonPayment')} type="number" min="0" step="100" />
              </div>
            </FieldGrid>
          )}
        </Section>

        {/* ── Sezione 4: Spese iniziali ─────────────────────────────────── */}
        <Section title="4. Spese iniziali (immatricolazione, consegna…)">
          <FieldGrid>
            <div><Label htmlFor="icRegistration">Immatricolazione (€)</Label><Input id="icRegistration" value={form.icRegistration} onChange={set('icRegistration')} type="number" min="0" /></div>
            <div><Label htmlFor="icTransfer">Trasferimento proprietà (€)</Label><Input id="icTransfer" value={form.icTransfer} onChange={set('icTransfer')} type="number" min="0" /></div>
            <div><Label htmlFor="icDelivery">Spese consegna (€)</Label><Input id="icDelivery" value={form.icDelivery} onChange={set('icDelivery')} type="number" min="0" /></div>
            <div><Label htmlFor="icAccessories">Accessori (€)</Label><Input id="icAccessories" value={form.icAccessories} onChange={set('icAccessories')} type="number" min="0" /></div>
            <div><Label htmlFor="icInstallation">Installazioni (€)</Label><Input id="icInstallation" value={form.icInstallation} onChange={set('icInstallation')} type="number" min="0" /></div>
            {(form.fuelType === 'electric' || form.fuelType === 'plugin_hybrid') && (
              <div><Label htmlFor="icWallbox">Wallbox / colonnina (€)</Label><Input id="icWallbox" value={form.icWallbox} onChange={set('icWallbox')} type="number" min="0" /></div>
            )}
            <div><Label htmlFor="icInitialInsurance">Prima assicurazione (€)</Label><Input id="icInitialInsurance" value={form.icInitialInsurance} onChange={set('icInitialInsurance')} type="number" min="0" /></div>
            <div><Label htmlFor="icInitialTax">Tasse iniziali (€)</Label><Input id="icInitialTax" value={form.icInitialTax} onChange={set('icInitialTax')} type="number" min="0" /></div>
            <div><Label htmlFor="icOther">Altro (€)</Label><Input id="icOther" value={form.icOther} onChange={set('icOther')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        {/* ── Sezione 5: Assicurazione ──────────────────────────────────── */}
        <Section title="5. Assicurazione">
          <FieldGrid>
            <div><Label htmlFor="insRcAnnual">RC auto (€/anno)</Label><Input id="insRcAnnual" value={form.insRcAnnual} onChange={set('insRcAnnual')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="insTheftFireAnnual">Furto e incendio (€/anno)</Label><Input id="insTheftFireAnnual" value={form.insTheftFireAnnual} onChange={set('insTheftFireAnnual')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="insKaskoAnnual">Kasko (€/anno)</Label><Input id="insKaskoAnnual" value={form.insKaskoAnnual} onChange={set('insKaskoAnnual')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="insOtherAnnual">Altre polizze (€/anno)</Label><Input id="insOtherAnnual" value={form.insOtherAnnual} onChange={set('insOtherAnnual')} type="number" min="0" step="10" /></div>
          </FieldGrid>
        </Section>

        {/* ── Sezione 6: Bollo auto ─────────────────────────────────────── */}
        <Section title="6. Bollo auto">
          <FieldGrid>
            <div>
              <Label htmlFor="taxBolloAnnual">Bollo annuo (€)</Label>
              <Input id="taxBolloAnnual" value={form.taxBolloAnnual} onChange={set('taxBolloAnnual')} type="number" min="0" step="10" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="taxExempt" type="checkbox" checked={form.taxExempt}
                onChange={(e) => setForm((f) => ({ ...f, taxExempt: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <label htmlFor="taxExempt" className="text-sm text-slate-700">Esenzione bollo</label>
            </div>
            {!form.taxExempt && (
              <div>
                <Label htmlFor="taxExemptionYears">Anni esenzione (veicoli EV/ibridi)</Label>
                <Input id="taxExemptionYears" value={form.taxExemptionYears} onChange={set('taxExemptionYears')} type="number" min="0" max="20" step="1" placeholder="3" />
              </div>
            )}
            <div><Label htmlFor="taxOtherAnnual">Altre tasse (€/anno)</Label><Input id="taxOtherAnnual" value={form.taxOtherAnnual} onChange={set('taxOtherAnnual')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        {/* ── Sezione 7: Carburante / Energia ──────────────────────────── */}
        <Section title="7. Carburante / Energia">
          <div className="mb-3">
            <Label htmlFor="fuelMode">Metodo di calcolo</Label>
            <Select id="fuelMode" value={form.fuelMode} onChange={set('fuelMode')}>
              <option value="monthly_estimate">Stima mensile</option>
              <option value="usage_calculation">Calcolo da utilizzo (km + consumo + prezzo)</option>
            </Select>
          </div>
          {form.fuelMode === 'monthly_estimate' ? (
            <div>
              <Label htmlFor="fuelMonthlyEstimate">Spesa mensile stimata (€)</Label>
              <Input id="fuelMonthlyEstimate" value={form.fuelMonthlyEstimate} onChange={set('fuelMonthlyEstimate')} type="number" min="0" step="10" placeholder="120" />
            </div>
          ) : (
            <FieldGrid>
              <div><Label htmlFor="fuelConsumptionPer100">Consumo (l o kWh per 100 km)</Label><Input id="fuelConsumptionPer100" value={form.fuelConsumptionPer100} onChange={set('fuelConsumptionPer100')} type="number" min="0" step="0.1" placeholder="5.5" /></div>
              <div><Label htmlFor="fuelPrice">Prezzo carburante (€/l o €/kWh)</Label><Input id="fuelPrice" value={form.fuelPrice} onChange={set('fuelPrice')} type="number" min="0" step="0.01" placeholder="1.80" /></div>
            </FieldGrid>
          )}
        </Section>

        {/* ── Sezione 8: Manutenzione ───────────────────────────────────── */}
        <Section title="8. Manutenzione">
          <FieldGrid>
            <div><Label htmlFor="maintOrdinaryAnnual">Ordinaria (€/anno)</Label><Input id="maintOrdinaryAnnual" value={form.maintOrdinaryAnnual} onChange={set('maintOrdinaryAnnual')} type="number" min="0" step="50" placeholder="300" /></div>
            <div><Label htmlFor="maintExtraordinaryAnnual">Straordinaria (€/anno)</Label><Input id="maintExtraordinaryAnnual" value={form.maintExtraordinaryAnnual} onChange={set('maintExtraordinaryAnnual')} type="number" min="0" step="50" /></div>
            <div><Label htmlFor="maintServiceAnnual">Tagliando annuo (€)</Label><Input id="maintServiceAnnual" value={form.maintServiceAnnual} onChange={set('maintServiceAnnual')} type="number" min="0" step="50" /></div>
            <div><Label htmlFor="maintRevisionCost">Revisione (€)</Label><Input id="maintRevisionCost" value={form.maintRevisionCost} onChange={set('maintRevisionCost')} type="number" min="0" step="10" placeholder="80" /></div>
            <div><Label htmlFor="maintRevisionIntervalMonths">Revisione ogni (mesi)</Label><Input id="maintRevisionIntervalMonths" value={form.maintRevisionIntervalMonths} onChange={set('maintRevisionIntervalMonths')} type="number" min="1" max="240" placeholder="24" /></div>
            <div><Label htmlFor="maintTiresCost">Cambio pneumatici (€)</Label><Input id="maintTiresCost" value={form.maintTiresCost} onChange={set('maintTiresCost')} type="number" min="0" step="50" /></div>
            <div><Label htmlFor="maintTiresIntervalMonths">Pneumatici ogni (mesi)</Label><Input id="maintTiresIntervalMonths" value={form.maintTiresIntervalMonths} onChange={set('maintTiresIntervalMonths')} type="number" min="1" max="120" placeholder="48" /></div>
            <div><Label htmlFor="maintOtherAnnual">Altro (€/anno)</Label><Input id="maintOtherAnnual" value={form.maintOtherAnnual} onChange={set('maintOtherAnnual')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        {/* ── Sezione 9: Altri costi ────────────────────────────────────── */}
        <Section title="9. Altri costi ricorrenti">
          <FieldGrid>
            <div><Label htmlFor="addParkingMonthly">Parcheggio (€/mese)</Label><Input id="addParkingMonthly" value={form.addParkingMonthly} onChange={set('addParkingMonthly')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="addGarageMonthly">Box / garage (€/mese)</Label><Input id="addGarageMonthly" value={form.addGarageMonthly} onChange={set('addGarageMonthly')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="addTollsMonthly">Pedaggi (€/mese)</Label><Input id="addTollsMonthly" value={form.addTollsMonthly} onChange={set('addTollsMonthly')} type="number" min="0" step="5" /></div>
            <div><Label htmlFor="addWashingMonthly">Lavaggi (€/mese)</Label><Input id="addWashingMonthly" value={form.addWashingMonthly} onChange={set('addWashingMonthly')} type="number" min="0" step="5" /></div>
            <div><Label htmlFor="addRoadsideAnnual">Soccorso stradale (€/anno)</Label><Input id="addRoadsideAnnual" value={form.addRoadsideAnnual} onChange={set('addRoadsideAnnual')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="addOtherMonthly">Altro (€/mese)</Label><Input id="addOtherMonthly" value={form.addOtherMonthly} onChange={set('addOtherMonthly')} type="number" min="0" /></div>
          </FieldGrid>
        </Section>

        {/* ── Sezione 10: Auto attuale ──────────────────────────────────── */}
        <Section title="10. Auto attuale (per confronto)">
          <p className="mb-3 text-xs text-slate-500">Compila questa sezione per calcolare il costo incrementale del nuovo acquisto.</p>
          <FieldGrid>
            <div><Label htmlFor="ccMonthlyInstallment">Rata mensile auto attuale (€)</Label><Input id="ccMonthlyInstallment" value={form.ccMonthlyInstallment} onChange={set('ccMonthlyInstallment')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="ccInsuranceMonthly">Assicurazione (€/mese)</Label><Input id="ccInsuranceMonthly" value={form.ccInsuranceMonthly} onChange={set('ccInsuranceMonthly')} type="number" min="0" step="5" /></div>
            <div><Label htmlFor="ccBolloAnnual">Bollo (€/anno)</Label><Input id="ccBolloAnnual" value={form.ccBolloAnnual} onChange={set('ccBolloAnnual')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="ccFuelMonthly">Carburante (€/mese)</Label><Input id="ccFuelMonthly" value={form.ccFuelMonthly} onChange={set('ccFuelMonthly')} type="number" min="0" step="10" /></div>
            <div><Label htmlFor="ccMaintenanceMonthly">Manutenzione (€/mese)</Label><Input id="ccMaintenanceMonthly" value={form.ccMaintenanceMonthly} onChange={set('ccMaintenanceMonthly')} type="number" min="0" step="5" /></div>
            <div><Label htmlFor="ccParkingMonthly">Parcheggio (€/mese)</Label><Input id="ccParkingMonthly" value={form.ccParkingMonthly} onChange={set('ccParkingMonthly')} type="number" min="0" step="5" /></div>
            <div><Label htmlFor="ccSaleValue">Valore stimato di vendita (€)</Label><Input id="ccSaleValue" value={form.ccSaleValue} onChange={set('ccSaleValue')} type="number" min="0" step="100" /></div>
            <div><Label htmlFor="ccRemainingFinancing">Debito residuo finanziamento (€)</Label><Input id="ccRemainingFinancing" value={form.ccRemainingFinancing} onChange={set('ccRemainingFinancing')} type="number" min="0" step="100" /></div>
          </FieldGrid>
        </Section>

        {/* ── Sezione 11: Valore residuo ────────────────────────────────── */}
        <Section title="11. Valore residuo stimato">
          <div>
            <Label htmlFor="estimatedResidualValue">Valore stimato dopo {form.ownershipYears || '?'} anni (€)</Label>
            <Input id="estimatedResidualValue" value={form.estimatedResidualValue} onChange={set('estimatedResidualValue')} type="number" min="0" step="500" placeholder="es. 8000" />
            <p className="mt-1 text-xs text-slate-400">Inserire il valore di rivendita atteso al termine del periodo di utilizzo.</p>
          </div>
        </Section>

        {/* ── Preferenze ────────────────────────────────────────────────── */}
        <Section title="Preferenze di valutazione">
          <FieldGrid>
            <div>
              <Label htmlFor="minimumLiquidityMonths">Riserva minima di liquidità (mesi di spese)</Label>
              <Input id="minimumLiquidityMonths" value={form.minimumLiquidityMonths} onChange={set('minimumLiquidityMonths')} type="number" min="0" max="24" step="1" />
            </div>
            <div>
              <Label htmlFor="horizonMonths">Orizzonte di proiezione (mesi)</Label>
              <Input id="horizonMonths" value={form.horizonMonths} onChange={set('horizonMonths')} type="number" min="1" max="24" step="1" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="includeGoals" type="checkbox" checked={form.includeGoalContributions}
                onChange={(e) => setForm((f) => ({ ...f, includeGoalContributions: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <label htmlFor="includeGoals" className="text-sm text-slate-700">Includi contribuzioni agli obiettivi di risparmio</label>
            </div>
          </FieldGrid>
        </Section>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
            {loading ? 'Valutazione in corso…' : 'Valuta acquisto auto'}
          </Button>
          {result && (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setResult(null)}
            >
              <RefreshCw className="h-3 w-3" /> Nuova valutazione
            </button>
          )}
        </div>
      </form>

      {result && <ResultSection result={result} />}
    </div>
  )
}
