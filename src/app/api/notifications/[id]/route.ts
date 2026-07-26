import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { markAsRead, markAsUnread } from '@/lib/notifications/service'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const patchSchema = z.object({
  is_read: z.boolean(),
})

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'NOTIFICATION_NOT_FOUND' }, 404)

  let body: unknown
  try   { body = await request.json() }
  catch { return json({ error: 'INVALID_NOTIFICATION_ACTION' }, 400) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_NOTIFICATION_ACTION' }, 400)

  try {
    const found = parsed.data.is_read
      ? await markAsRead(supabase, user.id, id)
      : await markAsUnread(supabase, user.id, id)

    if (!found) return json({ error: 'NOTIFICATION_NOT_FOUND' }, 404)
    return json({ data: { ok: true } }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
