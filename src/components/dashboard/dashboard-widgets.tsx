'use client'

import Link from 'next/link'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, ArrowRight, Bell, CalendarClock, CheckCircle2, Database, PiggyBank, ShieldAlert, Target, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { componentLabel, componentStatusLabel, formatPercent, formatTrendLabel, pickTopFactors, scoreHistorySeries, trendTone } from '@/lib/dashboard/helpers'
import type { DashboardWidgetId, DataIntegrityDashboardSummary, FinancialHealthSnapshotSummary } from '@/lib/dashboard/types'
import { ScenariosWidget } from '@/components/scenarios/scenarios-widget'
import type { ComponentScore, FinancialHealthResult, HealthTrend } from '@/lib/financial-health/types'

type WidgetProps = {
  data: FinancialHealthResult
  history: FinancialHealthSnapshotSummary[]
  dataIntegrity?: DataIntegrityDashboardSummary | null
  compact?: boolean
  onSaveSnapshot: () => void
  savingSnapshot: boolean
}

type WidgetShellProps = {
  title: string
  description?: string
  href?: string
  children: React.ReactNode
  className?: string
}

const euroTooltip = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

function WidgetShell({ title, description, href, children, className }: WidgetShellProps) {
  return (
    <Card className={`flex h-full flex-col border-slate-200 bg-white shadow-sm ${className ?? ''}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base font-semibold text-slate-950">{title}</CardTitle>
          {description ? <CardDescription className="mt-1 text-sm text-slate-500">{description}</CardDescription> : null}
        </div>
        {href ? (
          <Link href={href} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" aria-label={`Apri ${title}`}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  )
}

function TrendBadge({ trend }: { trend?: HealthTrend }) {
  const tone = trendTone(trend)
  const classes = tone === 'positive'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'negative'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>{formatTrendLabel(trend)}</span>
}

function MetricCard({ title, value, icon: Icon, trend, tone, tooltip }: {
  title: string
  value: string
  icon: typeof Wallet
  trend?: HealthTrend
  tone: 'indigo' | 'green' | 'red' | 'violet'
  tooltip: string
}) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" title={tooltip}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
        </div>
        <span className={`rounded-2xl p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4"><TrendBadge trend={trend} /></div>
    </div>
  )
}

function findTrend(data: FinancialHealthResult, metric: HealthTrend['metric']) {
  return data.trends.find((trend) => trend.metric === metric)
}

export function SummaryWidget({ data }: WidgetProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Patrimonio totale" value={formatCurrency(data.metrics.currentFinancialPosition)} icon={Wallet} tone="indigo" trend={findTrend(data, 'currentFinancialPosition')} tooltip="Somma dei conti attivi al netto dei prestiti ricevuti aperti." />
      <MetricCard title="Liquidita a 30 giorni" value={formatCurrency(data.metrics.projectedLiquidity30d)} icon={TrendingUp} tone="green" trend={findTrend(data, 'currentLiquidity')} tooltip="Saldo minimo previsto nei prossimi 30 giorni dal calendario finanziario." />
      <MetricCard title="Margine mensile" value={formatCurrency(data.metrics.monthlyMargin)} icon={PiggyBank} tone="violet" trend={findTrend(data, 'monthlyMargin')} tooltip="Entrate meno uscite nel periodo selezionato." />
      <MetricCard title="Tasso di risparmio" value={formatPercent(data.metrics.savingsRate)} icon={TrendingDown} tone="red" trend={findTrend(data, 'savingsRate')} tooltip="Percentuale di entrate non consumata dalle uscite del periodo." />
    </div>
  )
}

