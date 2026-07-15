'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Cake,
  CalendarClock,
  HandCoins,
  PiggyBank,
  Plus,
  Repeat,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { createClient } from '@/lib/supabase/client'
import { ACCOUNT_TYPE_LABELS } from '@/lib/constants'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { Account, AccountType, Transaction } from '@/types/database'

interface MonthlyChartRow {
  key: string
  month: string
  entrate: number
  uscite: number
}

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  tone: 'indigo' | 'green' | 'red' | 'violet'
  detail: string
}

interface UpcomingRule {
  id: string
  description: string
  amount: number
  type: string
  next_due_date: string
  auto_create: boolean
}

interface UpcomingBirthday {
  id: string
  name: string
  birth_date: string
  daysUntil: number
  age: number
}

interface UpcomingLoan {
  id: string
  counterpart: string
  description: string | null
  remaining: number
  due_date: string
  type: 'given' | 'received'
}

interface CashFlowDay {
  day: string
  dayIndex: number
  balance: number
}

const monthLabels = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const toneClasses = {
  indigo: 'bg-indigo-100 text-indigo-600',
  green: 'bg-emerald-100 text-emerald-600',
  red: 'bg-red-100 text-red-600',
  violet: 'bg-violet-100 text-violet-600',
}

function getCurrentMonth() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

function getPreviousMonth() {
  const now = new Date()
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { month: previous.getMonth() + 1, year: previous.getFullYear() }
}

function getVariation(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const value = ((current - previous) / Math.abs(previous)) * 100
  return `${value >= 0 ? '+' : ''}${Math.round(value)}%`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 13) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function StatCard({ title, value, icon: Icon, tone, detail }: StatCardProps) {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-3 truncate text-2xl font-bold tabular-nums text-slate-950">{value}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-400">{detail}</p>
      </CardContent>
    </Card>
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

function TransactionIcon({ transaction }: { transaction: Transaction }) {
  const isIncome = transaction.type === 'income'
  const isTransfer = transaction.transfer_peer_id || transaction.type === 'transfer'

  if (isTransfer) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <ArrowLeftRight className="h-4 w-4" />
      </div>
    )
  }

  return (
    <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
      {isIncome ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
    </div>
  )
}

