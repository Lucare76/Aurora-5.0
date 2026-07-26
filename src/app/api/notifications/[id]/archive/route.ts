import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { archiveNotification } from '@/lib/notifications/service'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'NOTIFICATION_NOT_FOUND' }, 404)

  try {
    const found = await archiveNotification(supabase, user.id, id)
    if (!found) return json({ error: 'NOTIFICATION_NOT_FOUND' }, 404)
    return json({ data: { ok: true } }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
