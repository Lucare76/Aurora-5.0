import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  buildBudgetAlerts,
  buildBudgetInsights,
  createMonthlyBudget,
  listMonthlyBudgets,
  listMonthlyBudgetsEnriched,
} from '@/lib/budgets/service'

export const dynamic = 'force-dynamic'

const periodSchema = z.object({
  year:  z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

const createSchema = z.object({
  categoryId: z.string().uuid(),
  year:       z.number().int().min(2000).max(2100),
  month:      z.number().int().min(1).max(12),
  amount:     z.number().positive(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { searchParams } = new URL(request.url)
  const now    = new Date()
  const parsed = periodSchema.safeParse({
    year:  searchParams.get('year')  ?? now.getFullYear(),
    month: searchParams.get('month') ?? now.getMonth() + 1,
  })
  if (!parsed.success) return json({ error: 'INVALID_PERIOD' }, 400)

  const enriched = searchParams.get('enriched') === '1'

  try {
    if (enriched) {
      const entries = await listMonthlyBudgetsEnriched(supabase, parsed.data.year, parsed.data.month, now)
      const forecasts = new Map(entries.map((e) => [e.categoryId, e.forecast]))
      const alerts    = buildBudgetAlerts(entries, forecasts)
      const insights  = buildBudgetInsights(entries, 5)
      return json({ data: entries, alerts, insights }, 200)
    }

    const data = await listMonthlyBudgets(supabase, parsed.data.year, parsed.data.month)
    return json({ data }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try   { body = await request.json() }
  catch { return json({ error: 'INVALID_AMOUNT' }, 400) }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const hasAmount = parsed.error.issues.some((i) => i.path.includes('amount'))
    return json({ error: hasAmount ? 'INVALID_AMOUNT' : 'INVALID_PERIOD' }, 400)
  }

  const { categoryId, year, month, amount } = parsed.data

  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle()

  if (!cat) return json({ error: 'CATEGORY_NOT_FOUND' }, 404)

  try {
    const result = await createMonthlyBudget(supabase, { categoryId, year, month, amount })
    return json({ data: result }, 201)
  } catch (err: unknown) {
    const pg = err as { code?: string }
    if (pg?.code === '23505') return json({ error: 'BUDGET_ALREADY_EXISTS' }, 409)
    if (pg?.code === '23514') return json({ error: 'INVALID_AMOUNT' }, 400)
    console.error('[aurora-budgets] create', { code: pg?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
