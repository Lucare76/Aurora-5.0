import { useState, useEffect } from 'react'
import { Repeat } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { FREQUENCY_LABELS } from '@/lib/constants'
import type { RecurringRule } from '@/types/database'

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('recurring_rules')
        .select('*')
        .order('next_occurrence', { ascending: true })
      if (data) setRules(data)
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Ricorrenti</h1>
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
      <h1 className="text-2xl font-bold">Ricorrenti</h1>

      {rules.length === 0 ? (
        <EmptyState icon={Repeat} title="Nessuna regola ricorrente" description="Configura le tue entrate e uscite ricorrenti." />
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{rule.description}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="secondary">{FREQUENCY_LABELS[rule.frequency]}</Badge>
                  {!rule.is_active && <Badge variant="outline">Inattiva</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Prossima: {formatDate(rule.next_due_date)}
                  </p>
                  <AmountDisplay
                    amount={rule.amount}
                    type={rule.type === 'income' ? 'income' : 'expense'}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
