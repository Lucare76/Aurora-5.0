import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { deleteMonthlyBudget, updateMonthlyBudget } from '@/lib/budgets/service'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  amount: z.number().positive(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params

  // Check exists — RLS ensures only own budgets are visible
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!budget) return json({ error: 'BUDGET_NOT_FOUND' }, 404)

  let body: unknown
  try   { body = await request.json() }
  catch { return json({ error: 'INVALID_AMOUNT' }, 400) }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_AMOUNT' }, 400)

  try {
    await updateMonthlyBudget(supabase, id, { amount: parsed.data.amount })
    return json({ data: { id } }, 200)
  } catch (err: unknown) {
    const pg = err as { code?: string }
    if (pg?.code === '23514') return json({ error: 'INVALID_AMOUNT' }, 400)
    console.error('[aurora-budgets] update', { code: pg?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!budget) return json({ error: 'BUDGET_NOT_FOUND' }, 404)

  try {
    await deleteMonthlyBudget(supabase, id)
    return json({ data: { id } }, 200)
  } catch (err: unknown) {
    console.error('[aurora-budgets] delete', { code: (err as { code?: string })?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
