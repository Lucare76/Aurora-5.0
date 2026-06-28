'use client'

import { useState, useEffect } from 'react'
import { HandCoins } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { LOAN_TYPE_LABELS } from '@/lib/constants'
import type { Loan } from '@/types/database'

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function fetchLoans() {
      const { data } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setLoans(data)
      setLoading(false)
    }
    fetchLoans()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Prestiti</h1>
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
      <h1 className="text-2xl font-bold text-slate-900">Prestiti</h1>

      {loans.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Nessun prestito"
          description="Tieni traccia dei tuoi prestiti dati e ricevuti."
        />
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => (
            <Card key={loan.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base text-slate-900">{loan.counterpart}</CardTitle>
                <div className="flex gap-2">
                  <Badge
                    variant={loan.type === 'given' ? 'default' : 'secondary'}
                    className={
                      loan.type === 'given'
                        ? ''
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }
                  >
                    {LOAN_TYPE_LABELS[loan.type]}
                  </Badge>
                  {loan.is_settled && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
                    >
                      Saldato
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">
                      {formatDate(loan.created_at)}
                      {loan.due_date && ` — Scadenza: ${formatDate(loan.due_date)}`}
                    </p>
                    {loan.description && (
                      <p className="mt-1 text-xs text-slate-400">{loan.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-slate-900">
                      {formatCurrency(loan.remaining)}
                    </p>
                    <p className="text-xs text-slate-400">di {formatCurrency(loan.amount)}</p>
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
