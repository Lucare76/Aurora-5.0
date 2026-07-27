import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listPreferences } from '@/lib/notifications/preferences-service'
import { resolveTypePreference } from '@/lib/notifications/preferences-defaults'
import type { NotificationType } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

const ALL_TYPES: NotificationType[] = [
  'negative_projected_balance', 'budget_threshold',
  'upcoming_recurrence', 'overdue_recurrence',
  'upcoming_loan_payment', 'overdue_loan_payment', 'loan_due_soon',
  'goal_behind_schedule', 'automation_failure', 'automation_conflict',
  'possible_duplicate',
]

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const rows = await listPreferences(supabase, user.id)
    const rowMap = new Map(rows.map((r) => [r.notification_type, r]))

    const data = Object.fromEntries(
      ALL_TYPES.map((t) => [t, resolveTypePreference(t, rowMap.get(t) ?? null)]),
    )
    return json({ data }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
