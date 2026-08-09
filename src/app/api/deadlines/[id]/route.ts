import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePrivateHrAccess } from '@/lib/access/private-finance-access'
import { deadlinePatchSchema } from '@/lib/deadlines/schemas'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const DEADLINE_SELECT = 'id,user_id,title,description,category,due_date,status,priority,recurrence,reminder_days_before,completed_at,created_at,updated_at'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }
  const parsed = deadlinePatchSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_DEADLINE', details: parsed.error.flatten() }, 400)

  const patch = { ...parsed.data }
  if (patch.status === 'COMPLETED' && patch.completed_at === undefined) patch.completed_at = new Date().toISOString()
  if (patch.status === 'ACTIVE' && patch.completed_at === undefined) patch.completed_at = null
  if (patch.status === 'CANCELLED' && patch.completed_at === undefined) patch.completed_at = null
  if (patch.description === '') patch.description = null

  const { data, error } = await supabase
    .from('personal_deadlines')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(DEADLINE_SELECT)
    .single()
  if (error) return json({ error: 'DEADLINE_UPDATE_FAILED' }, 500)
  return json({ data }, 200)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  const { error } = await supabase
    .from('personal_deadlines')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return json({ error: 'DEADLINE_DELETE_FAILED' }, 500)
  return json({ data: { ok: true } }, 200)
}
