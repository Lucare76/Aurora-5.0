import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { resetPreferences } from '@/lib/notifications/preferences-service'
import type { NotificationType } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

const VALID_TYPES = [
  'negative_projected_balance', 'budget_threshold',
  'upcoming_recurrence', 'overdue_recurrence',
  'upcoming_loan_payment', 'overdue_loan_payment', 'loan_due_soon',
  'goal_behind_schedule', 'automation_failure', 'automation_conflict',
  'possible_duplicate',
] as const

const bodySchema = z.object({
  types: z.array(z.enum(VALID_TYPES)).optional(),
})

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch { return json({ error: 'INVALID_JSON' }, 400) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'INVALID_NOTIFICATION_PREFERENCES', details: parsed.error.flatten() }, 400)
  }

  try {
    await resetPreferences(supabase, user.id, parsed.data.types as NotificationType[] | undefined)
    return json({ data: { reset: true } }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
