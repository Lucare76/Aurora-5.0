import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { listNotifications } from '@/lib/notifications/service'
import type { NotificationSeverity, NotificationStatusFilter, NotificationType } from '@/lib/notifications/types'
import { NOTIFICATIONS_DEFAULT_LIMIT, NOTIFICATIONS_PAGE_LIMIT } from '@/lib/notifications/constants'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: NotificationStatusFilter[] = ['all', 'unread', 'read', 'archived', 'resolved', 'snoozed']
const VALID_SEVERITIES: NotificationSeverity[]   = ['INFO', 'WARNING', 'CRITICAL']
const VALID_TYPES: NotificationType[] = [
  'negative_projected_balance', 'budget_threshold', 'overdue_recurrence',
  'upcoming_recurrence', 'upcoming_loan_payment', 'overdue_loan_payment',
  'loan_due_soon', 'goal_behind_schedule', 'automation_failure',
  'automation_conflict', 'possible_duplicate',
]

const querySchema = z.object({
  status:     z.enum(['all', 'unread', 'read', 'archived', 'resolved', 'snoozed']).default('all'),
  severity:   z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  type:       z.enum(VALID_TYPES as [NotificationType, ...NotificationType[]]).optional(),
  sourceType: z.enum(['account', 'budget', 'recurring_rule', 'savings_goal', 'loan', 'automation', 'transaction']).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(NOTIFICATIONS_PAGE_LIMIT).default(NOTIFICATIONS_DEFAULT_LIMIT),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return json({ error: 'INVALID_FILTER' }, 400)

  try {
    const result = await listNotifications(supabase, user.id, parsed.data)
    return json({ data: result }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
