import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Landmark,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, formatDate, getMonthName } from '@/lib/utils'
import type { Transaction } from '@/types/database'

interface MonthlyData {
  key: string
  month: string
  entrate: number
  uscite: number
  netto: number
}

interface MetricCardProps {
  title: string
  value: string
  detail: string
  icon: typeof Wallet
  tone?: 'default' | 'success' | 'danger' | 'primary'
}

interface ChartTooltipPayload {
  dataKey?: string | number
  name?: string | number
  value?: number
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string
}

const metricToneClasses = {
  default: 'border-slate-200 bg-white text-slate-500',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-success',
  danger: 'border-red-500/20 bg-red-500/10 text-danger',
  primary: 'border-primary/25 bg-primary/10 text-primary',
}

function getMonthWindow(offset: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)

  return {
    start,
    end,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

function MetricCard({ title, value, detail, icon: Icon, tone = 'default' }: MetricCardProps) {
  return (
    <Card className="group overflow-hidden border-slate-200 bg-white shadow-xl shadow-slate-200/70 transition-colors hover:border-primary/35">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('rounded-lg border p-2', metricToneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="truncate text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-xl">
      <p className="mb-2 font-medium text-foreground">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6">
            <span className="capitalize text-muted-foreground">{item.name}</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatCurrency(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlowMeter({ income, expense }: { income: number; expense: number }) {
  const total = income + expense
  const incomeWidth = total > 0 ? Math.max((income / total) * 100, 4) : 50
  const expenseWidth = total > 0 ? Math.max((expense / total) * 100, 4) : 50

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Mix mensile</span>
        <span className="tabular-nums">{total > 0 ? `${Math.round(incomeWidth)}% entrate` : 'nessun movimento'}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        <div className="bg-emerald-400" style={{ width: `${incomeWidth}%` }} />
        <div className="bg-red-400" style={{ width: `${expenseWidth}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3">
          <p className="text-muted-foreground">Entrate</p>
          <p className="mt-1 font-semibold tabular-nums text-success">{formatCurrency(income)}</p>
        </div>
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-muted-foreground">Uscite</p>
          <p className="mt-1 font-semibold tabular-nums text-danger">{formatCurrency(expense)}</p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const { accounts, totalBalance, loading: accountsLoading } = useAccounts()
  const { categories, loading: categoriesLoading } = useCategories()
  const { transactions: recentTransactions, loading: recentLoading } = useTransactions({ limit: 5 })
  const { totalIncome, totalExpense, loading: monthLoading } = useTransactions({ month, year })

  const [chartData, setChartData] = useState<MonthlyData[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function fetchChartData() {
      setChartLoading(true)

      const oldest = getMonthWindow(5)
      const newest = getMonthWindow(0)
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, date')
        .gte('date', oldest.startDate)
        .lte('date', newest.endDate)

      if (!mounted) return

      const transactions = error ? [] : ((data ?? []) as Pick<Transaction, 'type' | 'amount' | 'date'>[])
      const months = Array.from({ length: 6 }, (_, index) => {
        const offset = 5 - index
        const window = getMonthWindow(offset)

        return {
          key: `${window.start.getFullYear()}-${window.start.getMonth() + 1}`,
          month: getMonthName(window.start.getMonth() + 1).slice(0, 3),
          entrate: 0,
          uscite: 0,
          startDate: window.startDate,
          endDate: window.endDate,
        }
      })

      for (const transaction of transactions) {
        const targetMonth = months.find(
          (item) => transaction.date >= item.startDate && transaction.date <= item.endDate
        )

        if (!targetMonth) continue

        if (transaction.type === 'income') {
          targetMonth.entrate += transaction.amount
        }

        if (transaction.type === 'expense') {
          targetMonth.uscite += transaction.amount
        }
      }

      setChartData(months.map(({ startDate, endDate, ...item }) => ({
        ...item,
        netto: item.entrate - item.uscite,
      })))
      setChartLoading(false)
    }

    fetchChartData()

    return () => {
      mounted = false
    }
  }, [])

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts])
  const netSavings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0
  const bestMonth = useMemo(() => {
    return chartData.reduce<MonthlyData | null>((best, item) => {
      if (!best || item.netto > best.netto) return item
      return best
    }, null)
  }, [chartData])
  const hasNoData = !accountsLoading && !recentLoading && accounts.length === 0 && recentTransactions.length === 0
  const loading = accountsLoading || monthLoading || recentLoading || categoriesLoading

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[360px]" />
      </div>
    )
  }

  if (hasNoData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-white via-indigo-50 to-sky-100 p-6 shadow-2xl shadow-slate-200/80 sm:p-10">
        <div className="grid min-h-[520px] items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Nuova dashboard Aurora
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-6xl">
              Il tuo denaro, finalmente visibile.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              Aggiungi un conto e Aurora costruira una vista completa con saldo, trend, risparmio
              mensile e movimenti recenti.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/accounts" className={cn(buttonVariants(), 'h-11 gap-2 shadow-lg shadow-indigo-200')}>
                <Plus className="h-4 w-4" />
                Aggiungi conto
              </Link>
              <Link to="/transactions" className={cn(buttonVariants({ variant: 'outline' }), 'h-11 gap-2 bg-white/70')}>
                Nuova transazione
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-white/80 bg-white/75 p-5 shadow-2xl shadow-indigo-200/60 backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Anteprima dashboard</p>
                <p className="mt-1 text-xs text-slate-500">{getMonthName(month)} {year}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-2 text-primary">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="rounded-lg bg-slate-950 p-5 text-white">
              <p className="text-xs text-slate-400">Patrimonio disponibile</p>
              <p className="mt-3 text-4xl font-semibold tabular-nums">€0,00</p>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="h-20 rounded-md bg-indigo-500/80" />
                <div className="h-28 rounded-md bg-emerald-400/80" />
                <div className="h-16 rounded-md bg-red-400/80" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs text-slate-500">Entrate</p>
                <p className="mt-2 font-semibold text-success">+ €0,00</p>
              </div>
              <div className="rounded-md border border-red-100 bg-red-50 p-4">
                <p className="text-xs text-slate-500">Uscite</p>
                <p className="mt-2 font-semibold text-danger">- €0,00</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-white via-indigo-50 to-sky-100 shadow-2xl shadow-slate-200/80">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className="relative p-6 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-400 to-sky-400" />
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Aurora overview
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 shadow-sm">
                <CalendarDays className="h-3.5 w-3.5" />
                {getMonthName(month)} {year}
              </span>
            </div>

            <div className="max-w-3xl">
              <p className="text-sm font-medium text-slate-600">Patrimonio disponibile</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-6xl">
                {formatCurrency(totalBalance)}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Dashboard piu chiara, ariosa e orientata alle decisioni: saldo, risparmio e flusso
                mensile restano leggibili a colpo d'occhio.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/transactions" className={cn(buttonVariants(), 'gap-2')}>
                Nuova transazione
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/accounts" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
                Gestisci conti
                <Wallet className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white/65 p-6 backdrop-blur sm:p-8 lg:border-l lg:border-t-0">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Salute del mese</p>
                <p className="mt-1 text-xs text-slate-500">Risparmio netto e pressione uscite</p>
              </div>
              <div className="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Risparmio netto</p>
                  <AmountDisplay
                    amount={netSavings}
                    type={netSavings >= 0 ? 'income' : 'expense'}
                    className="mt-1 block text-2xl font-semibold"
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Tasso</p>
                  <p className={cn('mt-1 text-2xl font-semibold tabular-nums', savingsRate >= 0 ? 'text-primary' : 'text-danger')}>
                    {savingsRate}%
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <FlowMeter income={totalIncome} expense={totalExpense} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Saldo totale"
          value={formatCurrency(totalBalance)}
          detail={`${activeAccounts.length} conti attivi`}
          icon={Wallet}
        />
        <MetricCard
          title="Entrate mese"
          value={formatCurrency(totalIncome)}
          detail="Flussi positivi registrati"
          icon={TrendingUp}
          tone="success"
        />
        <MetricCard
          title="Uscite mese"
          value={formatCurrency(totalExpense)}
          detail="Spesa consolidata del mese"
          icon={TrendingDown}
          tone="danger"
        />
        <MetricCard
          title="Mese migliore"
          value={bestMonth ? formatCurrency(bestMonth.netto) : formatCurrency(0)}
          detail={bestMonth ? `Netto di ${bestMonth.month}` : 'In attesa di dati'}
          icon={Landmark}
          tone="primary"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Andamento finanziario</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Ultimi 6 mesi, con netto in evidenza</p>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[340px]" />
            ) : (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} barGap={8}>
                    <defs>
                      <linearGradient id="netGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="month"
                      tickLine={false}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickFormatter={(value) => formatCurrency(Number(value)).replace(',00', '')}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--accent)' }} />
                    <Area
                      dataKey="netto"
                      name="netto"
                      fill="url(#netGradient)"
                      stroke="#818cf8"
                      strokeWidth={2}
                      type="monotone"
                    />
                    <Bar dataKey="entrate" name="entrate" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="uscite" name="uscite" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          <CardHeader>
            <CardTitle className="text-lg">Conti attivi</CardTitle>
          </CardHeader>
          <CardContent>
            {activeAccounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nessun conto attivo.</p>
            ) : (
              <div className="space-y-3">
                {activeAccounts.slice(0, 5).map((account) => (
                  <div key={account.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{account.type}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(account.balance, account.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/70">
        <CardHeader>
          <CardTitle className="text-lg">Ultime transazioni</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Nessuna transazione registrata.</p>
              <Link to="/transactions" className={cn(buttonVariants({ variant: 'link' }), 'mt-2')}>
                Aggiungi la prima transazione
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTransactions.map((transaction) => {
                const category = transaction.category_id
                  ? categoryById.get(transaction.category_id)
                  : undefined
                const isIncome = transaction.type === 'income'

                return (
                  <div key={transaction.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {transaction.description || (isIncome ? 'Entrata' : 'Uscita')}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{category?.name ?? 'Senza categoria'}</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                        <span>{formatDate(transaction.date)}</span>
                      </div>
                    </div>
                    <AmountDisplay
                      amount={transaction.amount}
                      type={isIncome ? 'income' : 'expense'}
                      className="shrink-0 text-sm font-semibold"
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
