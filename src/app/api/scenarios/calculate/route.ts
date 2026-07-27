import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateScenarioSchema } from '@/lib/scenarios/schemas'
import { runScenarioEngine } from '@/lib/scenarios/engine'
import { DEFAULT_ASSUMPTIONS } from '@/lib/scenarios/assumptions'
import { SCENARIO_ENGINE_VERSION, SCENARIO_SCHEMA_VERSION, SCENARIO_ACTION_REGISTRY_VERSION } from '@/lib/scenarios/constants'
import type { FinancialScenario, ScenarioEngineInput } from '@/lib/scenarios/types'

function computeEndDate(startDate: string, horizonMonths: number): string {
  const d = new Date(startDate + 'T00:00:00')
  d.setMonth(d.getMonth() + horizonMonths, 1)
  return d.toLocaleDateString('en-CA')
}

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'INVALID_BODY' }, 400) }

  const parsed = calculateScenarioSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'VALIDATION_ERROR', details: parsed.error.issues }, 400)

  const now = new Date()
  const startDate = parsed.data.start_date
  const horizonMonths = parsed.data.horizon_months
  const endDate = computeEndDate(startDate, horizonMonths)

  // Build a transient scenario (never persisted)
  const scenario: FinancialScenario = {
    id: 'ephemeral',
    user_id: user.id,
    name: 'Calcolo istantaneo',
    description: null,
    status: 'draft',
    horizon_months: horizonMonths,
    start_date: startDate,
    end_date: endDate,
    currency: parsed.data.currency ?? null,
    actions: (parsed.data.actions ?? []) as FinancialScenario['actions'],
    assumptions: ((parsed.data.assumptions ?? DEFAULT_ASSUMPTIONS) as FinancialScenario['assumptions']),
    engine_version: SCENARIO_ENGINE_VERSION,
    schema_version: SCENARIO_SCHEMA_VERSION,
    action_registry_version: SCENARIO_ACTION_REGISTRY_VERSION,
    baseline_as_of: null,
    last_calculated_at: null,
    result_summary: null,
    is_favorite: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }

  const [
    accountsRes, recurringRes, goalsRes, contribRes,
    loansRes, loanPaymentsRes, categoriesRes, txRes, fhSnapshotRes,
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('recurring_rules').select('*').eq('user_id', user.id),
    supabase.from('savings_goals').select('*').eq('user_id', user.id),
    supabase.from('goal_contributions').select('*').eq('user_id', user.id),
    supabase.from('loans').select('*').eq('user_id', user.id),
    supabase.from('loan_payments').select('*').eq('user_id', user.id),
    supabase.from('categories').select('*').eq('user_id', user.id),
    supabase
      .from('transactions')
      .select('id,account_id,type,amount,description,date,transfer_peer_id,category_id')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(200),
    supabase
      .from('financial_health_snapshots')
      .select('score')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: false })
      .limit(1),
  ])

  const input: ScenarioEngineInput = {
    scenario,
    accounts: accountsRes.data ?? [],
    recurringRules: recurringRes.data ?? [],
    goals: goalsRes.data ?? [],
    goalContributions: contribRes.data ?? [],
    loans: loansRes.data ?? [],
    loanPayments: loanPaymentsRes.data ?? [],
    categories: categoriesRes.data ?? [],
    recentTransactions: (txRes.data ?? []) as ScenarioEngineInput['recentTransactions'],
    now,
    timezone: 'Europe/Rome',
    userCurrency: 'EUR',
    baselineFinancialHealthScore: (fhSnapshotRes.data?.[0] as { score?: number } | undefined)?.score ?? null,
  }

  try {
    const result = runScenarioEngine(input)
    return json({ data: result }, 200)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Scenario validation failed')) {
      return json({ error: 'VALIDATION_ERROR', message: err.message }, 400)
    }
    console.error('[aurora-scenarios] ephemeral-calculate', err)
    return json({ error: 'CALCULATION_FAILED' }, 500)
  }
}
