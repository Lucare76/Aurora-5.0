import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAndSetCooldown, loadEngineInput, runFullRefresh } from '@/lib/notifications/service'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const inCooldown = await checkAndSetCooldown(supabase, user.id)
    if (inCooldown) return json({ error: 'REFRESH_COOLDOWN' }, 429)

    const now   = new Date()
    const input = await loadEngineInput(supabase, user.id, now)
    const result = await runFullRefresh(supabase, user.id, input)

    return json({ data: result }, 200)
  } catch (err) {
    console.error('[aurora-notifications] refresh failed', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'REFRESH_FAILED' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
