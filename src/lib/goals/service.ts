import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoalContribution, SavingsGoal, SavingsGoalStatus } from '@/types/database'

export type GoalProgress = SavingsGoal & {
  remainingAmount: number
  completionPercentage: number
}

export type GoalSummary = {
  totalGoals: number
  activeGoals: number
  completedGoals: number
  targetAmount: number
  savedAmount: number
  remainingAmount: number
  completionPercentage: number
  nearestGoal: GoalProgress | null
}

export type GoalDetail = {
  goal: GoalProgress
  contributions: GoalContribution[]
  contributionCount: number
}

export type CreateGoalInput = {
  userId: string
  name: string
  targetAmount: number
  targetDate?: string | null
  icon?: string | null
  color?: string | null
  notes?: string | null
}

export type UpdateGoalInput = Partial<Omit<CreateGoalInput, 'userId'>> & {
  status?: SavingsGoalStatus
  archived?: boolean
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function normalizeGoal(row: SavingsGoal): GoalProgress {
  const target = Number(row.target_amount)
  const current = Number(row.current_amount)
  return {
    ...row,
    target_amount: round2(target),
    current_amount: round2(current),
    remainingAmount: round2(Math.max(target - current, 0)),
    completionPercentage: target > 0 ? Math.round((current / target) * 100) : 0,
  }
}

function sortGoals(a: GoalProgress, b: GoalProgress): number {
  const order: Record<SavingsGoalStatus, number> = { ACTIVE: 0, COMPLETED: 1, ARCHIVED: 2 }
  const statusDiff = order[a.status] - order[b.status]
  if (statusDiff !== 0) return statusDiff
  if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date)
  if (a.target_date) return -1
  if (b.target_date) return 1
  return a.created_at.localeCompare(b.created_at)
}

export function buildGoalSummary(goals: SavingsGoal[]): GoalSummary {
  const normalized = goals.map(normalizeGoal)
  const visible = normalized.filter((goal) => !goal.archived && goal.status !== 'ARCHIVED')
  const active = visible.filter((goal) => goal.status === 'ACTIVE')
  const completed = visible.filter((goal) => goal.status === 'COMPLETED')
  const targetAmount = round2(visible.reduce((sum, goal) => sum + goal.target_amount, 0))
  const savedAmount = round2(visible.reduce((sum, goal) => sum + goal.current_amount, 0))
  const remainingAmount = round2(Math.max(targetAmount - savedAmount, 0))
  const nearestGoal = [...active]
    .filter((goal) => goal.target_date)
    .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))[0] ?? null

  return {
    totalGoals: visible.length,
    activeGoals: active.length,
    completedGoals: completed.length,
    targetAmount,
    savedAmount,
    remainingAmount,
    completionPercentage: targetAmount > 0 ? Math.round((savedAmount / targetAmount) * 100) : 0,
    nearestGoal,
  }
}

export async function listGoals(supabase: SupabaseClient): Promise<GoalProgress[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at')
    .order('created_at', { ascending: true })

  if (error) throw error
  return ((data ?? []) as SavingsGoal[]).map(normalizeGoal).sort(sortGoals)
}

export async function createGoal(supabase: SupabaseClient, input: CreateGoalInput): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: input.userId,
      name: input.name,
      target_amount: input.targetAmount,
      target_date: input.targetDate ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return { id: data.id }
}

export async function updateGoal(supabase: SupabaseClient, goalId: string, input: UpdateGoalInput): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.targetAmount !== undefined) patch.target_amount = input.targetAmount
  if (input.targetDate !== undefined) patch.target_date = input.targetDate
  if (input.icon !== undefined) patch.icon = input.icon
  if (input.color !== undefined) patch.color = input.color
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.status !== undefined) patch.status = input.status
  if (input.archived !== undefined) patch.archived = input.archived

  const { error } = await supabase
    .from('savings_goals')
    .update(patch)
    .eq('id', goalId)

  if (error) throw error
}

export async function archiveGoal(supabase: SupabaseClient, goalId: string): Promise<void> {
  await updateGoal(supabase, goalId, { archived: true, status: 'ARCHIVED' })
}

export async function deleteGoal(supabase: SupabaseClient, goalId: string): Promise<void> {
  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('id', goalId)

  if (error) throw error
}

export async function addContribution(
  supabase: SupabaseClient,
  input: { goalId: string; userId: string; amount: number; date: string; note?: string | null },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('goal_contributions')
    .insert({
      goal_id: input.goalId,
      user_id: input.userId,
      amount: input.amount,
      date: input.date,
      note: input.note ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return { id: data.id }
}

export async function deleteContribution(supabase: SupabaseClient, contributionId: string): Promise<void> {
  const { error } = await supabase
    .from('goal_contributions')
    .delete()
    .eq('id', contributionId)

  if (error) throw error
}

export async function getGoalDetail(supabase: SupabaseClient, goalId: string): Promise<GoalDetail | null> {
  const [{ data: goal, error: goalError }, { data: contributions, error: contributionError, count }] = await Promise.all([
    supabase
      .from('savings_goals')
      .select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at')
      .eq('id', goalId)
      .maybeSingle(),
    supabase
      .from('goal_contributions')
      .select('id,goal_id,user_id,amount,date,note,created_at', { count: 'exact' })
      .eq('goal_id', goalId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (goalError) throw goalError
  if (contributionError) throw contributionError
  if (!goal) return null

  return {
    goal: normalizeGoal(goal as SavingsGoal),
    contributions: ((contributions ?? []) as GoalContribution[]).map((row) => ({
      ...row,
      amount: round2(Number(row.amount)),
    })),
    contributionCount: count ?? (contributions?.length ?? 0),
  }
}

export async function getGoalsSummary(supabase: SupabaseClient): Promise<GoalSummary> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at')
    .neq('status', 'ARCHIVED')

  if (error) throw error
  return buildGoalSummary((data ?? []) as SavingsGoal[])
}
