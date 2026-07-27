import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createSourceMute, listSourceMutes, validateSourceOwnership } from '@/lib/notifications/preferences-service'
import { createMuteSchema } from '@/lib/notifications/preferences-schema'

export const dynamic = 'force-dynamic'

const MAX_MUTES_PER_USER = 200

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { searchParams } = new URL(request.url)
  const page  = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))

  try {
    const result = await listSourceMutes(supabase, user.id, page, limit)
    return json({ data: result }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }

  const parsed = createMuteSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'INVALID_NOTIFICATION_PREFERENCES', details: parsed.error.flatten() }, 400)
  }

  // Validate muted_until is in the future
  if (parsed.data.muted_until) {
    if (new Date(parsed.data.muted_until).getTime() <= Date.now()) {
      return json({ error: 'INVALID_SNOOZE_DATE', message: 'muted_until must be in the future' }, 400)
    }
  }

  // Check source ownership
  const owned = await validateSourceOwnership(
    supabase, user.id, parsed.data.source_type, parsed.data.source_id,
  )
  if (!owned) {
    return json({ error: 'SOURCE_NOT_FOUND' }, 404)
  }

  // Enforce per-user mute limit
  const { count: muteCount } = await (supabase as unknown as SupabaseClient)
    .from('notification_source_mutes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (muteCount !== null && muteCount >= MAX_MUTES_PER_USER) {
    return json({ error: 'INVALID_NOTIFICATION_PREFERENCES', message: 'Maximum source mutes reached' }, 400)
  }

  try {
    const mute = await createSourceMute(supabase, user.id, parsed.data)
    return json({ data: mute }, 201)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
