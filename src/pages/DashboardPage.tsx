import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, Activity, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useBudgets } from '@/hooks/useBudgets'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import type { Transaction } from '@/types/database'

interface MonthlyData {
  month: string
  entrate: number
  uscite: number
}

export default function DashboardPage() {
  const now = new Date()
  const { totalBalance, loading: accountsLoading } = useAccounts()
  const { transactions: recentTransactions, loading: recentLoading } = useTransactions({ limit: 5 })
  const { totalIncome, totalExpense, loading: monthLoading } = useTransactions({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  })
  const { budgets } = useBudgets()

  const [chartData, setChartData] = useState<MonthlyData[]>([])

  useEffect(() => {
    async function fetchLast6Months() {
      const months: MonthlyData[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const startDate = d.toISOString().split('T')[0]
        const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]

        const { data } = await supabase
          .from('transactions')
          .select('type, amount')
          .gte('date', startDate)
          .lte('date', endDate)

        const income = (data as Transaction[] | null)?.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0
        const expense = (data as Transaction[] | null)?.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0

        months.push({
          month: getMonthName(d.getMonth() + 1).slice(0, 3),
          entrate: income,
          uscite: expense,
        })
      }
      setChartData(months)
    }
    fetchLast6Months()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const netBalance = totalIncome - totalExpense

  const overBudgets = useMemo(() => {
    return budgets.filter((b) => b.amount > 0)
  }, [budgets])

  const isLoading = accountsLoading || monthLoading || recentLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo totale</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(totalBalance)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entrate mese</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <AmountDisplay amount={totalIncome} type="income" className="text-2xl font-bold" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uscite mese</CardTitle>
            <TrendingDown className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <AmountDisplay amount={totalExpense} type="expense" className="text-2xl font-bold" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo netto</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <AmountDisplay
              amount={netBalance}
              type={netBalance >= 0 ? 'income' : 'expense'}
              className="text-2xl font-bold"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ultimi 6 mesi</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--card-foreground))',
                }}
              />
              <Legend />
              <Bar dataKey="entrate" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="uscite" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ultime transazioni</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessuna transazione</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                    </div>
                    <AmountDisplay
                      amount={t.amount}
                      type={t.type === 'income' ? 'income' : 'expense'}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {overBudgets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Budget attivi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overBudgets.map((b) => (
                  <div key={b.id} className="flex items-center justify-between">
                    <p className="text-sm font-medium">Budget #{b.id.slice(0, 8)}</p>
                    <span className="text-sm tabular-nums">{formatCurrency(b.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
