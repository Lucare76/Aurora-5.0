import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDashboardPayload } from '@/lib/dashboard/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }
  try {
    const payload = await buildDashboardPayload(supabase)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[aurora-dashboard]', { name: err instanceof Error ? err.name : 'unknown' })
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
