import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markAllAsRead } from '@/lib/notifications/service'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const count = await markAllAsRead(supabase, user.id)
    return json({ data: { markedCount: count } }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
