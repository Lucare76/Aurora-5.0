import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { snoozeNotification } from '@/lib/notifications/preferences-service'
import { snoozeSchema } from '@/lib/notifications/preferences-schema'

export const dynamic = 'force-dynamic'

const MAX_SNOOZE_DAYS = 30

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await params

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }

  const parsed = snoozeSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'INVALID_SNOOZE_DATE', details: parsed.error.flatten() }, 400)
  }

  const snoozedUntil = new Date(parsed.data.snoozed_until)
  if (snoozedUntil.getTime() <= Date.now()) {
    return json({ error: 'SNOOZE_DATE_IN_PAST' }, 400)
  }
  const maxDate = new Date(Date.now() + MAX_SNOOZE_DAYS * 86_400_000)
  if (snoozedUntil > maxDate) {
    return json({ error: 'INVALID_SNOOZE_DATE', message: `Maximum snooze is ${MAX_SNOOZE_DAYS} days` }, 400)
  }

  // Verify notification belongs to user
  const { data: notif } = await (supabase as unknown as SupabaseClient)
    .from('notifications')
    .select('id, severity')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle() as unknown as { data: { id: string; severity: string } | null }

  if (!notif) return json({ error: 'NOTIFICATION_NOT_FOUND' }, 404)

  try {
    await snoozeNotification(supabase, user.id, id, snoozedUntil)
    return json({ data: { snoozed: true, snoozed_until: snoozedUntil.toISOString(), severity: notif.severity } }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
