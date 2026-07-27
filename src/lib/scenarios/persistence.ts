import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinancialScenario, ScenarioResultSummary, ScenarioStatus } from './types'
import { SCENARIO_ENGINE_VERSION, SCENARIO_SCHEMA_VERSION, SCENARIO_ACTION_REGISTRY_VERSION } from './constants'

type ScenarioRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ScenarioStatus
  horizon_months: number
  start_date: string
  end_date: string
  currency: string | null
  actions: unknown
  assumptions: unknown
  engine_version: string
  schema_version: number
  action_registry_version: string
  baseline_as_of: string | null
  last_calculated_at: string | null
  result_summary: unknown
  is_favorite: boolean
  created_at: string
  updated_at: string
}

function rowToScenario(row: ScenarioRow): FinancialScenario {
  return {
    ...row,
    actions: (row.actions as FinancialScenario['actions']) ?? [],
    assumptions: row.assumptions as FinancialScenario['assumptions'],
    result_summary: row.result_summary as ScenarioResultSummary | null,
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listScenarios(
  db: SupabaseClient,
  userId: string,
  status?: ScenarioStatus,
): Promise<FinancialScenario[]> {
  let q = (db as unknown as SupabaseClient)
    .from('financial_scenarios')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) throw error
  return (data as ScenarioRow[]).map(rowToScenario)
}

// ── Get one ───────────────────────────────────────────────────────────────────

export async function getScenario(
  db: SupabaseClient,
  userId: string,
  id: string,
): Promise<FinancialScenario | null> {
  const { data, error } = await (db as unknown as SupabaseClient)
    .from('financial_scenarios')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToScenario(data as ScenarioRow)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createScenario(
  db: SupabaseClient,
  userId: string,
  input: Pick<FinancialScenario, 'name' | 'description' | 'horizon_months' | 'start_date' | 'end_date' | 'actions' | 'assumptions'>,
): Promise<FinancialScenario> {
  const { data, error } = await (db as unknown as SupabaseClient)
    .from('financial_scenarios')
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description ?? null,
      status: 'draft' as ScenarioStatus,
      horizon_months: input.horizon_months,
      start_date: input.start_date,
      end_date: input.end_date,
      actions: input.actions,
      assumptions: input.assumptions,
      engine_version: SCENARIO_ENGINE_VERSION,
      schema_version: SCENARIO_SCHEMA_VERSION,
      action_registry_version: SCENARIO_ACTION_REGISTRY_VERSION,
      is_favorite: false,
      baseline_as_of: null,
      last_calculated_at: null,
      result_summary: null,
    })
    .select()
    .single()

  if (error) throw error
  return rowToScenario(data as ScenarioRow)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateScenario(
  db: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<Pick<FinancialScenario, 'name' | 'description' | 'horizon_months' | 'start_date' | 'end_date' | 'actions' | 'assumptions' | 'status' | 'is_favorite'>>,
): Promise<FinancialScenario> {
  const { data, error } = await (db as unknown as SupabaseClient)
    .from('financial_scenarios')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return rowToScenario(data as ScenarioRow)
}

// ── Save calculation result ───────────────────────────────────────────────────

export async function saveScenarioResult(
  db: SupabaseClient,
  userId: string,
  id: string,
  resultSummary: ScenarioResultSummary,
  baselineAsOf: string,
): Promise<void> {
  const { error } = await (db as unknown as SupabaseClient)
    .from('financial_scenarios')
    .update({
      result_summary: resultSummary,
      status: 'ready' as ScenarioStatus,
      baseline_as_of: baselineAsOf,
      last_calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteScenario(
  db: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await (db as unknown as SupabaseClient)
    .from('financial_scenarios')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

// ── Duplicate ─────────────────────────────────────────────────────────────────

export async function duplicateScenario(
  db: SupabaseClient,
  userId: string,
  sourceId: string,
): Promise<FinancialScenario> {
  const source = await getScenario(db, userId, sourceId)
  if (!source) throw new Error('Scenario not found')

  return createScenario(db, userId, {
    name: `${source.name} (copia)`,
    description: source.description,
    horizon_months: source.horizon_months,
    start_date: source.start_date,
    end_date: source.end_date,
    actions: source.actions,
    assumptions: source.assumptions,
  })
}
