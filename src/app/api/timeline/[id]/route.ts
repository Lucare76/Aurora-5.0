import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePrivateHrAccess } from '@/lib/access/private-finance-access'
import { timelinePatchSchema } from '@/lib/timeline'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const TIMELINE_SELECT = 'id,user_id,event_date,end_date,title,description,category,subject,location,provider,tags,importance,created_at,updated_at'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  const { data, error } = await supabase
    .from('personal_timeline_events')
    .select(TIMELINE_SELECT)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) return json({ error: 'TIMELINE_EVENT_NOT_FOUND' }, 404)
  return json({ data }, 200)
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }
  const parsed = timelinePatchSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_TIMELINE_EVENT', details: parsed.error.flatten() }, 400)

  const patch = { ...parsed.data }
  if ('end_date' in patch) patch.end_date = patch.end_date || null
  if ('description' in patch) patch.description = emptyToNull(patch.description)
  if ('location' in patch) patch.location = emptyToNull(patch.location)
  if ('provider' in patch) patch.provider = emptyToNull(patch.provider)

  const { data, error } = await supabase
    .from('personal_timeline_events')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(TIMELINE_SELECT)
    .single()

  if (error) return json({ error: 'TIMELINE_UPDATE_FAILED' }, 500)
  return json({ data }, 200)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  const { error } = await supabase
    .from('personal_timeline_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return json({ error: 'TIMELINE_DELETE_FAILED' }, 500)
  return json({ data: { ok: true } }, 200)
}
