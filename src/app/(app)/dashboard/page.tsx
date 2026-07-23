'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  Cake,
  CalendarClock,
  CalendarDays,
  Clock,
  HandCoins,
  Lightbulb,
  PiggyBank,
  Plus,
  Repeat,
  Star,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import {
  Area, AreaChart,
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { FirstUseChecklist } from '@/components/onboarding/FirstUseChecklist'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useDashboard } from '@/hooks/use-dashboard'
import { ACCOUNT_TYPE_LABELS } from '@/lib/constants'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type {
  DashboardAccount,
  DashboardInsight,
  DashboardTimelineEventType,
  DashboardTransaction,
} from '@/lib/dashboard/service'
import type { AccountType } from '@/types/database'

// ── Sub-components ─────────────────────────────────────────────────────────

const toneClasses = {
  indigo: 'bg-indigo-100 text-indigo-600',
  green:  'bg-emerald-100 text-emerald-600',
  red:    'bg-red-100 text-red-600',
  violet: 'bg-violet-100 text-violet-600',
}

function StatCard({
  title, value, icon: Icon, tone, detail,
}: {
  title: string; value: string; icon: LucideIcon
  tone: 'indigo' | 'green' | 'red' | 'violet'; detail: string
}) {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 sm:text-sm">{title}</p>
            <p className="mt-1.5 truncate text-lg font-bold tabular-nums text-slate-950 sm:mt-3 sm:text-2xl">{value}</p>
          </div>
          <div className={cn('hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-slate-400 sm:mt-4">{detail}</p>
      </CardContent>
    </Card>
  )
}

function MiniStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#e5e7f0] bg-white p-3 sm:rounded-2xl sm:p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate font-bold tabular-nums text-slate-950">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-8">
            <span className="flex items-center gap-2 text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatCurrency(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CashFlowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const balance = payload[0]?.value as number
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <p className="mb-1 font-semibold text-slate-900">{label}</p>
      <p className={cn('font-bold tabular-nums', balance < 0 ? 'text-red-600' : 'text-emerald-600')}>
        {formatCurrency(balance)}
      </p>
    </div>
  )
}

function NetWorthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value as number
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
      <p className="mb-1 font-semibold text-slate-900">{label}</p>
      <p className="font-bold tabular-nums text-indigo-600">{formatCurrency(value)}</p>
    </div>
  )
}

function TxIcon({ tx }: { tx: DashboardTransaction }) {
  const isTransfer = tx.type === 'transfer' || tx.transferPeerId !== null
  if (isTransfer) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:h-10 sm:w-10 sm:rounded-2xl">
        <ArrowLeftRight className="h-4 w-4" />
      </div>
    )
  }
  const isIncome = tx.type === 'income'
  return (
    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl', isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
      {isIncome ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
    </div>
  )
}

