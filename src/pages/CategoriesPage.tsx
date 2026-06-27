import { Tags } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useCategories } from '@/hooks/useCategories'

export default function CategoriesPage() {
  const { incomeCategories, expenseCategories, loading } = useCategories()

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Categorie</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/3 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const allEmpty = incomeCategories.length === 0 && expenseCategories.length === 0

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Categorie</h1>

      {allEmpty ? (
        <EmptyState icon={Tags} title="Nessuna categoria" description="Le categorie verranno create automaticamente alla registrazione." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
            <CardHeader>
              <CardTitle className="text-emerald-400">Entrate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {incomeCategories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.03]">
                    <span className="text-sm text-white">{c.name}</span>
                    {c.color && (
                      <Badge variant="secondary" className="border-0" style={{ backgroundColor: `${c.color}15`, color: c.color }}>
                        {c.icon ?? ''}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
            <CardHeader>
              <CardTitle className="text-red-400">Uscite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {expenseCategories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.03]">
                    <span className="text-sm text-white">{c.name}</span>
                    {c.color && (
                      <Badge variant="secondary" className="border-0" style={{ backgroundColor: `${c.color}15`, color: c.color }}>
                        {c.icon ?? ''}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
