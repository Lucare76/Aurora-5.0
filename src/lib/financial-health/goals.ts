import { calculateRequiredMonthlyContribution } from '@/lib/goals/service'
import { roundMoney, roundScore } from './helpers'
import type { ComponentScore, HealthGoal } from './types'

export type GoalHealthSummary = {
  activeGoals: number
  completedGoals: number
  behindGoals: number
  withoutDeadline: number
  totalTarget: number
  totalSaved: number
  aggregateProgress: number | null
  aggregateExpectedProgress: number | null
  requiredMonthlyContribution: number
}

function expectedProgress(goal: HealthGoal, today: string): number | null {
  if (!goal.target_date) return null
  const created = new Date(`${goal.created_at.slice(0, 10)}T00:00:00`)
  const target = new Date(`${goal.target_date}T00:00:00`)
  const now = new Date(`${today}T00:00:00`)
  const total = Math.max(1, target.getTime() - created.getTime())
  const elapsed = Math.min(Math.max(0, now.getTime() - created.getTime()), total)
  return Math.round((elapsed / total) * 100)
}

export function summarizeGoals(goals: HealthGoal[], today: string): GoalHealthSummary {
  const visible = goals.filter((goal) => !goal.archived && goal.status !== 'ARCHIVED')
  const active = visible.filter((goal) => goal.status === 'ACTIVE')
  const completed = visible.filter((goal) => goal.status === 'COMPLETED')
  const totalTarget = roundMoney(visible.reduce((sum, goal) => sum + Math.max(goal.target_amount, 0), 0))
  const totalSaved = roundMoney(visible.reduce((sum, goal) => sum + Math.max(goal.current_amount, 0), 0))
  let behindGoals = 0
  let expectedSum = 0
  let expectedCount = 0
  let requiredMonthlyContribution = 0

  for (const goal of active) {
    const currentProgress = goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0
    const expected = expectedProgress(goal, today)
    if (expected != null) {
      expectedSum += expected
      expectedCount += 1
      if (currentProgress < expected - 5) behindGoals += 1
    }
    requiredMonthlyContribution = roundMoney(requiredMonthlyContribution + (calculateRequiredMonthlyContribution(Math.max(goal.target_amount - goal.current_amount, 0), goal.target_date, new Date(`${today}T00:00:00`)) ?? 0))
  }

  return {
    activeGoals: active.length,
    completedGoals: completed.length,
    behindGoals,
    withoutDeadline: active.filter((goal) => !goal.target_date).length,
    totalTarget,
    totalSaved,
    aggregateProgress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : null,
    aggregateExpectedProgress: expectedCount > 0 ? Math.round(expectedSum / expectedCount) : null,
    requiredMonthlyContribution,
  }
}

export function calculateGoalsScore(summary: GoalHealthSummary, weight: number): ComponentScore {
  if (summary.activeGoals === 0 && summary.completedGoals === 0) {
    return {
      component: 'goals',
      score: null,
      weight,
      contribution: 0,
      availability: 'NOT_APPLICABLE',
      status: 'neutral',
      factors: [{ id: 'goals-none', component: 'goals', impact: 'NEUTRAL', severity: 'INFO', title: 'Obiettivi non presenti', description: 'La componente obiettivi non incide sul punteggio perché non ci sono obiettivi attivi.' }],
    }
  }
  const finalScore = roundScore(90 - summary.behindGoals * 18 + Math.min(summary.completedGoals * 5, 10))
  return {
    component: 'goals',
    score: finalScore,
    weight,
    contribution: roundMoney((finalScore / 100) * weight),
    availability: 'AVAILABLE',
    status: finalScore >= 75 ? 'good' : finalScore >= 50 ? 'watch' : 'risk',
    factors: summary.behindGoals > 0
      ? [{ id: 'goals-behind', component: 'goals', impact: 'NEGATIVE', severity: 'WARNING', title: 'Obiettivi sotto traiettoria', description: 'Alcuni obiettivi risultano sotto il ritmo atteso rispetto alla scadenza.', metricValue: summary.behindGoals, metricUnit: 'obiettivi' }]
      : [{ id: 'goals-progress', component: 'goals', impact: 'POSITIVE', severity: 'INFO', title: 'Obiettivi in linea', description: 'Gli obiettivi registrati non risultano in ritardo secondo la traiettoria attesa.', metricValue: summary.aggregateProgress, metricUnit: '%' }],
  }
}
