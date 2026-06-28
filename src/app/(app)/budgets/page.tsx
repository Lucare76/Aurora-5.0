'use client'

import { PiggyBank } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { useBudgets } from '@/hooks/use-budgets'
import { formatCurrency, getMonthName } from '@/lib/utils'

export default function BudgetsPage() {
  const now = new Date()
  const { budgets, loading } = useBudgets()

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Budget</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Budget</h1>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
          {getMonthName(now.getMonth() + 1)} {now.getFullYear()}
        </span>
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Nessun budget"
          description="Imposta i tuoi budget mensili per tenere sotto controllo le spese."
        />
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => (
            <Card key={budget.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Limite</span>
                  <span className="text-lg font-bold tabular-nums text-slate-900">
                    {formatCurrency(budget.amount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
