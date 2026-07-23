import { describe, expect, it, vi } from 'vitest'
import {
  buildGoalForecast,
  buildGoalHistory,
  buildGoalInsights,
  buildGoalPace,
  buildGoalSummary,
  calculateRequiredMonthlyContribution,
  determineGoalPaceStatus,
  getGoalDetail,
  listGoals,
} from '@/lib/goals/service'
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
  for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit']) b[method] = vi.fn(() => b)
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

  it('does not forecast with no contributions or one recent contribution', () => {
    const now = new Date('2026-07-23T12:00:00Z')
    expect(buildGoalForecast(baseGoal, [], now).forecastStatus).toBe('ZERO_PACE')
    const one = [{ id: 'c1', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 100, date: '2026-07-22', note: null, created_at: '2026-07-22T00:00:00Z' }]
    expect(buildGoalForecast(baseGoal, one, now).forecastStatus).toBe('INSUFFICIENT_DATA')
  })

  it('forecasts estimated completion date with enough distributed data', () => {
    const now = new Date('2026-07-23T12:00:00Z')
    const rows = [
      { id: 'c1', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 100, date: '2026-06-01', note: null, created_at: '2026-06-01T00:00:00Z' },
      { id: 'c2', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 150, date: '2026-07-01', note: null, created_at: '2026-07-01T00:00:00Z' },
    ]
    const forecast = buildGoalForecast(baseGoal, rows, now)
    expect(forecast.hasEnoughData).toBe(true)
    expect(forecast.averageMonthlyContribution).toBeGreaterThan(0)
    expect(forecast.estimatedCompletionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('calculates deadline monthly contribution using equivalent days', () => {
    const required = calculateRequiredMonthlyContribution(1200, '2026-10-23', new Date('2026-07-23T00:00:00Z'))
    expect(required).toBeGreaterThan(390)
    expect(required).toBeLessThan(410)
  })

  it('determines intelligent pace statuses', () => {
    expect(determineGoalPaceStatus({ completionPercentage: 100, targetDate: '2026-12-31', expectedProgressPercentage: 50, paceDifferencePercentage: 50, hasEnoughData: true, isCompleted: true, isOverdue: false })).toBe('COMPLETED')
    expect(determineGoalPaceStatus({ completionPercentage: 20, targetDate: '2026-01-01', expectedProgressPercentage: 100, paceDifferencePercentage: -80, hasEnoughData: true, isCompleted: false, isOverdue: true })).toBe('OVERDUE')
    expect(determineGoalPaceStatus({ completionPercentage: 70, targetDate: '2026-12-31', expectedProgressPercentage: 55, paceDifferencePercentage: 15, hasEnoughData: true, isCompleted: false, isOverdue: false })).toBe('AHEAD')
    expect(determineGoalPaceStatus({ completionPercentage: 50, targetDate: '2026-12-31', expectedProgressPercentage: 53, paceDifferencePercentage: -3, hasEnoughData: true, isCompleted: false, isOverdue: false })).toBe('ON_TRACK')
    expect(determineGoalPaceStatus({ completionPercentage: 40, targetDate: '2026-12-31', expectedProgressPercentage: 50, paceDifferencePercentage: -10, hasEnoughData: true, isCompleted: false, isOverdue: false })).toBe('SLIGHTLY_BEHIND')
    expect(determineGoalPaceStatus({ completionPercentage: 20, targetDate: '2026-12-31', expectedProgressPercentage: 50, paceDifferencePercentage: -30, hasEnoughData: true, isCompleted: false, isOverdue: false })).toBe('BEHIND')
  })

  it('builds 12-month history with empty months and cumulative values', () => {
    const rows = [
      { id: 'c1', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 100, date: '2026-05-10', note: null, created_at: '2026-05-10T00:00:00Z' },
      { id: 'c2', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 150, date: '2026-07-10', note: null, created_at: '2026-07-10T00:00:00Z' },
    ]
    const history = buildGoalHistory(baseGoal, rows, new Date('2026-07-23T00:00:00Z'))
    expect(history).toHaveLength(12)
    expect(history[history.length - 1].contributedAmount).toBe(150)
    expect(history[history.length - 1].cumulativeAmount).toBe(250)
    expect(history.some((point) => point.contributedAmount === 0)).toBe(true)
  })

  it('builds pace trend and deterministic insights without duplicates', () => {
    const rows = [
      { id: 'c1', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 50, date: '2026-01-10', note: null, created_at: '2026-01-10T00:00:00Z' },
      { id: 'c2', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 50, date: '2026-02-10', note: null, created_at: '2026-02-10T00:00:00Z' },
      { id: 'c3', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 100, date: '2026-05-10', note: null, created_at: '2026-05-10T00:00:00Z' },
      { id: 'c4', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 120, date: '2026-06-10', note: null, created_at: '2026-06-10T00:00:00Z' },
      { id: 'c5', goal_id: baseGoal.id, user_id: baseGoal.user_id, amount: 140, date: '2026-07-10', note: null, created_at: '2026-07-10T00:00:00Z' },
    ]
    const pace = buildGoalPace(baseGoal, rows, new Date('2026-07-23T00:00:00Z'))
    const insights = buildGoalInsights(baseGoal, rows, new Date('2026-07-23T00:00:00Z'))
    expect(pace.paceTrendPercentage).toBeGreaterThan(0)
    expect(insights.length).toBeLessThanOrEqual(3)
    expect(new Set(insights.map((i) => i.type)).size).toBe(insights.length)
  })

  it('lists goals sorted by status and target date', async () => {
    const rows = [
      { ...baseGoal, id: '22222222-2222-4222-8222-222222222222', name: 'Completato', status: 'COMPLETED' as const },
      { ...baseGoal, id: '11111111-1111-4111-8111-111111111111', name: 'Attivo vicino', target_date: '2026-08-01' },
    ]
    const supabase = { from: vi.fn((table: string) => table === 'savings_goals' ? makeBuilder(rows) : makeBuilder([])) } as never
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
    expect(detail?.forecast).toBeDefined()
    expect(detail?.pace).toBeDefined()
    expect(detail?.history).toHaveLength(12)
  })
})
