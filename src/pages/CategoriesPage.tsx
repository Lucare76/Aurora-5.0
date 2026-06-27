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
        <h1 className="text-2xl font-bold">Categorie</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const allEmpty = incomeCategories.length === 0 && expenseCategories.length === 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categorie</h1>

      {allEmpty ? (
        <EmptyState icon={Tags} title="Nessuna categoria" description="Le categorie verranno create automaticamente alla registrazione." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-success">Entrate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {incomeCategories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{c.name}</span>
                    {c.color && (
                      <Badge variant="secondary" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                        {c.icon ?? ''}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-danger">Uscite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expenseCategories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{c.name}</span>
                    {c.color && (
                      <Badge variant="secondary" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
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