function AccountRow({ account, total }: { account: Account; total: number }) {
  const percent = total > 0 ? Math.min((Math.abs(account.balance) / total) * 100, 100) : 0

  return (
    <div className="rounded-2xl border border-[#e5e7f0] bg-white p-4">
      <div className="flex items-center justify-between gap-4">
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

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const current = getCurrentMonth()
  const previous = getPreviousMonth()
  const { accounts, totalBalance, loading: accountsLoading } = useAccounts()
  const { categories, loading: categoriesLoading } = useCategories()
  const { transactions: recentTransactions, loading: recentLoading } = useTransactions({ limit: 8 })
  const { totalIncome, totalExpense, loading: monthLoading } = useTransactions(current)
  const { totalIncome: previousIncome, totalExpense: previousExpense } = useTransactions(previous)
  const [chartData, setChartData] = useState<MonthlyChartRow[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [upcomingRules, setUpcomingRules] = useState<UpcomingRule[]>([])
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([])
  const [upcomingLoading, setUpcomingLoading] = useState(true)
  const [upcoming30Rules, setUpcoming30Rules] = useState<UpcomingRule[]>([])
  const [upcoming30Loans, setUpcoming30Loans] = useState<UpcomingLoan[]>([])
  const [upcoming30Loading, setUpcoming30Loading] = useState(true)
  const [dashBudgets, setDashBudgets] = useState<{ category_id: string; amount: number }[]>([])
  const [dashBudgetSpent, setDashBudgetSpent] = useState<Record<string, number>>({})
  const [cashFlowData, setCashFlowData] = useState<CashFlowDay[]>([])
  const [cashFlowLoading, setCashFlowLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function fetchChartData() {
      setChartLoading(true)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)

      const { data } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .gte('date', sixMonthsAgo.toLocaleDateString('en-CA'))
        .order('date', { ascending: true })

      if (!mounted) return

      const buckets = Array.from({ length: 6 }, (_, index) => {
        const date = new Date()
        date.setMonth(date.getMonth() - (5 - index))
        return {
          key: `${date.getFullYear()}-${date.getMonth()}`,
          month: monthLabels[date.getMonth()],
          entrate: 0,
          uscite: 0,
        }
      })

      for (const transaction of (data ?? []) as Pick<Transaction, 'amount' | 'type' | 'date'>[]) {
        const transactionDate = new Date(`${transaction.date}T00:00:00`)
        const key = `${transactionDate.getFullYear()}-${transactionDate.getMonth()}`
        const bucket = buckets.find((item) => item.key === key)
        if (!bucket) continue

        if (transaction.type === 'income') bucket.entrate += Number(transaction.amount)
        if (transaction.type === 'expense') bucket.uscite += Number(transaction.amount)
      }

      setChartData(buckets)
      setChartLoading(false)
    }

    fetchChartData()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function fetchUpcoming() {
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      const todayStr = todayDate.toLocaleDateString('en-CA')
      const in7 = new Date(todayDate)
      in7.setDate(todayDate.getDate() + 7)
      const in7Str = in7.toLocaleDateString('en-CA')

      const [rulesRes, bdRes] = await Promise.all([
        supabase
          .from('recurring_rules')
          .select('id, description, amount, type, next_due_date, auto_create')
          .eq('is_active', true)
          .gte('next_due_date', todayStr)
          .lte('next_due_date', in7Str)
          .order('next_due_date', { ascending: true })
          .limit(5),
        supabase.from('birthdays').select('id, name, birth_date'),
      ])

      if (!mounted) return

      setUpcomingRules((rulesRes.data ?? []) as UpcomingRule[])

      const bds = ((bdRes.data ?? []) as { id: string; name: string; birth_date: string }[])
        .map((b) => {
          const born = new Date(`${b.birth_date}T00:00:00`)
          let next = new Date(todayDate.getFullYear(), born.getMonth(), born.getDate())
          if (next < todayDate) next = new Date(todayDate.getFullYear() + 1, born.getMonth(), born.getDate())
          const daysUntil = Math.round((next.getTime() - todayDate.getTime()) / 86400000)
          const age = next.getFullYear() - born.getFullYear()
          return { ...b, daysUntil, age }
        })
        .filter((b) => b.daysUntil <= 30)
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 5)

      setUpcomingBirthdays(bds)
      setUpcomingLoading(false)
    }

    fetchUpcoming()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function fetchUpcoming30() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toLocaleDateString('en-CA')
      const in30 = new Date(today)
      in30.setDate(today.getDate() + 30)
      const in30Str = in30.toLocaleDateString('en-CA')

      const [rulesRes, loansRes] = await Promise.all([
        supabase
          .from('recurring_rules')
          .select('id, description, amount, type, next_due_date, auto_create')
          .eq('is_active', true)
          .gte('next_due_date', todayStr)
          .lte('next_due_date', in30Str)
          .order('next_due_date', { ascending: true }),
        supabase
          .from('loans')
          .select('id, counterpart, description, remaining, due_date, type')
          .eq('is_settled', false)
          .not('due_date', 'is', null)
          .gte('due_date', todayStr)
          .lte('due_date', in30Str)
          .order('due_date', { ascending: true }),
      ])

      if (!mounted) return
      setUpcoming30Rules((rulesRes.data ?? []) as UpcomingRule[])
      setUpcoming30Loans((loansRes.data ?? []) as UpcomingLoan[])
      setUpcoming30Loading(false)
    }

    fetchUpcoming30()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function fetchDashBudgets() {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const monthStart = new Date(year, month - 1, 1).toLocaleDateString('en-CA')
      const monthEnd = new Date(year, month, 0).toLocaleDateString('en-CA')

      const [budgetsRes, txRes] = await Promise.all([
        supabase.from('budgets').select('category_id, amount').eq('month', month).eq('year', year),
        supabase
          .from('transactions')
          .select('category_id, amount')
          .eq('type', 'expense')
          .is('transfer_peer_id', null)
          .gte('date', monthStart)
          .lte('date', monthEnd),
      ])

      if (!mounted) return

      const spentMap: Record<string, number> = {}
      for (const tx of (txRes.data ?? []) as { category_id: string | null; amount: number }[]) {
        if (!tx.category_id) continue
        spentMap[tx.category_id] = (spentMap[tx.category_id] ?? 0) + Number(tx.amount)
      }

      setDashBudgets((budgetsRes.data ?? []) as { category_id: string; amount: number }[])
      setDashBudgetSpent(spentMap)
    }

    fetchDashBudgets()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function fetchCashFlow() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toLocaleDateString('en-CA')
      const in30 = new Date(today)
      in30.setDate(today.getDate() + 30)
      const in30Str = in30.toLocaleDateString('en-CA')

      const [accountsRes, rulesRes, loansRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('balance, type')
          .eq('is_active', true)
          .in('type', ['checking', 'cash']),
        supabase
          .from('recurring_rules')
          .select('id, amount, type, next_due_date, frequency')
          .eq('is_active', true)
          .lte('next_due_date', in30Str),
        supabase
          .from('loans')
          .select('remaining, due_date, type')
          .eq('is_settled', false)
          .not('due_date', 'is', null)
          .gte('due_date', todayStr)
          .lte('due_date', in30Str),
      ])

      if (!mounted) return

      const liquidBalance = ((accountsRes.data ?? []) as { balance: number | string; type: string }[])
        .reduce((sum, a) => sum + Number(a.balance), 0)

      const dailyDelta = new Map<string, number>()

      type RuleRow = { amount: number; type: string; next_due_date: string; frequency: string }
      for (const rule of (rulesRes.data ?? []) as RuleRow[]) {
        const sign = rule.type === 'income' ? 1 : -1
        let cur = new Date(`${rule.next_due_date}T00:00:00`)
        while (cur <= in30) {
          if (cur >= today) {
            const key = cur.toLocaleDateString('en-CA')
            dailyDelta.set(key, (dailyDelta.get(key) ?? 0) + sign * Number(rule.amount))
          }
          const before = cur.getTime()
          switch (rule.frequency) {
            case 'daily':     cur.setDate(cur.getDate() + 1); break
            case 'weekly':    cur.setDate(cur.getDate() + 7); break
            case 'biweekly':  cur.setDate(cur.getDate() + 14); break
            case 'monthly':   cur.setMonth(cur.getMonth() + 1); break
            case 'quarterly': cur.setMonth(cur.getMonth() + 3); break
            case 'yearly':    cur.setFullYear(cur.getFullYear() + 1); break
            default: break
          }
          if (cur.getTime() === before) break
        }
      }

      type LoanRow = { remaining: number; due_date: string; type: string }
      for (const loan of (loansRes.data ?? []) as LoanRow[]) {
        const sign = loan.type === 'given' ? 1 : -1
        const key = loan.due_date
        dailyDelta.set(key, (dailyDelta.get(key) ?? 0) + sign * Number(loan.remaining))
      }

      let running = liquidBalance
      const series: CashFlowDay[] = []
      for (let i = 0; i <= 30; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        if (i > 0) running += dailyDelta.get(d.toLocaleDateString('en-CA')) ?? 0
        series.push({
          day: d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
          dayIndex: i,
          balance: Math.round(running * 100) / 100,
        })
      }

      setCashFlowData(series)
      setCashFlowLoading(false)
    }

    fetchCashFlow()
    return () => { mounted = false }
  }, [])

  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts])
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const absoluteAssets = useMemo(
    () => activeAccounts.reduce((sum, account) => sum + Math.abs(account.balance), 0),
    [activeAccounts],
  )

  const budgetAlerts = useMemo(() => {
    return dashBudgets
      .filter((b) => {
        const spent = dashBudgetSpent[b.category_id] ?? 0
        return b.amount > 0 && spent / b.amount >= 0.8
      })
      .map((b) => ({
        name: categoryById.get(b.category_id)?.name ?? 'Categoria',
        percent: Math.round(((dashBudgetSpent[b.category_id] ?? 0) / b.amount) * 100),
      }))
      .sort((a, b) => b.percent - a.percent)
  }, [dashBudgets, dashBudgetSpent, categoryById])

  const unifiedUpcoming30 = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    type Item = {
      id: string
      daysUntil: number
      label: string
      amount: number
      kind: 'income' | 'expense' | 'loan-given' | 'loan-received'
      autoCreate?: boolean
    }

    const ruleItems: Item[] = upcoming30Rules.map((r) => {
      const d = new Date(`${r.next_due_date}T00:00:00`)
      return {
        id: `rule-${r.id}`,
        daysUntil: Math.round((d.getTime() - today.getTime()) / 86400000),
        label: r.description,
        amount: r.amount,
        kind: r.type === 'income' ? 'income' : 'expense',
        autoCreate: r.auto_create,
      }
    })

    const loanItems: Item[] = upcoming30Loans.map((l) => {
      const d = new Date(`${l.due_date}T00:00:00`)
      return {
        id: `loan-${l.id}`,
        daysUntil: Math.round((d.getTime() - today.getTime()) / 86400000),
        label: `${l.counterpart}${l.description ? ` — ${l.description}` : ''}`,
        amount: l.remaining,
        kind: l.type === 'given' ? 'loan-given' : 'loan-received',
      }
    })

    return [...ruleItems, ...loanItems].sort((a, b) => a.daysUntil - b.daysUntil)
  }, [upcoming30Rules, upcoming30Loans])

  const upcoming30Summary = useMemo(() => {
    let uscite = 0, entrate = 0, rientri = 0
    for (const item of unifiedUpcoming30) {
      if (item.kind === 'expense' || item.kind === 'loan-received') uscite += item.amount
      else if (item.kind === 'income') entrate += item.amount
      else rientri += item.amount
    }
    return { uscite, entrate, rientri }
  }, [unifiedUpcoming30])

  const netSavings = totalIncome - totalExpense
  const displayName = profile?.display_name?.trim() || null
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: it })
  const loading = accountsLoading || categoriesLoading || recentLoading || monthLoading

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.7fr)]">
          <Skeleton className="h-[360px] rounded-3xl" />
          <Skeleton className="h-[360px] rounded-3xl" />
        </div>
      </div>
    )
  }

  if (activeAccounts.length === 0) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Card className="w-full max-w-xl border-[#e5e7f0] bg-white text-center shadow-sm">
          <CardContent className="p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600">
              <Wallet className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-slate-950">Aggiungi il tuo primo conto</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
              Appena colleghi un conto, Aurora calcola patrimonio, entrate, uscite e trend reali dalla tua base dati.
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
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[#e5e7f0] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-medium capitalize text-slate-500">{today}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {getGreeting()}{displayName ? `, ${displayName}` : ''}!
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Una vista chiara sui tuoi movimenti reali: patrimonio, flussi mensili e conti attivi.
            </p>
          </div>
          <Link href="/transactions" className={cn(buttonVariants(), 'h-11 gap-2 self-start lg:self-auto')}>
            Nuova transazione
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Patrimonio totale"
          value={formatCurrency(totalBalance)}
          icon={Wallet}
          tone="indigo"
          detail={`${activeAccounts.length} conti attivi`}
        />
        <StatCard
          title="Entrate mese corrente"
          value={formatCurrency(totalIncome)}
          icon={TrendingUp}
          tone="green"
          detail={`${getVariation(totalIncome, previousIncome)} vs mese scorso`}
        />
        <StatCard
          title="Uscite mese corrente"
          value={formatCurrency(totalExpense)}
          icon={TrendingDown}
          tone="red"
          detail={`${getVariation(totalExpense, previousExpense)} vs mese scorso`}
        />
        <StatCard
          title="Risparmio netto"
          value={formatCurrency(netSavings)}
          icon={PiggyBank}
          tone="violet"
          detail={netSavings >= 0 ? 'Mese in positivo' : 'Mese in negativo'}
        />
      </section>

      {budgetAlerts.length > 0 && (
        <section>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-slate-950">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Budget da tenere d&apos;occhio
                </CardTitle>
                <Link href="/budgets" className="text-xs font-medium text-indigo-600 hover:underline">
                  Vai ai budget →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {budgetAlerts.map((alert, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <span className="text-sm font-medium text-amber-800">{alert.name}</span>
                    <span className={cn('text-sm font-bold tabular-nums', alert.percent >= 100 ? 'text-red-600' : 'text-amber-600')}>
                      {alert.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {!upcoming30Loading && unifiedUpcoming30.length > 0 && (
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
                  const isUrgent = item.daysUntil <= 7
                  const isLoan = item.kind === 'loan-given' || item.kind === 'loan-received'
                  const isExpense = item.kind === 'expense' || item.kind === 'loan-received'
                  return (
                    <div key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                        isLoan ? 'bg-indigo-50 text-indigo-600' : isExpense ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
                      )}>
                        {isLoan ? <HandCoins className="h-4 w-4" /> : isExpense ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{item.label}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                          <span>{item.daysUntil === 0 ? 'Oggi' : `Tra ${item.daysUntil} ${item.daysUntil === 1 ? 'giorno' : 'giorni'}`}</span>
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 font-medium',
                            isUrgent ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500',
                          )}>
                            {isUrgent ? '⚡ Urgente' : isLoan ? 'Prestito' : <Repeat className="inline h-3 w-3" />}
                          </span>
                        </p>
                      </div>
                      <AmountDisplay
                        amount={item.amount}
                        type={isExpense ? 'expense' : 'income'}
                        className="shrink-0 text-sm font-bold"
                      />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Proiezione cash flow — prossimi 30 giorni</CardTitle>
            <p className="text-sm text-slate-500">Andamento della liquidità disponibile (conti correnti e contanti).</p>
          </CardHeader>
          <CardContent>
            {cashFlowLoading ? (
              <Skeleton className="h-[240px] rounded-2xl" />
            ) : (
              <>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cashFlowData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        stroke="#94a3b8"
                        fontSize={11}
                        interval={4}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        stroke="#94a3b8"
                        fontSize={11}
                        tickFormatter={(v) => formatCurrency(Number(v)).replace(',00', '')}
                        width={90}
                      />
                      <Tooltip content={<CashFlowTooltip />} cursor={{ stroke: '#e5e7f0' }} />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          const neg = payload.balance < 0
                          return (
                            <circle
                              key={`cf-${payload.dayIndex}`}
                              cx={cx}
                              cy={cy}
                              r={neg ? 4 : 2.5}
                              fill={neg ? '#ef4444' : '#6366f1'}
                              stroke="white"
                              strokeWidth={1}
                            />
                          )
                        }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {cashFlowData.length > 0 && (
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    {cashFlowData.every((d) => d.balance === cashFlowData[0].balance) ? (
                      <p className="text-sm text-slate-500">
                        Nessun movimento futuro previsto — aggiungi regole ricorrenti per una proiezione più accurata.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-500">Saldo previsto tra 30 giorni</p>
                        <p className={cn('text-lg font-bold tabular-nums', cashFlowData[cashFlowData.length - 1].balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {formatCurrency(cashFlowData[cashFlowData.length - 1].balance)}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Ultimi 6 mesi</CardTitle>
            <p className="text-sm text-slate-500">Entrate e uscite aggregate dai movimenti Supabase.</p>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[330px] rounded-2xl" />
            ) : (
              <div className="h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={8}>
                    <CartesianGrid stroke="#e5e7f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={12} />
                    <YAxis
                      axisLine={false}
                      tickFormatter={(value) => formatCurrency(Number(value)).replace(',00', '')}
                      tickLine={false}
                      stroke="#94a3b8"
                      fontSize={12}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8f9fc' }} />
                    <Bar dataKey="entrate" name="Entrate" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="uscite" name="Uscite" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
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

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Prossime scadenze</CardTitle>
            <p className="text-sm text-slate-500">Ricorrenti in scadenza entro 7 giorni.</p>
          </CardHeader>
          <CardContent>
            {upcomingLoading ? (
              <Skeleton className="h-32 rounded-2xl" />
            ) : upcomingRules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-6 text-center">
                <p className="text-sm font-semibold text-slate-700">Nessuna scadenza nei prossimi 7 giorni</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingRules.map((rule) => {
                  const isExpense = rule.type === 'expense'
                  const daysUntil = Math.round(
                    (new Date(`${rule.next_due_date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) /
                      86400000,
                  )
                  return (
                    <div key={rule.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                          isExpense ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
                        )}
                      >
                        {isExpense ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{rule.description}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                          <span>{daysUntil === 0 ? 'Oggi' : `Tra ${daysUntil} ${daysUntil === 1 ? 'giorno' : 'giorni'}`}</span>
                          {rule.auto_create && (
                            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-600">
                              Auto
                            </span>
                          )}
                        </p>
                      </div>
                      <AmountDisplay
                        amount={rule.amount}
                        type={isExpense ? 'expense' : 'income'}
                        className="shrink-0 text-sm font-bold"
                      />
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
            {upcomingLoading ? (
              <Skeleton className="h-32 rounded-2xl" />
            ) : upcomingBirthdays.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-6 text-center">
                <p className="text-sm font-semibold text-slate-700">Nessun compleanno nei prossimi 30 giorni</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingBirthdays.map((b) => (
                  <div key={b.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
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

      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-950">Ultimi movimenti</CardTitle>
          <p className="text-sm text-slate-500">Le ultime 8 transazioni registrate.</p>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e5e7f0] bg-[#f8f9fc] p-8 text-center">
              <p className="font-semibold text-slate-900">Nessun movimento ancora</p>
              <p className="mt-2 text-sm text-slate-500">Aggiungi una transazione per popolare la dashboard.</p>
              <Link href="/transactions" className={cn(buttonVariants({ variant: 'outline' }), 'mt-5 gap-2')}>
                <Plus className="h-4 w-4" />
                Nuova transazione
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((transaction) => {
                const category = transaction.category_id ? categoryById.get(transaction.category_id) : undefined
                const account = accountById.get(transaction.account_id)
                const isIncome = transaction.type === 'income'

                return (
                  <div key={transaction.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <TransactionIcon transaction={transaction} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {transaction.description || (transaction.transfer_peer_id ? 'Giroconto' : isIncome ? 'Entrata' : 'Uscita')}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{category?.icon ? `${category.icon} ` : ''}{category?.name ?? 'Nessuna categoria'}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{account?.name ?? 'Conto non trovato'}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{formatDate(transaction.date)}</span>
                      </div>
                    </div>
                    <AmountDisplay amount={transaction.amount} type={isIncome ? 'income' : 'expense'} className="shrink-0 text-sm font-bold" />
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
