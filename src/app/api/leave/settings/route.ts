import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePrivateHrAccess } from '@/lib/access/private-finance-access'
import { leaveSettingsSchema } from '@/lib/leave/schemas'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  const { data, error } = await supabase
    .from('leave_settings')
    .select('id,user_id,vacation_days_per_year,permit_104_hours_per_month,timezone,created_at,updated_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return json({ error: 'LEAVE_SETTINGS_UNAVAILABLE' }, 500)
  if (data) return json({ data }, 200)

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome'
  const created = await supabase
    .from('leave_settings')
    .insert({ user_id: user.id, timezone })
    .select('id,user_id,vacation_days_per_year,permit_104_hours_per_month,timezone,created_at,updated_at')
    .single()
  if (created.error) return json({ error: 'LEAVE_SETTINGS_UNAVAILABLE' }, 500)
  return json({ data: created.data }, 200)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }
  const parsed = leaveSettingsSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_LEAVE_SETTINGS', details: parsed.error.flatten() }, 400)

  const { data, error } = await supabase
    .from('leave_settings')
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: 'user_id' })
    .select('id,user_id,vacation_days_per_year,permit_104_hours_per_month,timezone,created_at,updated_at')
    .single()
  if (error) return json({ error: 'LEAVE_SETTINGS_SAVE_FAILED' }, 500)
  return json({ data }, 200)
}
