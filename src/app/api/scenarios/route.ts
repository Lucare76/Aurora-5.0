import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createScenarioSchema, scenarioListQuerySchema } from '@/lib/scenarios/schemas'
import { listScenarios, createScenario } from '@/lib/scenarios/persistence'
import { DEFAULT_ASSUMPTIONS } from '@/lib/scenarios/assumptions'
import { DEFAULT_HORIZON_MONTHS } from '@/lib/scenarios/constants'

function computeEndDate(startDate: string, horizonMonths: number): string {
  const d = new Date(startDate + 'T00:00:00')
  d.setMonth(d.getMonth() + horizonMonths, 1)
  return d.toLocaleDateString('en-CA')
}

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = scenarioListQuerySchema.safeParse(params)
  if (!parsed.success) return json({ error: 'INVALID_QUERY' }, 400)

  try {
    const scenarios = await listScenarios(supabase, user.id, parsed.data.status as never)
    const filtered = parsed.data.is_favorite !== undefined
      ? scenarios.filter((s) => s.is_favorite === parsed.data.is_favorite)
      : scenarios
    const page = parsed.data.page
    const limit = parsed.data.limit
    const start = (page - 1) * limit
    return json({ data: filtered.slice(start, start + limit), total: filtered.length, page, limit }, 200)
  } catch (err) {
    console.error('[aurora-scenarios] list', err)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'INVALID_BODY' }, 400) }

  const parsed = createScenarioSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'VALIDATION_ERROR', details: parsed.error.issues }, 400)

  const now = new Date()
  const startDate = parsed.data.start_date
  const horizonMonths = parsed.data.horizon_months ?? DEFAULT_HORIZON_MONTHS
  const endDate = computeEndDate(startDate, horizonMonths)

  try {
    const scenario = await createScenario(supabase, user.id, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      horizon_months: horizonMonths,
      start_date: startDate,
      end_date: endDate,
      actions: (parsed.data.actions ?? []) as never,
      assumptions: (parsed.data.assumptions ?? DEFAULT_ASSUMPTIONS) as never,
    })
    return json({ data: scenario }, 201)
  } catch (err) {
    console.error('[aurora-scenarios] create', err)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
