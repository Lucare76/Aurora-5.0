import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePrivateHrAccess } from '@/lib/access/private-finance-access'
import { leaveEntrySchema } from '@/lib/leave/schemas'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const year = url.searchParams.get('year')
  const month = url.searchParams.get('month')
  let query = supabase
    .from('leave_entries')
    .select('id,user_id,type,start_date,end_date,days,hours,start_time,end_time,note,created_at,updated_at')
    .eq('user_id', user.id)
  if (type === 'VACATION' || type === 'PERMIT_104') query = query.eq('type', type)
  if (year && /^\d{4}$/.test(year)) query = query.gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`)
  if (year && month && /^\d{1,2}$/.test(month)) {
    const mm = month.padStart(2, '0')
    query = query.gte('start_date', `${year}-${mm}-01`).lte('start_date', `${year}-${mm}-31`)
  }
  const { data, error } = await query.order('start_date', { ascending: false })
  if (error) return json({ error: 'LEAVE_ENTRIES_UNAVAILABLE' }, 500)
  return json({ data: data ?? [] }, 200)
}

export async function POST(request: Request) {
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
    .insert({ user_id: user.id, ...parsed.data })
    .select('id,user_id,type,start_date,end_date,days,hours,start_time,end_time,note,created_at,updated_at')
    .single()
  if (error) return json({ error: 'LEAVE_ENTRY_SAVE_FAILED' }, 500)
  return json({ data }, 201)
}
