import { NextRequest, NextResponse } from 'next/server'
import { recordScalableSyncError, syncScalableForUser } from '@/lib/integrations/scalable-sync'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Supabase admin client is not configured' },
      { status: 503 },
    )
  }

  const { data: connections, error: connectionsError } = await supabase
    .from('scalable_connections')
    .select('user_id')
    .order('connected_at', { ascending: true })

  if (connectionsError) {
    return NextResponse.json({ error: 'SCALABLE_CONNECTIONS_READ_FAILED' }, { status: 500 })
  }

  const results = {
    checked: 0,
    synced: 0,
    holdings: 0,
    errors: [] as Array<{ userId: string; error: string }>,
  }

  for (const connection of connections ?? []) {
    const userId = String(connection.user_id)
    results.checked++

    try {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
      if (userError || !userData.user) throw userError ?? new Error('USER_NOT_FOUND')

      const sync = await syncScalableForUser(supabase, userData.user)
      results.synced++
      results.holdings += sync.holdings
    } catch (error) {
      const message = await recordScalableSyncError(supabase, userId, error)
      console.error('[scalable:daily-sync]', { userId, error })
      results.errors.push({ userId, error: message })
    }
  }

  return NextResponse.json(
    {
      success: results.errors.length === 0,
      ...results,
      observedAt: new Date().toISOString(),
    },
    { status: results.errors.length === 0 ? 200 : 207 },
  )
}
