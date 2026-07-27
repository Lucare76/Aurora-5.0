import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Notification, NotificationSeverity, NotificationType } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY']).default('DAILY'),
})

type DigestGroup = {
  type: NotificationType
  label: string
  critical: number
  warning: number
  info: number
  items: Array<{ id: string; title: string; severity: NotificationSeverity; source_url: string | null }>
}

type DigestResult = {
  period: { start: string; end: string }
  frequency: 'DAILY' | 'WEEKLY'
  total: number
  bySeverity: { CRITICAL: number; WARNING: number; INFO: number }
  byType: DigestGroup[]
  generatedAt: string
}

const TYPE_LABELS: Record<NotificationType, string> = {
  negative_projected_balance: 'Saldo previsto negativo',
  budget_threshold:           'Budget quasi esaurito / superato',
  upcoming_recurrence:        'Ricorrenza imminente',
  overdue_recurrence:         'Ricorrenza scaduta',
  upcoming_loan_payment:      'Pagamento imminente',
  overdue_loan_payment:       'Pagamento scaduto',
  loan_due_soon:              'Prestito in scadenza',
  goal_behind_schedule:       'Obiettivo in ritardo',
  automation_failure:         'Automazione fallita',
  automation_conflict:        'Conflitto automazione',
  possible_duplicate:         'Possibile duplicato',
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return json({ error: 'INVALID_FILTER' }, 400)

  const { frequency } = parsed.data
  const now    = new Date()
  const lookbackDays = frequency === 'DAILY' ? 1 : 7
  const start  = new Date(now.getTime() - lookbackDays * 86_400_000)
  const startIso = start.toISOString()

  try {
    // Fetch active notifications created/updated in the period
    const { data, error } = await (supabase as unknown as SupabaseClient)
      .from('notifications')
      .select('id, type, severity, title, source_url, created_at')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .gte('created_at', startIso)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500) as unknown as { data: Pick<Notification, 'id' | 'type' | 'severity' | 'title' | 'source_url' | 'created_at'>[] | null; error: unknown }

    if (error) throw error

    const notifications = data ?? []
    const bySeverity = { CRITICAL: 0, WARNING: 0, INFO: 0 }
    const groupMap = new Map<NotificationType, DigestGroup>()

    for (const n of notifications) {
      bySeverity[n.severity] = (bySeverity[n.severity] ?? 0) + 1
      const group = groupMap.get(n.type) ?? {
        type: n.type,
        label: TYPE_LABELS[n.type] ?? n.type,
        critical: 0, warning: 0, info: 0,
        items: [],
      }
      group[n.severity === 'CRITICAL' ? 'critical' : n.severity === 'WARNING' ? 'warning' : 'info']++
      if (group.items.length < 5) {
        group.items.push({ id: n.id, title: n.title, severity: n.severity, source_url: n.source_url })
      }
      groupMap.set(n.type, group)
    }

    const result: DigestResult = {
      period: { start: startIso, end: now.toISOString() },
      frequency,
      total: notifications.length,
      bySeverity,
      byType: Array.from(groupMap.values()).sort((a, b) => b.critical - a.critical || b.warning - a.warning),
      generatedAt: now.toISOString(),
    }

    return json({ data: result }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
