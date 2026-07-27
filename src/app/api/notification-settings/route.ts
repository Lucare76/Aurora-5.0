import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSettings, upsertUserSettings } from '@/lib/notifications/preferences-service'
import { resolveUserSettings } from '@/lib/notifications/preferences-defaults'
import { userSettingsSchema } from '@/lib/notifications/preferences-schema'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const row = await getUserSettings(supabase, user.id)
    return json({ data: resolveUserSettings(row) }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }

  const parsed = userSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'INVALID_NOTIFICATION_PREFERENCES', details: parsed.error.flatten() }, 400)
  }

  // Validate quiet hours consistency
  const d = parsed.data
  if (d.quiet_hours_enabled && (!d.quiet_hours_start || !d.quiet_hours_end)) {
    return json({ error: 'INVALID_TIME_RANGE', message: 'quiet_hours_start and quiet_hours_end required when enabled' }, 400)
  }

  try {
    const row = await upsertUserSettings(supabase, user.id, parsed.data)
    return json({ data: resolveUserSettings(row) }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
