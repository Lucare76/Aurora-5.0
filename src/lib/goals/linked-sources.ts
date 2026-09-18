import type { SupabaseClient } from '@supabase/supabase-js'

export type GoalSourceProvider = 'SCALABLE' | 'MANUAL'
export type GoalSourceType = 'POSITION' | 'CASH' | 'PORTFOLIO'

export type GoalSourceSnapshot = {
  id: string
  source_id: string
  user_id: string
  value: number
  quantity: number | null
  unit_price: number | null
  monthly_plan_amount: number | null
  next_plan_date: string | null
  observed_at: string
  metadata: Record<string, unknown>
  created_at: string
}

export type GoalLinkedSource = {
  id: string
  user_id: string
  goal_id: string
  provider: GoalSourceProvider
  source_type: GoalSourceType
  external_key: string
  display_name: string
  currency: string
  include_in_goal: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  latestSnapshot: GoalSourceSnapshot | null
}

export type GoalLinkedAggregate = {
  totalValue: number
  monthlyPlanAmount: number
  sources: GoalLinkedSource[]
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function buildGoalLinkedAggregate(
  sources: Omit<GoalLinkedSource, 'latestSnapshot'>[],
  snapshots: GoalSourceSnapshot[],
): Map<string, GoalLinkedAggregate> {
  const latestBySource = new Map<string, GoalSourceSnapshot>()
  const ordered = [...snapshots].sort((a, b) =>
    b.observed_at.localeCompare(a.observed_at) || b.created_at.localeCompare(a.created_at),
  )
  for (const snapshot of ordered) {
    if (!latestBySource.has(snapshot.source_id)) latestBySource.set(snapshot.source_id, snapshot)
  }

  const result = new Map<string, GoalLinkedAggregate>()
  for (const source of sources) {
    const latestSnapshot = latestBySource.get(source.id) ?? null
    const current = result.get(source.goal_id) ?? { totalValue: 0, monthlyPlanAmount: 0, sources: [] }
    const include = source.include_in_goal && latestSnapshot
    if (include) {
      current.totalValue = round2(current.totalValue + Number(latestSnapshot.value))
      current.monthlyPlanAmount = round2(current.monthlyPlanAmount + Number(latestSnapshot.monthly_plan_amount ?? 0))
    }
    current.sources.push({ ...source, latestSnapshot })
    result.set(source.goal_id, current)
  }
  return result
}

export async function loadGoalLinkedAggregates(
  supabase: SupabaseClient,
  goalIds: string[],
): Promise<Map<string, GoalLinkedAggregate>> {
  if (goalIds.length === 0) return new Map()

  const { data: sourceRows, error: sourceError } = await supabase
    .from('goal_linked_sources')
    .select('id,user_id,goal_id,provider,source_type,external_key,display_name,currency,include_in_goal,metadata,created_at,updated_at')
    .in('goal_id', goalIds)
    .order('created_at', { ascending: true })

  if (sourceError) throw sourceError
  const sources = (sourceRows ?? []) as Omit<GoalLinkedSource, 'latestSnapshot'>[]
  if (sources.length === 0) return new Map()

  const { data: snapshotRows, error: snapshotError } = await supabase
    .from('goal_source_snapshots')
    .select('id,source_id,user_id,value,quantity,unit_price,monthly_plan_amount,next_plan_date,observed_at,metadata,created_at')
    .in('source_id', sources.map((source) => source.id))
    .order('observed_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (snapshotError) throw snapshotError
  return buildGoalLinkedAggregate(sources, (snapshotRows ?? []) as GoalSourceSnapshot[])
}
