import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePrivateHrAccess } from '@/lib/access/private-finance-access'
import { leaveEntrySchema } from '@/lib/leave/schemas'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

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
  const parsed = leaveEntrySchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_LEAVE_ENTRY', details: parsed.error.flatten() }, 400)

  const { data, error } = await supabase
    .from('leave_entries')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id,user_id,type,start_date,end_date,days,hours,start_time,end_time,note,created_at,updated_at')
    .single()
  if (error) return json({ error: 'LEAVE_ENTRY_UPDATE_FAILED' }, 500)
  return json({ data }, 200)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  const { error } = await supabase
    .from('leave_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return json({ error: 'LEAVE_ENTRY_DELETE_FAILED' }, 500)
  return json({ data: { ok: true } }, 200)
}
