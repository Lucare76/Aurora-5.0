import { PiggyBank } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { useBudgets } from '@/hooks/useBudgets'
import { formatCurrency, getMonthName } from '@/lib/utils'

export default function BudgetsPage() {
  const now = new Date()
  const { budgets, loading } = useBudgets()

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Budget</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/3 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Budget</h1>
        <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-white/50">
          {getMonthName(now.getMonth() + 1)} {now.getFullYear()}
        </span>
      </div>

      {budgets.length === 0 ? (
        <EmptyState icon={PiggyBank} title="Nessun budget" description="Imposta i tuoi budget mensili per tenere sotto controllo le spese." />
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => (
            <Card key={budget.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/40">Limite</span>
                  <span className="text-lg font-bold tabular-nums text-white">{formatCurrency(budget.amount)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
