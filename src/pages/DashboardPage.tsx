import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
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
}

interface MetricCardProps {
  title: string
  value: string
  icon: typeof Wallet
  tone?: 'default' | 'success' | 'danger' | 'primary'
}

interface ChartTooltipPayload {
  dataKey?: string | number
  name?: string | number
  value?: number
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string
}

const metricToneClasses = {
  default: 'text-muted-foreground bg-muted',
  success: 'text-success bg-emerald-500/10',
  danger: 'text-danger bg-red-500/10',
  primary: 'text-primary bg-primary/10',
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

function MetricCard({ title, value, icon: Icon, tone = 'default' }: MetricCardProps) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('rounded-md p-2', metricToneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="truncate text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-xl">
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

export default function DashboardPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const { accounts, totalBalance, loading: accountsLoading } = useAccounts()
  const { categories, loading: categoriesLoading } = useCategories()
  const {
    transactions: recentTransactions,
    loading: recentLoading,
  } = useTransactions({ limit: 5 })
  const {
    totalIncome,
    totalExpense,
    loading: monthLoading,
  } = useTransactions({ month, year })

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

      setChartData(months.map(({ startDate, endDate, ...item }) => item))
      setChartLoading(false)
    }

    fetchChartData()

    return () => {
      mounted = false
    }
  }, [])

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]))
  }, [categories])

  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts])
  const netSavings = totalIncome - totalExpense
  const hasNoData = !accountsLoading && !recentLoading && accounts.length === 0 && recentTransactions.length === 0
  const loading = accountsLoading || monthLoading || recentLoading || categoriesLoading

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-44" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
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
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <EmptyState
          icon={Wallet}
          title="Inizia dai tuoi conti"
          description="Aggiungi il primo conto per vedere saldo, andamento mensile e ultime transazioni nella dashboard."
          action={
            <Link to="/accounts" className={cn(buttonVariants(), 'gap-2')}>
                <Plus className="h-4 w-4" />
                Aggiungi conto
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Una vista chiara su saldo, flussi e movimenti recenti.
          </p>
        </div>
        <Link
          to="/transactions"
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 self-start sm:self-auto')}
        >
            Nuova transazione
            <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Saldo totale" value={formatCurrency(totalBalance)} icon={Wallet} />
        <MetricCard title="Entrate mese" value={formatCurrency(totalIncome)} icon={TrendingUp} tone="success" />
        <MetricCard title="Uscite mese" value={formatCurrency(totalExpense)} icon={TrendingDown} tone="danger" />
        <MetricCard
          title="Risparmio netto mese"
          value={formatCurrency(netSavings)}
          icon={Activity}
          tone="primary"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Entrate vs uscite</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[320px]" />
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={8}>
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
                    <Bar dataKey="entrate" name="entrate" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="uscite" name="uscite" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Conti attivi</CardTitle>
          </CardHeader>
          <CardContent>
            {activeAccounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nessun conto attivo.</p>
            ) : (
              <div className="space-y-3">
                {activeAccounts.slice(0, 5).map((account) => (
                  <div key={account.id} className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3">
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

      <Card className="border-border bg-card">
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
