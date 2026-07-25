import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { deleteContribution, getGoalDetail, replaceContribution } from '@/lib/goals/service'

export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const contributionSchema = z.object({
  amount: z.number().positive(),
  date: z.string().date(),
  note: z.string().trim().max(500).nullable().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'INVALID_ID' }, 400)

  const { data: contribution } = await supabase
    .from('goal_contributions')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!contribution) return json({ error: 'GOAL_NOT_FOUND' }, 404)

  try {
    await deleteContribution(supabase, id)
    return json({ data: { id } }, 200)
  } catch (err) {
    console.error('[aurora-goals] contribution delete', { code: (err as { code?: string })?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'INVALID_ID' }, 400)

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'INVALID_AMOUNT' }, 400) }

  const parsed = contributionSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_AMOUNT' }, 400)

  const { data: contribution } = await supabase
    .from('goal_contributions')
    .select('id,goal_id')
    .eq('id', id)
    .maybeSingle()

  if (!contribution) return json({ error: 'GOAL_NOT_FOUND' }, 404)

  const goalId = (contribution as { goal_id: string }).goal_id
  const detail = await getGoalDetail(supabase, goalId)
  if (!detail) return json({ error: 'GOAL_NOT_FOUND' }, 404)
  if (detail.goal.status === 'ARCHIVED' || detail.goal.archived) return json({ error: 'INVALID_STATUS' }, 400)

  try {
    const data = await replaceContribution(supabase, {
      contributionId: id,
      goalId,
      userId: user.id,
      amount: parsed.data.amount,
      date: parsed.data.date,
      note: parsed.data.note ?? null,
    })
    return json({ data }, 200)
  } catch (err) {
    const pg = err as { code?: string; message?: string }
    if (pg?.code === '23514') return json({ error: 'INVALID_AMOUNT' }, 400)
    console.error('[aurora-goals] contribution update', { code: pg?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
