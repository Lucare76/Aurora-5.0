import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordScalableSyncError, syncScalableForUser } from '@/lib/integrations/scalable-sync'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  try {
    const result = await syncScalableForUser(supabase, user)
    return NextResponse.json(result)
  } catch (error) {
    const message = await recordScalableSyncError(supabase, user.id, error)
    console.error('[scalable:sync]', error)

    if (message === 'SCALABLE_NOT_CONNECTED') {
      return NextResponse.json({ error: 'SCALABLE_NOT_CONNECTED' }, { status: 409 })
    }
    if (message === 'SCALABLE_CONNECTION_READ_FAILED') {
      return NextResponse.json({ error: 'SCALABLE_CONNECTION_READ_FAILED' }, { status: 500 })
    }

    const reconnect = message.includes('RECONNECT') || message.includes('401') || message.includes('invalid_grant')
    return NextResponse.json(
      { error: reconnect ? 'SCALABLE_RECONNECT_REQUIRED' : 'SCALABLE_SYNC_FAILED', detail: message },
      { status: reconnect ? 401 : 502 },
    )
  }
}
