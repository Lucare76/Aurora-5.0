import { NextResponse } from 'next/server'
import { buildPersonalOverviewPayload } from '@/lib/dashboard/personal-overview'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return json({ error: 'UNAUTHENTICATED' }, 401)

  try {
    const payload = await buildPersonalOverviewPayload(supabase, user)
    return json(payload, 200)
  } catch (err) {
    console.error('[personal-overview]', { name: err instanceof Error ? err.name : 'unknown' })
    return json({ error: 'PERSONAL_OVERVIEW_UNAVAILABLE' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