function AccountRow({ account, total }: { account: DashboardAccount; total: number }) {
  const percent = total > 0 ? Math.min((Math.abs(account.balance) / total) * 100, 100) : 0
  return (
    <div className="rounded-xl border border-[#e5e7f0] bg-white p-3 sm:rounded-2xl sm:p-4">
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{account.name}</p>
          <p className="mt-1 text-xs text-slate-400">{ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? account.type}</p>
        </div>
        <p className="shrink-0 font-bold tabular-nums text-slate-950">
          {formatCurrency(account.balance, account.currency)}
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

const insightIcons: Record<string, LucideIcon> = {
  category_up:   TrendingUp,
  category_down: TrendingDown,
  savings_up:    TrendingUp,
  savings_down:  TrendingDown,
  best_month:    TrendingUp,
  worst_month:   TrendingDown,
  net_worth_up:  TrendingUp,
  net_worth_down: TrendingDown,
  budget_warning: AlertTriangle,
  daily_avg_down: TrendingDown,
  daily_avg_up:   TrendingUp,
}

const insightColors: Record<string, string> = {
  category_up:    'bg-amber-50 border-amber-200 text-amber-800',
  category_down:  'bg-emerald-50 border-emerald-200 text-emerald-800',
  savings_up:     'bg-emerald-50 border-emerald-200 text-emerald-800',
  savings_down:   'bg-red-50 border-red-200 text-red-800',
  best_month:     'bg-indigo-50 border-indigo-200 text-indigo-800',
  worst_month:    'bg-red-50 border-red-200 text-red-800',
  net_worth_up:   'bg-emerald-50 border-emerald-200 text-emerald-800',
  net_worth_down: 'bg-red-50 border-red-200 text-red-800',
  budget_warning: 'bg-amber-50 border-amber-200 text-amber-800',
  daily_avg_down: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  daily_avg_up:   'bg-amber-50 border-amber-200 text-amber-800',
}

function InsightCard({ insight }: { insight: DashboardInsight }) {
  const Icon = insightIcons[insight.type] ?? Lightbulb
  const colorClass = insightColors[insight.type] ?? 'bg-slate-50 border-slate-200 text-slate-800'
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border p-4 text-sm font-medium', colorClass)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{insight.message}</span>
    </div>
  )
}

const timelineConfig: Record<DashboardTimelineEventType, { Icon: LucideIcon; colors: string }> = {
  month_open:      { Icon: CalendarDays,  colors: 'bg-indigo-50 text-indigo-600' },
  biggest_income:  { Icon: ArrowDownLeft, colors: 'bg-emerald-50 text-emerald-600' },
  biggest_expense: { Icon: ArrowUpRight,  colors: 'bg-red-50 text-red-600' },
  budget_exceeded: { Icon: AlertTriangle, colors: 'bg-amber-50 text-amber-600' },
  month_close:     { Icon: Clock,         colors: 'bg-slate-50 text-slate-600' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 13) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function getVariation(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const v = ((current - previous) / Math.abs(previous)) * 100
  return `${v >= 0 ? '+' : ''}${Math.round(v)}%`
}

function daysUntilDate(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(`${dateStr}T00:00:00`)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function shortDate(dateStr: string): string {
  const [, mm, dd] = dateStr.split('-')
  return `${dd}/${mm}`
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth()
  const { data, loading } = useDashboard()

  const unifiedUpcoming30 = useMemo(() => {
    if (!data) return []
    type Item = {
      id: string; daysUntil: number; label: string; amount: number
      kind: 'income' | 'expense' | 'loan-given' | 'loan-received'; autoCreate?: boolean
    }
    const ruleItems: Item[] = data.upcoming30Rules.map((r) => ({
      id: `rule-${r.id}`,
      daysUntil: daysUntilDate(r.next_due_date),
      label: r.description,
      amount: r.amount,
      kind: r.type === 'income' ? 'income' : 'expense',
      autoCreate: r.auto_create,
    }))
    const loanItems: Item[] = data.upcoming30Loans.map((l) => ({
      id: `loan-${l.id}`,
      daysUntil: daysUntilDate(l.due_date),
      label: `${l.counterpart}${l.description ? ` — ${l.description}` : ''}`,
      amount: l.remaining,
      kind: l.type === 'given' ? 'loan-given' : 'loan-received',
    }))
    return [...ruleItems, ...loanItems].sort((a, b) => a.daysUntil - b.daysUntil)
  }, [data])

  const upcoming30Summary = useMemo(() => {
    let uscite = 0, entrate = 0, rientri = 0
    for (const item of unifiedUpcoming30) {
      if (item.kind === 'expense' || item.kind === 'loan-received') uscite += item.amount
      else if (item.kind === 'income') entrate += item.amount
      else rientri += item.amount
    }
    return { uscite, entrate, rientri }
  }, [unifiedUpcoming30])

  const upcomingRules7 = useMemo(
    () => unifiedUpcoming30.filter((i) => i.daysUntil <= 7 && (i.kind === 'income' || i.kind === 'expense')).slice(0, 5),
    [unifiedUpcoming30],
  )

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.7fr)]">
          <Skeleton className="h-[360px] rounded-3xl" />
          <Skeleton className="h-[360px] rounded-3xl" />
        </div>
      </div>
    )
  }

  const {
    netWorth, netWorthVsPrevMonth, netWorthTrend,
    accounts, monthIncome, monthExpense, monthBalance,
    prevMonthIncome, prevMonthExpense,
    topCategories, recentTransactions,
    monthlyChart, insights, budgetSummary, goalsSummary,
    endOfMonthForecast, monthStats, monthRecords, timeline,
    cashFlowProjection, upcomingBirthdays, firstUseStatus,
  } = data

  const activeAccounts = accounts.filter((a) => !a.is_hidden)
  const absoluteAssets = activeAccounts.reduce((s, a) => s + Math.abs(a.balance), 0)
  const displayName    = profile?.display_name?.trim() || null
  const today          = format(new Date(), 'EEEE d MMMM yyyy', { locale: it })

  if (activeAccounts.length === 0) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-5xl flex-col justify-center gap-6">
        <FirstUseChecklist status={firstUseStatus} />
        <Card className="w-full max-w-xl border-[#e5e7f0] bg-white text-center shadow-sm">
          <CardContent className="p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600">
              <Wallet className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-slate-950">Aggiungi il tuo primo conto</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
              Il conto è il punto di partenza: da qui Aurora calcola patrimonio, entrate, uscite e andamento reale.
            </p>
            <Link href="/accounts" className={cn(buttonVariants(), 'mt-8 gap-2')}>
              <Plus className="h-4 w-4" />
              Aggiungi il tuo primo conto
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-7">

      {/* Greeting banner */}
      <section className="rounded-[2rem] border border-[#e5e7f0] bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4 lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-medium capitalize text-slate-500 sm:text-sm">{today}</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:mt-2 sm:text-4xl">
              {getGreeting()}{displayName ? `, ${displayName}` : ''}!
            </h1>
            <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-slate-500 sm:block">
              Una vista chiara sui tuoi movimenti reali: patrimonio, flussi mensili e conti attivi.
            </p>
          </div>
          <Link href="/transactions" className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 gap-1.5 sm:h-11 sm:px-4 sm:text-sm')}>
            <Plus className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Nuovo movimento</span>
            <ArrowRight className="hidden h-4 w-4 sm:inline" />
          </Link>
        </div>
      </section>

      <FirstUseChecklist status={firstUseStatus} />

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Patrimonio totale"
          value={formatCurrency(netWorth)}
          icon={Wallet}
          tone="indigo"
          detail={netWorthVsPrevMonth >= 0
            ? `+${formatCurrency(netWorthVsPrevMonth)} da inizio mese`
            : `${formatCurrency(netWorthVsPrevMonth)} da inizio mese`}
        />
        <StatCard
          title="Entrate mese"
          value={formatCurrency(monthIncome)}
          icon={TrendingUp}
          tone="green"
          detail={`${getVariation(monthIncome, prevMonthIncome)} vs mese scorso`}
        />
        <StatCard
          title="Uscite mese"
          value={formatCurrency(monthExpense)}
          icon={TrendingDown}
          tone="red"
          detail={`${getVariation(monthExpense, prevMonthExpense)} vs mese scorso`}
        />
        <StatCard
          title="Risparmio netto"
          value={formatCurrency(monthBalance)}
          icon={PiggyBank}
          tone="violet"
          detail={monthBalance >= 0 ? 'Mese in positivo' : 'Mese in negativo'}
        />
      </section>

      {goalsSummary.totalGoals > 0 && (
        <section>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                    <Target className="h-5 w-5 text-indigo-500" />
                    Obiettivi di risparmio
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Avanzamento dei traguardi personali separati dalla contabilità.</p>
                </div>
                <Link href="/goals" className="text-xs font-medium text-indigo-600 hover:underline">
                  Vedi obiettivi →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#f8f9fc] px-4 py-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Target</p>
                  <p className="mt-0.5 font-bold tabular-nums text-slate-900">{formatCurrency(goalsSummary.targetAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Accumulato</p>
                  <p className="mt-0.5 font-bold tabular-nums text-indigo-600">{formatCurrency(goalsSummary.savedAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Residuo</p>
                  <p className="mt-0.5 font-bold tabular-nums text-slate-900">{formatCurrency(goalsSummary.remainingAmount)}</p>
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>{goalsSummary.activeGoals} attivi · {goalsSummary.completedGoals} completati</span>
                  <span>{goalsSummary.completionPercentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                    style={{ width: `${Math.min(goalsSummary.completionPercentage, 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">In ritardo</p>
                  <p className={cn('mt-0.5 font-bold tabular-nums', goalsSummary.goalsBehind + goalsSummary.overdueGoals > 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {goalsSummary.goalsBehind + goalsSummary.overdueGoals}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Quota mensile</p>
                  <p className="mt-0.5 font-bold tabular-nums text-indigo-600">{formatCurrency(goalsSummary.totalRequiredMonthlyContribution)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">In linea</p>
                  <p className="mt-0.5 font-bold tabular-nums text-emerald-600">{goalsSummary.goalsOnTrack}</p>
                </div>
              </div>
              {goalsSummary.nearestCompletionGoal && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-emerald-950">
                      {goalsSummary.nearestCompletionGoal.icon ? `${goalsSummary.nearestCompletionGoal.icon} ` : ''}{goalsSummary.nearestCompletionGoal.name}
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      Obiettivo più vicino al completamento
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-emerald-700">
                    {formatCurrency(goalsSummary.nearestCompletionGoal.remainingAmount)}
                  </p>
                </div>
              )}
              {goalsSummary.nearestDeadlineGoal && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-indigo-950">
                      {goalsSummary.nearestDeadlineGoal.icon ? `${goalsSummary.nearestDeadlineGoal.icon} ` : ''}{goalsSummary.nearestDeadlineGoal.name}
                    </p>
                    <p className="mt-0.5 text-xs text-indigo-700">
                      Prossima scadenza {goalsSummary.nearestDeadlineGoal.target_date ? formatDate(goalsSummary.nearestDeadlineGoal.target_date) : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-indigo-700">
                    {goalsSummary.nearestDeadlineGoal.completionPercentage}%
                  </p>
                </div>
              )}
              {goalsSummary.primaryGoalsInsight && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <span className="font-bold">{goalsSummary.primaryGoalsInsight.title}: </span>
                  {goalsSummary.primaryGoalsInsight.message}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Saldo previsto + Statistiche del mese */}
      <section className="grid gap-4 sm:grid-cols-2">

        {/* Saldo previsto a fine mese */}
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-slate-950">
              <BarChart2 className="h-4 w-4 text-indigo-500" />
              Saldo previsto a fine mese
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!endOfMonthForecast.hasEnoughData ? (
              <p className="text-sm text-slate-400">Dati insufficienti — torna dopo almeno 3 giorni di movimenti.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Attuale</p>
                    <p className="mt-0.5 font-bold tabular-nums text-slate-900">{formatCurrency(endOfMonthForecast.currentBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Previsto</p>
                    <p className="mt-0.5 font-bold tabular-nums text-indigo-600">{formatCurrency(endOfMonthForecast.projectedBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Differenza</p>
                    <p className={cn('mt-0.5 font-bold tabular-nums', endOfMonthForecast.difference >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {endOfMonthForecast.difference >= 0 ? '+' : ''}{formatCurrency(endOfMonthForecast.difference)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Media giornaliera {formatCurrency(endOfMonthForecast.dailyAvgFlow)}/giorno
                  · {endOfMonthForecast.daysElapsed}/{endOfMonthForecast.daysInMonth} giorni trascorsi
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistiche del mese */}
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-slate-950">
              <Star className="h-4 w-4 text-amber-500" />
              Statistiche del mese
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthStats.txCount === 0 ? (
              <p className="text-sm text-slate-400">Nessun movimento registrato questo mese.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <MiniStatCard
                  label="Spesa media/giorno"
                  value={formatCurrency(monthStats.avgDailyExpense)}
                  sub={`${monthStats.daysElapsed} giorni`}
                />
                <MiniStatCard
                  label="Movimenti totali"
                  value={String(monthStats.txCount)}
                />
                {monthStats.peakExpenseDay && (
                  <MiniStatCard
                    label="Giorno più costoso"
                    value={shortDate(monthStats.peakExpenseDay)}
                    sub={formatCurrency(monthStats.peakExpenseAmount)}
                  />
                )}
                {monthStats.biggestIncome > 0 && (
                  <MiniStatCard
                    label="Entrata maggiore"
                    value={formatCurrency(monthStats.biggestIncome)}
                  />
                )}
                {monthStats.biggestExpense > 0 && (
                  <MiniStatCard
                    label="Uscita maggiore"
                    value={formatCurrency(monthStats.biggestExpense)}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Insight del mese (max 5) */}
      {insights.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-700">Insight del mese</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* Budget del mese */}
      {budgetSummary.totalBudgets > 0 && (
        <section>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-slate-950">
                  <PiggyBank className="h-4 w-4 text-indigo-500" />
                  Budget del mese
                </CardTitle>
                <Link href="/budgets" className="text-xs font-medium text-indigo-600 hover:underline">
                  Gestisci →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Budget totale</p>
                  <p className="mt-0.5 font-bold tabular-nums text-slate-900">{formatCurrency(budgetSummary.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Speso</p>
                  <p className="mt-0.5 font-bold tabular-nums text-red-600">{formatCurrency(budgetSummary.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rimanente</p>
                  <p className={cn('mt-0.5 font-bold tabular-nums', budgetSummary.totalRemaining >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {formatCurrency(budgetSummary.totalRemaining)}
                  </p>
                </div>
              </div>
              {budgetSummary.projectedTotalOverrun > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Superamento previsto totale: <span className="font-bold">{formatCurrency(budgetSummary.projectedTotalOverrun)}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {budgetSummary.exceededCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {budgetSummary.exceededCount} {budgetSummary.exceededCount === 1 ? 'sforato' : 'sforati'}
                  </span>
                )}
                {budgetSummary.projectedAtRiskCount > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
                    {budgetSummary.projectedAtRiskCount} a rischio (prev.)
                  </span>
                )}
                {budgetSummary.atRiskCount - budgetSummary.exceededCount > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
                    {budgetSummary.atRiskCount - budgetSummary.exceededCount} a rischio
                  </span>
                )}
                {budgetSummary.atRiskCount === 0 && budgetSummary.projectedAtRiskCount === 0 && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                    Tutti nella norma
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {budgetSummary.totalBudgets} budget
                </span>
              </div>
              {(budgetSummary.topProjectedRisks.length > 0 ? budgetSummary.topProjectedRisks : budgetSummary.topRiskBudgets).length > 0 && (
                <div className="space-y-3">
                  {(budgetSummary.topProjectedRisks.length > 0
                    ? budgetSummary.topProjectedRisks.map((b) => ({
                        categoryName: b.categoryName,
                        amount:       b.amount,
                        spent:        b.projectedSpent,
                        percentage:   b.projectedPercentage,
                        status:       b.projectedPercentage >= 100 ? 'exceeded' : b.projectedPercentage >= 90 ? 'critical' : 'warning',
                        isProjected:  true,
                      }))
                    : budgetSummary.topRiskBudgets.map((b) => ({ ...b, isProjected: false }))
                  ).map((b) => {
                    const isExceeded = b.status === 'exceeded'
                    const isCritical = b.status === 'critical'
                    return (
                      <div key={b.categoryName} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {b.categoryName}
                            {(b as any).isProjected && <span className="ml-1.5 text-xs text-slate-400">(prev.)</span>}
                          </p>
                          <span className={cn('text-xs font-bold tabular-nums', isExceeded ? 'text-red-600' : 'text-amber-600')}>
                            {b.percentage}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn('h-full rounded-full transition-all', isExceeded ? 'bg-red-500' : isCritical ? 'bg-orange-500' : 'bg-amber-400')}
                            style={{ width: `${Math.min(b.percentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400">{formatCurrency(b.spent)} / {formatCurrency(b.amount)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Record del mese */}
      {monthRecords.totalOps > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-700">Record del mese</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="border-[#e5e7f0] bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Categoria più costosa</p>
                {monthRecords.topSpendCategoryName ? (
                  <>
                    <p className="mt-1.5 font-bold text-slate-950">{monthRecords.topSpendCategoryName}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-red-600">{formatCurrency(monthRecords.topSpendCategoryAmount)}</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-sm text-slate-400">—</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-[#e5e7f0] bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Conto più utilizzato</p>
                {monthRecords.mostUsedAccountName ? (
                  <>
                    <p className="mt-1.5 font-bold text-slate-950">{monthRecords.mostUsedAccountName}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{monthRecords.mostUsedAccountTxCount} {monthRecords.mostUsedAccountTxCount === 1 ? 'operazione' : 'operazioni'}</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-sm text-slate-400">—</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-[#e5e7f0] bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Totale operazioni</p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-indigo-600">{monthRecords.totalOps}</p>
                <p className="mt-0.5 text-xs text-slate-400">movimenti registrati</p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Trend patrimonio — 12 mesi */}
      <section>
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Andamento patrimonio — ultimi 12 mesi</CardTitle>
            <p className="text-sm text-slate-500">Ricostruzione del patrimonio netto mese per mese.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={10} />
                  <YAxis
                    axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={10} width={72}
                    tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '').replace('€ ', '€')}
                  />
                  <Tooltip content={<NetWorthTooltip />} cursor={{ stroke: '#e5e7f0' }} />
                  <Area
                    type="monotone" dataKey="netWorth" name="Patrimonio"
                    stroke="#6366f1" strokeWidth={2}
                    fill="url(#nwGradient)"
                    dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#6366f1' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">Patrimonio corrente</p>
              <p className="text-lg font-bold tabular-nums text-indigo-600">{formatCurrency(netWorth)}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Chart 6 mesi + Conti */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Ultimi 6 mesi</CardTitle>
            <p className="text-sm text-slate-500">Entrate e uscite aggregate dai movimenti.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] sm:h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChart} barGap={8}>
                  <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={11} width={68}
                    tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '').replace('€ ', '€')}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8f9fc' }} />
                  <Bar dataKey="entrate" name="Entrate" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="uscite"  name="Uscite"  fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">I tuoi conti</CardTitle>
            <p className="text-sm text-slate-500">Peso proporzionale sul patrimonio totale.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...activeAccounts]
              .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
              .slice(0, 7)
              .map((account) => (
                <AccountRow key={account.id} account={account} total={absoluteAssets} />
              ))}
            {activeAccounts.length > 7 && (
              <Link href="/accounts" className="block pt-1 text-center text-xs font-medium text-indigo-600 hover:underline">
                Vedi tutti i conti →
              </Link>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Top categorie */}
      {topCategories.length > 0 && (
        <section>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-slate-950">Spese per categoria — mese corrente</CardTitle>
                <Link href="/budgets" className="text-xs font-medium text-indigo-600 hover:underline">
                  Vedi budget →
                </Link>
              </div>
              <p className="text-sm text-slate-500">Top categorie di spesa del mese.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {topCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg">
                    {cat.icon ?? '📦'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{cat.name}</p>
                      <AmountDisplay amount={cat.total} type="expense" className="shrink-0 text-sm font-bold" />
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-rose-500"
                        style={{ width: `${Math.min((cat.total / (topCategories[0]?.total || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{cat.count} {cat.count === 1 ? 'movimento' : 'movimenti'}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Timeline finanziaria */}
      {timeline.length > 0 && (
        <section>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                <Clock className="h-5 w-5 text-indigo-500" />
                Timeline finanziaria
              </CardTitle>
              <p className="text-sm text-slate-500">Gli eventi principali del mese in ordine cronologico.</p>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute inset-y-0 left-2 w-px bg-gradient-to-b from-indigo-200 via-slate-200 to-transparent" />
                <div className="space-y-4">
                  {timeline.map((event, i) => {
                    const cfg = timelineConfig[event.type] ?? { Icon: CalendarDays, colors: 'bg-slate-50 text-slate-600' }
                    return (
                      <div key={i} className="relative flex items-start gap-3">
                        {/* Dot on timeline */}
                        <div className={cn('absolute -left-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', cfg.colors)}>
                          <cfg.Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 pl-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{event.label}</p>
                            {event.amount != null && (
                              <AmountDisplay
                                amount={event.amount}
                                type={event.type === 'biggest_income' ? 'income' : 'expense'}
                                className="shrink-0 text-sm font-bold"
                              />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">{shortDate(event.date)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Prossimi 30 giorni */}
      {unifiedUpcoming30.length > 0 && (
        <section>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                  <CalendarClock className="h-5 w-5 text-indigo-500" />
                  Prossimi 30 giorni
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">Movimenti attesi e prestiti in scadenza.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                {upcoming30Summary.uscite > 0 && (
                  <span>
                    <span className="font-medium text-slate-500">Uscite attese </span>
                    <span className="font-bold tabular-nums text-red-600">{formatCurrency(upcoming30Summary.uscite)}</span>
                  </span>
                )}
                {upcoming30Summary.entrate > 0 && (
                  <span>
                    <span className="font-medium text-slate-500">Entrate attese </span>
                    <span className="font-bold tabular-nums text-emerald-600">{formatCurrency(upcoming30Summary.entrate)}</span>
                  </span>
                )}
                {upcoming30Summary.rientri > 0 && (
                  <span>
                    <span className="font-medium text-slate-500">Rientri prestiti </span>
                    <span className="font-bold tabular-nums text-indigo-600">{formatCurrency(upcoming30Summary.rientri)}</span>
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {unifiedUpcoming30.map((item) => {
                  const isUrgent  = item.daysUntil <= 7
                  const isLoan    = item.kind === 'loan-given' || item.kind === 'loan-received'
                  const isExpense = item.kind === 'expense' || item.kind === 'loan-received'
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 sm:gap-4 sm:py-3">
                      <div className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl',
                        isLoan ? 'bg-indigo-50 text-indigo-600' : isExpense ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
                      )}>
                        {isLoan ? <HandCoins className="h-4 w-4" /> : isExpense ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{item.label}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                          <span>{item.daysUntil === 0 ? 'Oggi' : `Tra ${item.daysUntil} ${item.daysUntil === 1 ? 'giorno' : 'giorni'}`}</span>
                          <span className={cn('rounded-full px-1.5 py-0.5 font-medium', isUrgent ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500')}>
                            {isUrgent ? '⚡ Urgente' : isLoan ? 'Prestito' : <Repeat className="inline h-3 w-3" />}
                          </span>
                        </p>
                      </div>
                      <AmountDisplay amount={item.amount} type={isExpense ? 'expense' : 'income'} className="shrink-0 text-sm font-bold" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Cash flow projection */}
      <section>
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Proiezione cash flow — prossimi 30 giorni</CardTitle>
            <p className="text-sm text-slate-500">Andamento della liquidità disponibile (conti correnti e contanti).</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashFlowProjection} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={10} interval={4} />
                  <YAxis
                    axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={10} width={68}
                    tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '').replace('€ ', '€')}
                  />
                  <Tooltip content={<CashFlowTooltip />} cursor={{ stroke: '#e5e7f0' }} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Line
                    type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props
                      const neg = payload.balance < 0
                      return (
                        <circle
                          key={`cf-${payload.dayIndex}`}
                          cx={cx} cy={cy} r={neg ? 4 : 2.5}
                          fill={neg ? '#ef4444' : '#6366f1'} stroke="white" strokeWidth={1}
                        />
                      )
                    }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {cashFlowProjection.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                {cashFlowProjection.every((d) => d.balance === cashFlowProjection[0].balance) ? (
                  <p className="text-sm text-slate-500">
                    Nessun movimento futuro previsto — aggiungi regole ricorrenti per una proiezione più accurata.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">Saldo previsto tra 30 giorni</p>
                    <p className={cn('text-lg font-bold tabular-nums', cashFlowProjection[cashFlowProjection.length - 1].balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {formatCurrency(cashFlowProjection[cashFlowProjection.length - 1].balance)}
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Prossime scadenze (7 giorni) + Compleanni */}
      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Prossime scadenze</CardTitle>
            <p className="text-sm text-slate-500">Ricorrenti in scadenza entro 7 giorni.</p>
          </CardHeader>
          <CardContent>
            {upcomingRules7.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-6 text-center">
                <p className="text-sm font-semibold text-slate-700">Nessuna scadenza nei prossimi 7 giorni</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingRules7.map((item) => {
                  const isExpense = item.kind === 'expense'
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 sm:gap-4 sm:py-3">
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl', isExpense ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>
                        {isExpense ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{item.label}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                          <span>{item.daysUntil === 0 ? 'Oggi' : `Tra ${item.daysUntil} ${item.daysUntil === 1 ? 'giorno' : 'giorni'}`}</span>
                          {item.autoCreate && (
                            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-600">Auto</span>
                          )}
                        </p>
                      </div>
                      <AmountDisplay amount={item.amount} type={isExpense ? 'expense' : 'income'} className="shrink-0 text-sm font-bold" />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Compleanni imminenti</CardTitle>
            <p className="text-sm text-slate-500">Nei prossimi 30 giorni.</p>
          </CardHeader>
          <CardContent>
            {upcomingBirthdays.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-6 text-center">
                <p className="text-sm font-semibold text-slate-700">Nessun compleanno nei prossimi 30 giorni</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingBirthdays.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 sm:gap-4 sm:py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 sm:h-10 sm:w-10 sm:rounded-2xl">
                      <Cake className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{b.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {b.daysUntil === 0 ? 'Oggi!' : `Tra ${b.daysUntil} ${b.daysUntil === 1 ? 'giorno' : 'giorni'}`}
                        {' · '}compie {b.age} anni
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Ultimi movimenti */}
      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-950">Ultimi movimenti</CardTitle>
          <p className="text-sm text-slate-500">Gli ultimi 3 movimenti registrati.</p>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-8 text-center">
              <p className="font-semibold text-slate-900">Nessun movimento ancora</p>
              <p className="mt-2 text-sm text-slate-500">Aggiungi un movimento per popolare la dashboard.</p>
              <Link href="/transactions" className={cn(buttonVariants({ variant: 'outline' }), 'mt-5 gap-2')}>
                <Plus className="h-4 w-4" />
                Nuovo movimento
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => {
                const isIncome = tx.type === 'income' && !tx.transferPeerId
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4 sm:py-4">
                    <TxIcon tx={tx} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {tx.description || (tx.transferPeerId ? 'Trasferimento' : isIncome ? 'Entrata' : 'Uscita')}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{tx.categoryIcon ? `${tx.categoryIcon} ` : ''}{tx.categoryName ?? 'Nessuna categoria'}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{tx.accountName}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{formatDate(tx.date)}</span>
                      </div>
                    </div>
                    <AmountDisplay
                      amount={tx.amount}
                      type={tx.transferPeerId ? 'income' : (isIncome ? 'income' : 'expense')}
                      className="shrink-0 text-sm font-bold"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
