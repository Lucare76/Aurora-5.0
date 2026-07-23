import { describe, expect, it, vi } from 'vitest'
import { buildGoalSummary, getGoalDetail, listGoals } from '@/lib/goals/service'
import type { SavingsGoal } from '@/types/database'

const baseGoal: SavingsGoal = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '99999999-9999-4999-8999-999999999999',
  name: 'Fondo emergenza',
  target_amount: 1000,
  current_amount: 250,
  target_date: '2026-12-31',
  icon: '🛡️',
  color: '#6366f1',
  notes: null,
  status: 'ACTIVE',
  archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function makeBuilder(data: unknown = null, error: unknown = null, count?: number) {
  const b: Record<string, any> = {}
  for (const method of ['select', 'eq', 'neq', 'order', 'limit']) b[method] = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  b.then = (resolve: (value: unknown) => void) => resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error, count })
  return b
}

describe('goals service', () => {
  it('builds a dashboard summary from visible goals only', () => {
    const summary = buildGoalSummary([
      baseGoal,
      { ...baseGoal, id: '22222222-2222-4222-8222-222222222222', name: 'Viaggio', target_amount: 500, current_amount: 500, status: 'COMPLETED' },
      { ...baseGoal, id: '33333333-3333-4333-8333-333333333333', name: 'Archivio', archived: true, status: 'ARCHIVED' },
    ])

    expect(summary.totalGoals).toBe(2)
    expect(summary.activeGoals).toBe(1)
    expect(summary.completedGoals).toBe(1)
    expect(summary.targetAmount).toBe(1500)
    expect(summary.savedAmount).toBe(750)
    expect(summary.remainingAmount).toBe(750)
    expect(summary.completionPercentage).toBe(50)
    expect(summary.nearestGoal?.name).toBe('Fondo emergenza')
  })

  it('keeps percentage above 100 when a goal is overfunded', () => {
    const summary = buildGoalSummary([{ ...baseGoal, target_amount: 100, current_amount: 125 }])
    expect(summary.savedAmount).toBe(125)
    expect(summary.remainingAmount).toBe(0)
    expect(summary.completionPercentage).toBe(125)
  })

  it('lists goals sorted by status and target date', async () => {
    const rows = [
      { ...baseGoal, id: '22222222-2222-4222-8222-222222222222', name: 'Completato', status: 'COMPLETED' as const },
      { ...baseGoal, id: '11111111-1111-4111-8111-111111111111', name: 'Attivo vicino', target_date: '2026-08-01' },
    ]
    const supabase = { from: vi.fn(() => makeBuilder(rows)) } as never
    const goals = await listGoals(supabase)
    expect(goals.map((goal) => goal.name)).toEqual(['Attivo vicino', 'Completato'])
    expect(goals[0].remainingAmount).toBe(750)
    expect(goals[0].completionPercentage).toBe(25)
  })

  it('returns goal detail with at most the rows provided by the query', async () => {
    const contributions = [
      { id: '44444444-4444-4444-8444-444444444444', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 25, date: '2026-07-20', note: 'Extra', created_at: '2026-07-20T00:00:00Z' },
    ]
    const supabase = {
      from: vi.fn((table: string) => table === 'savings_goals' ? makeBuilder(baseGoal) : makeBuilder(contributions, null, 1)),
    } as never

    const detail = await getGoalDetail(supabase, baseGoal.id)
    expect(detail?.goal.name).toBe('Fondo emergenza')
    expect(detail?.contributionCount).toBe(1)
    expect(detail?.contributions[0].amount).toBe(25)
  })
})
