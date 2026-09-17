import { NextResponse } from 'next/server'
import { observability } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const startedAt = Date.now()

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error) throw error

    const durationMs = Date.now() - startedAt
    observability.info('health_check_ok', { durationMs })

    return NextResponse.json(
      {
        ok: true,
        app: 'aurora-5-0',
        database: 'ok',
        release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local',
        checkedAt: new Date().toISOString(),
        durationMs,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const durationMs = Date.now() - startedAt
    observability.error('health_check_failed', error, { durationMs })

    return NextResponse.json(
      {
        ok: false,
        app: 'aurora-5-0',
        database: 'unavailable',
        checkedAt: new Date().toISOString(),
        durationMs,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
