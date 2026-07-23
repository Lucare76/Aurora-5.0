import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createGoal, listGoals } from '@/lib/goals/service'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetAmount: z.number().positive(),
  targetDate: z.string().date().nullable().optional(),
  icon: z.string().trim().max(12).nullable().optional(),
  color: z.string().trim().max(32).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const data = await listGoals(supabase)
    return json({ data }, 200)
  } catch (err) {
    console.error('[aurora-goals] list', { code: (err as { code?: string })?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'INVALID_AMOUNT' }, 400) }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const hasAmount = parsed.error.issues.some((issue) => issue.path.includes('targetAmount'))
    return json({ error: hasAmount ? 'INVALID_AMOUNT' : 'INVALID_GOAL' }, 400)
  }

  try {
    const data = await createGoal(supabase, { ...parsed.data, userId: user.id })
    return json({ data }, 201)
  } catch (err) {
    const pg = err as { code?: string }
    if (pg?.code === '23514') return json({ error: 'INVALID_AMOUNT' }, 400)
    console.error('[aurora-goals] create', { code: pg?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
