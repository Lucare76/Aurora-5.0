import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { unsnoozeNotification } from '@/lib/notifications/preferences-service'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await params

  const { data: notif } = await (supabase as unknown as SupabaseClient)
    .from('notifications')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle() as unknown as { data: { id: string } | null }
  if (!notif) return json({ error: 'NOTIFICATION_NOT_FOUND' }, 404)

  try {
    await unsnoozeNotification(supabase, user.id, id)
    return json({ data: { unsnoozed: true } }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
