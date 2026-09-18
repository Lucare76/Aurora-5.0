import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getGoalDetail } from '@/lib/goals/service'
import { loadGoalLinkedAggregates } from '@/lib/goals/linked-sources'

export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const snapshotSchema = z.object({
  provider: z.enum(['SCALABLE', 'MANUAL']).default('SCALABLE'),
  sourceType: z.enum(['POSITION', 'CASH', 'PORTFOLIO']).default('POSITION'),
  externalKey: z.string().trim().min(1).max(180),
  displayName: z.string().trim().min(1).max(180),
  currency: z.string().trim().min(3).max(8).default('EUR'),
  value: z.number().min(0),
  quantity: z.number().min(0).nullable().optional(),
  unitPrice: z.number().min(0).nullable().optional(),
  monthlyPlanAmount: z.number().min(0).nullable().optional(),
  nextPlanDate: z.string().date().nullable().optional(),
  observedAt: z.string().datetime({ offset: true }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'INVALID_ID' }, 400)

  const goal = await getGoalDetail(supabase, id)
  if (!goal) return json({ error: 'GOAL_NOT_FOUND' }, 404)

  try {
    const map = await loadGoalLinkedAggregates(supabase, [id])
    const aggregate = map.get(id) ?? { totalValue: 0, monthlyPlanAmount: 0, sources: [] }
    return json({ data: aggregate }, 200)
  } catch (err) {
    console.error('[aurora-goals] linked sources list', { code: (err as { code?: string })?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'INVALID_ID' }, 400)

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'INVALID_SNAPSHOT' }, 400) }

  const parsed = snapshotSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_SNAPSHOT' }, 400)

  const existing = await getGoalDetail(supabase, id)
  if (!existing) return json({ error: 'GOAL_NOT_FOUND' }, 404)
  if (existing.goal.status === 'ARCHIVED' || existing.goal.archived) return json({ error: 'INVALID_STATUS' }, 400)

  try {
    const { data, error } = await supabase.rpc('upsert_goal_linked_source_snapshot', {
      p_goal_id: id,
      p_provider: parsed.data.provider,
      p_source_type: parsed.data.sourceType,
      p_external_key: parsed.data.externalKey,
      p_display_name: parsed.data.displayName,
      p_currency: parsed.data.currency,
      p_value: parsed.data.value,
      p_quantity: parsed.data.quantity ?? null,
      p_unit_price: parsed.data.unitPrice ?? null,
      p_monthly_plan_amount: parsed.data.monthlyPlanAmount ?? null,
      p_next_plan_date: parsed.data.nextPlanDate ?? null,
      p_observed_at: parsed.data.observedAt ?? new Date().toISOString(),
      p_metadata: parsed.data.metadata ?? {},
    })
    if (error) throw error
    return json({ data }, 201)
  } catch (err) {
    const pg = err as { code?: string; message?: string }
    console.error('[aurora-goals] linked source snapshot create', { code: pg?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
