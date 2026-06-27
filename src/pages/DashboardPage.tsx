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
  delay?: string
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
  default: 'from-white/8 to-white/3 text-white/60',
  success: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
  danger: 'from-red-500/20 to-red-500/5 text-red-400',
  primary: 'from-aurora-purple/20 to-aurora-purple/5 text-aurora-purple',
}

const metricGlowClasses = {
  default: '',
  success: 'group-hover:shadow-emerald-500/10',
  danger: 'group-hover:shadow-red-500/10',
  primary: 'group-hover:shadow-aurora-purple/10',
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

function MetricCard({ title, value, detail, icon: Icon, tone = 'default', delay = '' }: MetricCardProps) {
  return (
    <div className={cn('group animate-slide-up', delay)}>
      <Card className="relative overflow-hidden transition-all duration-300 hover:border-white/12">
        <div className={cn('absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100', metricGlowClasses[tone])} />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-white/50">{title}</CardTitle>
          <div className={cn('rounded-xl bg-gradient-to-br p-2.5', metricToneClasses[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="truncate text-2xl font-bold tabular-nums text-white">{value}</p>
          <p className="mt-2 text-xs text-white/35">{detail}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="glass-strong rounded-xl px-4 py-3 text-sm shadow-2xl">
      <p className="mb-2 font-semibold text-white">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              <span className="capitalize text-white/50">{item.name}</span>
            </div>
            <span className="font-semibold tabular-nums text-white">
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
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>Mix mensile</span>
        <span className="tabular-nums">{total > 0 ? `${Math.round(incomeWidth)}% entrate` : 'nessun movimento'}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
        <div className="rounded-l-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700" style={{ width: `${incomeWidth}%` }} />
        <div className="rounded-r-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700" style={{ width: `${expenseWidth}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
          <p className="text-white/40">Entrate</p>
          <p className="mt-1 font-bold tabular-nums text-emerald-400">{formatCurrency(income)}</p>
        </div>
        <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-3">
          <p className="text-white/40">Uscite</p>
          <p className="mt-1 font-bold tabular-nums text-red-400">{formatCurrency(expense)}</p>
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
        <Skeleton className="h-56 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    )
  }

  if (hasNoData) {
    return (
      <div className="animate-fade-in">
        <div className="glass-card relative overflow-hidden rounded-2xl p-8 sm:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-aurora-purple/5 via-transparent to-aurora-emerald/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aurora-purple/30 to-transparent" />

          <div className="relative grid min-h-[480px] items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-aurora-purple/20 bg-aurora-purple/10 px-3.5 py-1.5 text-xs font-semibold text-aurora-purple">
                <Sparkles className="h-3.5 w-3.5" />
                Nuova dashboard Aurora
              </span>
              <h1 className="mt-8 max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Il tuo denaro,{' '}
                <span className="gradient-text">finalmente visibile.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/50">
                Aggiungi un conto e Aurora costruira una vista completa con saldo, trend, risparmio
                mensile e movimenti recenti.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/accounts" className={cn(buttonVariants(), 'h-12 gap-2 text-base')}>
                  <Plus className="h-4 w-4" />
                  Aggiungi conto
                </Link>
                <Link to="/transactions" className={cn(buttonVariants({ variant: 'outline' }), 'h-12 gap-2 text-base')}>
                  Nuova transazione
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{getMonthName(month)} {year}</p>
                  <p className="mt-1 text-xs text-white/35">Anteprima dashboard</p>
                </div>
                <div className="rounded-xl bg-aurora-purple/10 p-2.5 text-aurora-purple">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#12142a] to-[#0d0f1e] p-6 ring-1 ring-white/5">
                <p className="text-xs text-white/35">Patrimonio disponibile</p>
                <p className="mt-3 text-4xl font-bold tabular-nums text-white">€0,00</p>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="h-20 rounded-lg bg-gradient-to-t from-aurora-purple/60 to-aurora-purple/20" />
                  <div className="h-28 rounded-lg bg-gradient-to-t from-aurora-emerald/60 to-aurora-emerald/20" />
                  <div className="h-16 rounded-lg bg-gradient-to-t from-red-400/60 to-red-400/20" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                  <p className="text-xs text-white/40">Entrate</p>
                  <p className="mt-2 font-bold text-emerald-400">+ €0,00</p>
                </div>
                <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
                  <p className="text-xs text-white/40">Uscite</p>
                  <p className="mt-2 font-bold text-red-400">- €0,00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <section className="animate-fade-in">
        <div className="glass-card relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-aurora-purple/5 via-transparent to-aurora-emerald/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aurora-purple/40 to-transparent" />

          <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <div className="p-6 sm:p-8">
              <div className="mb-8 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-aurora-purple/20 bg-aurora-purple/10 px-3.5 py-1.5 text-xs font-semibold text-aurora-purple">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse-glow" />
                  Aurora overview
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-white/50">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {getMonthName(month)} {year}
                </span>
              </div>

              <div className="max-w-3xl">
                <p className="text-sm font-medium text-white/40">Patrimonio disponibile</p>
                <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">
                  {formatCurrency(totalBalance)}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/40">
                  Saldo, risparmio e flusso mensile a colpo d'occhio. Aurora ti aiuta
                  a prendere decisioni migliori.
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

            <div className="border-t border-white/5 bg-white/[0.02] p-6 backdrop-blur sm:p-8 lg:border-l lg:border-t-0">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Salute del mese</p>
                  <p className="mt-1 text-xs text-white/35">Risparmio netto e pressione uscite</p>
                </div>
                <div className="rounded-xl bg-aurora-purple/10 p-2.5 text-aurora-purple">
                  <Activity className="h-5 w-5" />
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-white/35">Risparmio netto</p>
                    <AmountDisplay
                      amount={netSavings}
                      type={netSavings >= 0 ? 'income' : 'expense'}
                      className="mt-1 block text-2xl font-bold"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/35">Tasso</p>
                    <p className={cn('mt-1 text-2xl font-bold tabular-nums', savingsRate >= 0 ? 'text-aurora-purple' : 'text-danger')}>
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
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Saldo totale"
          value={formatCurrency(totalBalance)}
          detail={`${activeAccounts.length} conti attivi`}
          icon={Wallet}
          delay="delay-100"
        />
        <MetricCard
          title="Entrate mese"
          value={formatCurrency(totalIncome)}
          detail="Flussi positivi registrati"
          icon={TrendingUp}
          tone="success"
          delay="delay-200"
        />
        <MetricCard
          title="Uscite mese"
          value={formatCurrency(totalExpense)}
          detail="Spesa consolidata del mese"
          icon={TrendingDown}
          tone="danger"
          delay="delay-300"
        />
        <MetricCard
          title="Mese migliore"
          value={bestMonth ? formatCurrency(bestMonth.netto) : formatCurrency(0)}
          detail={bestMonth ? `Netto di ${bestMonth.month}` : 'In attesa di dati'}
          icon={Landmark}
          tone="primary"
          delay="delay-400"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <div className="animate-slide-up delay-200">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Andamento finanziario</CardTitle>
                <p className="mt-1 text-sm text-white/35">Ultimi 6 mesi, con netto in evidenza</p>
              </div>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <Skeleton className="h-[340px] rounded-xl" />
              ) : (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} barGap={8}>
                      <defs>
                        <linearGradient id="netGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0.5} />
                        </linearGradient>
                        <linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#f87171" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        axisLine={false}
                        dataKey="month"
                        tickLine={false}
                        stroke="rgba(255,255,255,0.3)"
                        fontSize={12}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        stroke="rgba(255,255,255,0.3)"
                        fontSize={12}
                        tickFormatter={(value) => formatCurrency(Number(value)).replace(',00', '')}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Area
                        dataKey="netto"
                        name="netto"
                        fill="url(#netGradient)"
                        stroke="#818cf8"
                        strokeWidth={2}
                        type="monotone"
                      />
                      <Bar dataKey="entrate" name="entrate" fill="url(#incomeGradient)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="uscite" name="uscite" fill="url(#expenseGradient)" radius={[6, 6, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="animate-slide-up delay-300">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conti attivi</CardTitle>
            </CardHeader>
            <CardContent>
              {activeAccounts.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/35">Nessun conto attivo.</p>
              ) : (
                <div className="space-y-3">
                  {activeAccounts.slice(0, 5).map((account) => (
                    <div key={account.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 transition-colors hover:bg-white/[0.04]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{account.name}</p>
                        <p className="text-xs capitalize text-white/35">{account.type}</p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                        {formatCurrency(account.balance, account.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="animate-slide-up delay-400">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ultime transazioni</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-white/35">Nessuna transazione registrata.</p>
                <Link to="/transactions" className={cn(buttonVariants({ variant: 'link' }), 'mt-2 text-aurora-purple')}>
                  Aggiungi la prima transazione
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentTransactions.map((transaction) => {
                  const category = transaction.category_id
                    ? categoryById.get(transaction.category_id)
                    : undefined
                  const isIncome = transaction.type === 'income'

                  return (
                    <div key={transaction.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {transaction.description || (isIncome ? 'Entrata' : 'Uscita')}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/35">
                          <span>{category?.name ?? 'Senza categoria'}</span>
                          <span className="h-1 w-1 rounded-full bg-white/20" />
                          <span>{formatDate(transaction.date)}</span>
                        </div>
                      </div>
                      <AmountDisplay
                        amount={transaction.amount}
                        type={isIncome ? 'income' : 'expense'}
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
    </div>
  )
}
