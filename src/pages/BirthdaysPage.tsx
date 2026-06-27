import { useState, useEffect } from 'react'
import { Cake } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { Birthday } from '@/types/database'

export default function BirthdaysPage() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('birthdays')
        .select('*')
        .order('date', { ascending: true })
      if (data) setBirthdays(data)
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Compleanni</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/3 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Compleanni</h1>

      {birthdays.length === 0 ? (
        <EmptyState icon={Cake} title="Nessun compleanno" description="Aggiungi i compleanni delle persone importanti." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista compleanni</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {birthdays.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.03]">
                  <div>
                    <p className="text-sm font-medium text-white">{b.name}</p>
                    {b.notes && <p className="text-xs text-white/30">{b.notes}</p>}
                  </div>
                  <span className="text-sm tabular-nums text-white/50">{formatDate(b.birth_date, 'dd MMMM')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
