import type {
  ActionModifications,
  ProjectionPeriod,
  GoalContributionChangeParams,
  GoalDeadlineChangeParams,
  GoalOneTimeContributionParams,
} from '../types'
import type { SavingsGoal, GoalContribution } from '@/types/database'
import { dateInPeriod } from '../dates'
import { roundMoney, averageMoney } from '../money'
import { CONTRIBUTION_LOOKBACK_MONTHS } from '../constants'

// ── GOAL_CONTRIBUTION_CHANGE ──────────────────────────────────────────────────

export function applyGoalContributionChange(
  params: GoalContributionChangeParams,
  periods: ProjectionPeriod[],
  goals: SavingsGoal[],
  goalContributions: GoalContribution[],
): ActionModifications {
  const mods: ActionModifications = new Map()
  const goal = goals.find((g) => g.id === params.goalId)
  if (!goal) return mods

  // Compute current average monthly contribution from recent history
  const recent = goalContributions
    .filter((c) => c.goal_id === params.goalId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, CONTRIBUTION_LOOKBACK_MONTHS)

  const currentMonthly = recent.length > 0 ? averageMoney(recent.map((c) => c.amount)) : 0
  const delta = roundMoney(params.newMonthlyAmount - currentMonthly)

  for (const period of periods) {
    if (period.startDate < params.startDate) continue
    if (params.endDate && period.endDate > params.endDate) continue

    if (delta === 0) continue
    mods.set(period.key, {
      incomeAdjustment: 0,
      expenseAdjustment: 0,
      loanAdjustment: 0,
      goalAdjustment: delta,
      notes: [`Contributo obiettivo "${goal.name}": ${delta >= 0 ? '+' : ''}€${delta}/mese`],
    })
  }

  return mods
}

// ── GOAL_DEADLINE_CHANGE ──────────────────────────────────────────────────────

/**
 * Changing a goal's deadline is informational — it affects goal-completion
 * projections but not the monthly cash flow. Returns empty mods.
 */
export function applyGoalDeadlineChange(
  _params: GoalDeadlineChangeParams,
  _periods: ProjectionPeriod[],
  _goals: SavingsGoal[],
): ActionModifications {
  return new Map()
}

// ── GOAL_ONE_TIME_CONTRIBUTION ────────────────────────────────────────────────

export function applyGoalOneTimeContribution(
  params: GoalOneTimeContributionParams,
  periods: ProjectionPeriod[],
  goals: SavingsGoal[],
): ActionModifications {
  const mods: ActionModifications = new Map()
  const goal = goals.find((g) => g.id === params.goalId)
  if (!goal) return mods

  for (const period of periods) {
    if (!dateInPeriod(params.date, period)) continue
    mods.set(period.key, {
      incomeAdjustment: 0,
      expenseAdjustment: 0,
      loanAdjustment: 0,
      goalAdjustment: roundMoney(params.amount),
      notes: [`Versamento straordinario obiettivo "${goal.name}": €${params.amount}`],
    })
    break
  }

  return mods
}
