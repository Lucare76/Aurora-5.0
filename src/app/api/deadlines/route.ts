import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePrivateHrAccess } from '@/lib/access/private-finance-access'
import { deadlineInputSchema } from '@/lib/deadlines/schemas'

export const dynamic = 'force-dynamic'

const DEADLINE_SELECT = 'id,user_id,title,description,category,due_date,status,priority,recurrence,reminder_days_before,completed_at,created_at,updated_at'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const category = url.searchParams.get('category')
  let query = supabase
    .from('personal_deadlines')
    .select(DEADLINE_SELECT)
    .eq('user_id', user.id)

  if (status === 'ACTIVE' || status === 'COMPLETED' || status === 'CANCELLED') query = query.eq('status', status)
  if (category) query = query.eq('category', category)

  const { data, error } = await query.order('due_date', { ascending: true }).order('created_at', { ascending: true })
  if (error) return json({ error: 'DEADLINES_UNAVAILABLE' }, 500)
  return json({ data: data ?? [] }, 200)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }
  const parsed = deadlineInputSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_DEADLINE', details: parsed.error.flatten() }, 400)

  const { data, error } = await supabase
    .from('personal_deadlines')
    .insert({
      user_id: user.id,
      ...parsed.data,
      description: parsed.data.description || null,
      status: parsed.data.status ?? 'ACTIVE',
      completed_at: parsed.data.status === 'COMPLETED' ? new Date().toISOString() : null,
    })
    .select(DEADLINE_SELECT)
    .single()
  if (error) return json({ error: 'DEADLINE_SAVE_FAILED' }, 500)
  return json({ data }, 201)
}

