import { useState, useEffect } from 'react'
import { HandCoins } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { LOAN_TYPE_LABELS } from '@/lib/constants'
import type { Loan } from '@/types/database'

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setLoans(data)
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Prestiti</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prestiti</h1>

      {loans.length === 0 ? (
        <EmptyState icon={HandCoins} title="Nessun prestito" description="Tieni traccia dei tuoi prestiti dati e ricevuti." />
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => (
            <Card key={loan.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{loan.person_name}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={loan.type === 'given' ? 'default' : 'secondary'}>
                    {LOAN_TYPE_LABELS[loan.type]}
                  </Badge>
                  {loan.is_settled && <Badge variant="outline">Saldato</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(loan.date)}
                      {loan.due_date && ` — Scadenza: ${formatDate(loan.due_date)}`}
                    </p>
                    {loan.description && <p className="text-xs text-muted-foreground mt-1">{loan.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(loan.remaining_amount)}</p>
                    <p className="text-xs text-muted-foreground">di {formatCurrency(loan.amount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