export function FinancialHealthWidget({ data, onSaveSnapshot, savingSnapshot }: WidgetProps) {
  const topFactors = pickTopFactors(data, 3)
  const score = data.totalScore ?? 0
  return (
    <WidgetShell title="Salute finanziaria" description="Score calcolato dal motore deterministico Aurora." href="/financial-health">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-indigo-50 p-6 text-center">
          <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-white shadow-inner" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.totalScore ?? undefined} aria-label="Score salute finanziaria">
            <span className="text-4xl font-bold tabular-nums text-indigo-600">{data.totalScore ?? '--'}</span>
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-950">{data.levelLabel}</p>
          <p className="mt-1 text-sm text-slate-500">Completezza {formatPercent(data.completenessPercentage)}</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">Qualita dati: {data.dataQuality.level}</Badge>
            {data.isProvisional ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">Provvisorio</Badge> : <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Consolidato</Badge>}
          </div>
          <p className="text-sm leading-6 text-slate-600">{data.summary}</p>
          <div className="space-y-2">
            {topFactors.map((factor) => (
              <div key={factor.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{factor.title}</p>
                <p className="mt-1 text-sm text-slate-500">{factor.description}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onSaveSnapshot} disabled={savingSnapshot}>{savingSnapshot ? 'Salvataggio...' : 'Salva snapshot'}</Button>
            <p className="text-xs text-slate-500">Non e consulenza finanziaria: e una lettura deterministica dei dati registrati.</p>
          </div>
        </div>
      </div>
    </WidgetShell>
  )
}

export function DataIntegrityWidget({ dataIntegrity }: WidgetProps) {
  return (
    <WidgetShell title="Integrita dei dati" description="Anomalie strutturali rilevate dalle scansioni." href="/data-integrity">
      {dataIntegrity ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-600">Critical aperte</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-red-700">{dataIntegrity.critical}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-600">Warning aperte</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-amber-700">{dataIntegrity.warning}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">Ultima scansione: {dataIntegrity.latestScanAt ? formatDate(dataIntegrity.latestScanAt) : 'mai'} - {dataIntegrity.statusLabel}</p>
          <div className="space-y-2">
            {dataIntegrity.issues.slice(0, 3).map((issue) => (
              <Link key={`${issue.severity}-${issue.title}`} href={issue.sourcePath ?? '/data-integrity'} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
                <span className={issue.severity === 'CRITICAL' ? 'rounded-xl bg-red-50 p-2 text-red-600' : 'rounded-xl bg-amber-50 p-2 text-amber-600'}>
                  <Database className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{issue.title}</p>
                  <p className="text-xs text-slate-500">{issue.category}</p>
                </div>
              </Link>
            ))}
          </div>
          {dataIntegrity.issues.length === 0 ? <EmptyWidgetText text="Nessuna anomalia aperta dall'ultima scansione." /> : null}
        </div>
      ) : <EmptyWidgetText text="Avvia una scansione dal Data Integrity Center." />}
    </WidgetShell>
  )
}

export function ScoreComponentsWidget({ data }: WidgetProps) {
  const components = Object.values(data.componentScores)
  return (
    <WidgetShell title="Componenti dello score" description="Peso e contributo di ogni area." href="/financial-health">
      <div className="space-y-4">
        {components.map((component: ComponentScore) => (
          <div key={component.component}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-800">{componentLabel(component.component)}</span>
              <span className="text-slate-500">{component.availability === 'AVAILABLE' ? `${component.score}/100 - ${componentStatusLabel(component.status)}` : 'Non applicabile'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${component.score ?? 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Peso {component.weight}% - contributo {component.contribution.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</p>
          </div>
        ))}
      </div>
    </WidgetShell>
  )
}

export function ProjectedBalanceWidget({ data }: WidgetProps) {
  const series = data.dashboard.projectedLiquiditySeries
  const min = series.reduce((value, point) => Math.min(value, point.balance), Number.POSITIVE_INFINITY)
  const negativeDays = series.filter((point) => point.balance < 0).length
  return (
    <WidgetShell title="Saldo previsionale" description="Proiezione a 90 giorni dal calendario finanziario." href="/calendar">
      <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <span>Minimo: <strong className="tabular-nums text-slate-950">{Number.isFinite(min) ? formatCurrency(min) : 'n.d.'}</strong></span>
        <span>Giorni sotto zero: <strong className="tabular-nums text-slate-950">{negativeDays}</strong></span>
      </div>
      {series.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 12 }} width={48} />
              <Tooltip formatter={(value) => euroTooltip.format(Number(value))} labelFormatter={(label) => `Giorno ${label}`} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="balance" stroke="#6366f1" fill="#c7d2fe" strokeWidth={2} name="Saldo previsto" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyWidgetText text="Non ci sono ancora dati previsionali sufficienti." />}
    </WidgetShell>
  )
}

export function CashFlowWidget({ data }: WidgetProps) {
  const series = data.dashboard.monthlyCashFlowSeries.map((month) => ({ ...month, label: month.key.slice(5) }))
  return (
    <WidgetShell title="Entrate, uscite e margine" description="Ultimi sei mesi disponibili dal motore Financial Health." href="/reports">
      {series.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 12 }} width={48} />
              <Tooltip formatter={(value) => euroTooltip.format(Number(value))} />
              <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} name="Entrate" />
              <Bar dataKey="expenses" fill="#ef4444" radius={[6, 6, 0, 0]} name="Uscite" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyWidgetText text="Registra movimenti per visualizzare l'andamento mensile." />}
    </WidgetShell>
  )
}

export function CoverageWidget({ data }: WidgetProps) {
  return (
    <WidgetShell title="Copertura spese" description="Autonomia stimata con la liquidita corrente.">
      <p className="text-3xl font-bold tabular-nums text-slate-950">{data.metrics.expenseCoverageMonths == null ? 'n.d.' : `${data.metrics.expenseCoverageMonths.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mesi`}</p>
      <p className="mt-3 text-sm text-slate-500">Basata sulle uscite medie osservate negli ultimi mesi disponibili.</p>
    </WidgetShell>
  )
}

export function BudgetsWidget({ data }: WidgetProps) {
  return (
    <WidgetShell title="Budget a rischio" description="Categorie oltre l'80% o gia oltre soglia." href="/budgets">
      {data.dashboard.budgetFocus.length > 0 ? (
        <div className="space-y-3">
          {data.dashboard.budgetFocus.map((budget) => (
            <div key={budget.categoryId} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{budget.categoryName}</span>
                <span className={budget.status === 'exceeded' ? 'text-red-600' : 'text-amber-600'}>{formatPercent(budget.usage)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={budget.status === 'exceeded' ? 'h-full bg-red-500' : 'h-full bg-amber-500'} style={{ width: `${Math.min(100, budget.usage)}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-500">{formatCurrency(budget.spent)} spesi su {formatCurrency(budget.limit)}</p>
            </div>
          ))}
        </div>
      ) : <EmptyWidgetText text="Nessun budget a rischio nel periodo selezionato." />}
    </WidgetShell>
  )
}

export function DeadlinesWidget({ data }: WidgetProps) {
  return (
    <WidgetShell title="Scadenze" description="Ricorrenze e prestiti da verificare." href="/calendar">
      {data.dashboard.deadlineFocus.length > 0 ? (
        <List items={data.dashboard.deadlineFocus.map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${formatDate(item.dueDate)} - ${item.daysUntil < 0 ? 'Scaduta' : `${item.daysUntil} giorni`}`,
          value: formatCurrency(item.amount),
          danger: item.status === 'overdue',
        }))} icon={CalendarClock} />
      ) : <EmptyWidgetText text="Non ci sono scadenze critiche nei prossimi 30 giorni." />}
    </WidgetShell>
  )
}

export function LoansWidget({ data }: WidgetProps) {
  return (
    <WidgetShell title="Prestiti" description="Prestiti aperti ordinati per urgenza." href="/loans">
      {data.dashboard.loanFocus.length > 0 ? (
        <List items={data.dashboard.loanFocus.map((loan) => ({
          id: loan.id,
          title: loan.counterpart,
          meta: loan.dueDate ? formatDate(loan.dueDate) : 'Senza scadenza',
          value: formatCurrency(loan.remaining),
          danger: loan.status === 'overdue',
        }))} icon={ShieldAlert} />
      ) : <EmptyWidgetText text="Nessun prestito aperto da mostrare." />}
    </WidgetShell>
  )
}

export function GoalsWidget({ data }: WidgetProps) {
  return (
    <WidgetShell title="Obiettivi" description="Avanzamento degli obiettivi attivi." href="/goals">
      {data.dashboard.goalFocus.length > 0 ? (
        <div className="space-y-3">
          {data.dashboard.goalFocus.map((goal) => (
            <Link key={goal.id} href={goal.href} className="block rounded-xl border border-slate-200 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{goal.name}</span>
                <span className="text-sm tabular-nums text-slate-500">{goal.progress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-indigo-500" style={{ width: `${goal.progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-500">{formatCurrency(goal.currentAmount)} su {formatCurrency(goal.targetAmount)}</p>
            </Link>
          ))}
        </div>
      ) : <EmptyWidgetText text="Crea un obiettivo per monitorare il percorso di risparmio." />}
    </WidgetShell>
  )
}

export function RecommendationsWidget({ data }: WidgetProps) {
  return (
    <WidgetShell title="Azioni consigliate" description="Suggerimenti deterministici dal motore Financial Health.">
      {data.recommendations.length > 0 ? (
        <div className="space-y-3">
          {data.recommendations.slice(0, 5).map((item) => (
            <Link key={item.id} href={item.actionUrl} className="block rounded-xl border border-slate-200 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
              <p className="font-medium text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </Link>
          ))}
        </div>
      ) : <EmptyWidgetText text="Non ci sono azioni prioritarie al momento." />}
    </WidgetShell>
  )
}

export function PriorityAlertsWidget({ data }: WidgetProps) {
  return (
    <WidgetShell title="Avvisi prioritari" description="Notifiche critiche e warning ancora aperti." href="/notifications">
      {data.dashboard.alertFocus.length > 0 ? (
        <List items={data.dashboard.alertFocus.map((alert) => ({
          id: alert.id,
          title: alert.title,
          meta: formatDate(alert.createdAt),
          value: alert.severity,
          danger: alert.severity === 'CRITICAL',
        }))} icon={Bell} />
      ) : <EmptyWidgetText text="Nessun avviso prioritario aperto." />}
    </WidgetShell>
  )
}

export function ScoreHistoryWidget({ history }: WidgetProps) {
  const series = scoreHistorySeries(history)
  return (
    <WidgetShell title="Storico score" description="Ultimi snapshot salvati." href="/financial-health">
      {series.length > 0 ? (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} width={36} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyWidgetText text="Salva uno snapshot per iniziare lo storico dello score." />}
    </WidgetShell>
  )
}

function List({ items, icon: Icon }: { items: Array<{ id: string; title: string; meta: string; value: string; danger?: boolean }>; icon: typeof AlertTriangle }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
          <span className={item.danger ? 'rounded-xl bg-red-50 p-2 text-red-600' : 'rounded-xl bg-indigo-50 p-2 text-indigo-600'}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{item.title}</p>
            <p className="text-sm text-slate-500">{item.meta}</p>
          </div>
          <p className={item.danger ? 'font-semibold tabular-nums text-red-600' : 'font-semibold tabular-nums text-slate-950'}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function EmptyWidgetText({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm text-slate-500">{text}</p>
    </div>
  )
}

export const DASHBOARD_WIDGET_COMPONENTS: Record<DashboardWidgetId, (props: WidgetProps) => React.ReactNode> = {
  summary: (props) => <SummaryWidget {...props} />,
  'financial-health': (props) => <FinancialHealthWidget {...props} />,
  'data-integrity': (props) => <DataIntegrityWidget {...props} />,
  'score-components': (props) => <ScoreComponentsWidget {...props} />,
  'projected-balance': (props) => <ProjectedBalanceWidget {...props} />,
  'cash-flow': (props) => <CashFlowWidget {...props} />,
  'expense-coverage': (props) => <CoverageWidget {...props} />,
  budgets: (props) => <BudgetsWidget {...props} />,
  deadlines: (props) => <DeadlinesWidget {...props} />,
  loans: (props) => <LoansWidget {...props} />,
  goals: (props) => <GoalsWidget {...props} />,
  recommendations: (props) => <RecommendationsWidget {...props} />,
  'priority-alerts': (props) => <PriorityAlertsWidget {...props} />,
  'score-history': (props) => <ScoreHistoryWidget {...props} />,
  scenarios: () => <ScenariosWidget />,
}
