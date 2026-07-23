import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { archiveGoal, deleteGoal, getGoalDetail, updateGoal } from '@/lib/goals/service'

export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  targetAmount: z.number().positive().optional(),
  targetDate: z.string().date().nullable().optional(),
  icon: z.string().trim().max(12).nullable().optional(),
  color: z.string().trim().max(32).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  archived: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'INVALID_ID' }, 400)

  try {
    const data = await getGoalDetail(supabase, id)
    if (!data) return json({ error: 'GOAL_NOT_FOUND' }, 404)
    return json({ data }, 200)
  } catch (err) {
    console.error('[aurora-goals] detail', { code: (err as { code?: string })?.code })
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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    const hasAmount = parsed.error.issues.some((issue) => issue.path.includes('targetAmount'))
    const hasStatus = parsed.error.issues.some((issue) => issue.path.includes('status'))
    return json({ error: hasStatus ? 'INVALID_STATUS' : hasAmount ? 'INVALID_AMOUNT' : 'INVALID_GOAL' }, 400)
  }

  const existing = await getGoalDetail(supabase, id)
  if (!existing) return json({ error: 'GOAL_NOT_FOUND' }, 404)

  try {
    await updateGoal(supabase, id, parsed.data)
    return json({ data: { id } }, 200)
  } catch (err) {
    const pg = err as { code?: string }
    if (pg?.code === '23514') return json({ error: 'INVALID_AMOUNT' }, 400)
    console.error('[aurora-goals] update', { code: pg?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'INVALID_ID' }, 400)

  const existing = await getGoalDetail(supabase, id)
  if (!existing) return json({ error: 'GOAL_NOT_FOUND' }, 404)

  try {
    const url = new URL(request.url)
    if (url.searchParams.get('archive') === '1') {
      await archiveGoal(supabase, id)
    } else {
      await deleteGoal(supabase, id)
    }
    return json({ data: { id } }, 200)
  } catch (err) {
    console.error('[aurora-goals] delete', { code: (err as { code?: string })?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
