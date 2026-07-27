import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScenario, saveScenarioResult } from '@/lib/scenarios/persistence'
import { runScenarioEngine } from '@/lib/scenarios/engine'
import type { ScenarioEngineInput } from '@/lib/scenarios/types'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await params

  const scenario = await getScenario(supabase, user.id, id)
  if (!scenario) return json({ error: 'NOT_FOUND' }, 404)

  // Load all financial data in parallel
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
    now: new Date(),
    timezone: 'Europe/Rome',
    userCurrency: 'EUR',
    baselineFinancialHealthScore: (fhSnapshotRes.data?.[0] as { score?: number } | undefined)?.score ?? null,
  }

  try {
    const result = runScenarioEngine(input)

    // Persist the result summary (non-fatal if DB write fails)
    try {
      await saveScenarioResult(
        supabase,
        user.id,
        id,
        result.resultSummary,
        result.scenario.baseline_as_of ?? new Date().toISOString().slice(0, 10),
      )
    } catch (saveErr) {
      console.warn('[aurora-scenarios] result-save-skipped', {
        id: id.slice(0, 8),
        error: saveErr instanceof Error ? saveErr.message : String(saveErr),
      })
    }

    return json({ data: result }, 200)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Scenario validation failed')) {
      return json({ error: 'VALIDATION_ERROR', message: err.message }, 400)
    }
    console.error('[aurora-scenarios] calculate', err)
    return json({ error: 'CALCULATION_FAILED' }, 500)
  }
}
