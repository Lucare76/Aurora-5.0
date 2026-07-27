import type {
  FinancialScenario,
  ProjectionPeriod,
  MonthlyProjectionPoint,
  ScenarioProjectionResult,
  ActionModifications,
  CashFlowModification,
  ScenarioAction,
} from './types'
import type { RecurringRule, Loan, LoanPayment, SavingsGoal, GoalContribution } from '@/types/database'
import type { BaselineData } from './baseline'
import { roundMoney, sumMoney } from './money'

import { applyOneTimeExpense } from './actions/one-time-expense'
import { applyRecurringExpenseAdd, applyRecurringExpenseUpdate, applyRecurringExpenseRemove } from './actions/recurring-expense'
import { applyRecurringIncomeAdd, applyRecurringIncomeReduce, applyRecurringIncomePause } from './actions/recurring-income'
import { applyMonthlySavingsChange } from './actions/savings-change'
import { applyCategorySpendingChange } from './actions/category-spending'
import { applyBudgetLimitChange } from './actions/budget-change'
import { applyGoalContributionChange, applyGoalDeadlineChange, applyGoalOneTimeContribution } from './actions/goal-change'
import { applyLoanEarlyPayoff } from './actions/loan-payoff'
import { applyNewLoan } from './actions/new-loan'
import { applyAccountBalanceAdjustment } from './actions/account-adjustment'

// ── Merge ActionModifications into a single map ───────────────────────────────

function mergeModifications(
  all: Array<{ mods: ActionModifications; actionId: string }>,
  periods: ProjectionPeriod[],
): Map<string, { mod: CashFlowModification; actionIds: string[] }> {
  const merged = new Map<string, { mod: CashFlowModification; actionIds: string[] }>()

  for (const period of periods) {
    merged.set(period.key, {
      mod: { incomeAdjustment: 0, expenseAdjustment: 0, loanAdjustment: 0, goalAdjustment: 0, notes: [] },
      actionIds: [],
    })
  }

  for (const { mods, actionId } of all) {
    for (const [key, mod] of mods) {
      const entry = merged.get(key)
      if (!entry) continue
      entry.mod.incomeAdjustment = roundMoney(entry.mod.incomeAdjustment + mod.incomeAdjustment)
      entry.mod.expenseAdjustment = roundMoney(entry.mod.expenseAdjustment + mod.expenseAdjustment)
      entry.mod.loanAdjustment = roundMoney(entry.mod.loanAdjustment + mod.loanAdjustment)
      entry.mod.goalAdjustment = roundMoney(entry.mod.goalAdjustment + mod.goalAdjustment)
      entry.mod.notes.push(...mod.notes)
      if (!entry.actionIds.includes(actionId)) entry.actionIds.push(actionId)
    }
  }

  return merged
}

// ── Dispatch action → ActionModifications ─────────────────────────────────────

function dispatchAction(
  action: ScenarioAction,
  periods: ProjectionPeriod[],
  recurringRules: RecurringRule[],
  loans: Loan[],
  loanPayments: LoanPayment[],
  goals: SavingsGoal[],
  goalContributions: GoalContribution[],
): ActionModifications {
  const p = action.params as Record<string, unknown>

  switch (action.code) {
    case 'ONE_TIME_EXPENSE':
      return applyOneTimeExpense(p as Parameters<typeof applyOneTimeExpense>[0], periods, action.id)
    case 'RECURRING_EXPENSE_ADD':
      return applyRecurringExpenseAdd(p as Parameters<typeof applyRecurringExpenseAdd>[0], periods)
    case 'RECURRING_EXPENSE_UPDATE':
      return applyRecurringExpenseUpdate(p as Parameters<typeof applyRecurringExpenseUpdate>[0], periods, recurringRules)
    case 'RECURRING_EXPENSE_REMOVE':
      return applyRecurringExpenseRemove(p as Parameters<typeof applyRecurringExpenseRemove>[0], periods, recurringRules)
    case 'RECURRING_INCOME_ADD':
      return applyRecurringIncomeAdd(p as Parameters<typeof applyRecurringIncomeAdd>[0], periods)
    case 'RECURRING_INCOME_REDUCE':
      return applyRecurringIncomeReduce(p as Parameters<typeof applyRecurringIncomeReduce>[0], periods, recurringRules)
    case 'RECURRING_INCOME_PAUSE':
      return applyRecurringIncomePause(p as Parameters<typeof applyRecurringIncomePause>[0], periods, recurringRules)
    case 'MONTHLY_SAVINGS_CHANGE':
      return applyMonthlySavingsChange(p as Parameters<typeof applyMonthlySavingsChange>[0], periods)
    case 'CATEGORY_SPENDING_CHANGE':
      return applyCategorySpendingChange(p as Parameters<typeof applyCategorySpendingChange>[0], periods)
    case 'BUDGET_LIMIT_CHANGE':
      return applyBudgetLimitChange(p as Parameters<typeof applyBudgetLimitChange>[0], periods)
    case 'GOAL_CONTRIBUTION_CHANGE':
      return applyGoalContributionChange(p as Parameters<typeof applyGoalContributionChange>[0], periods, goals, goalContributions)
    case 'GOAL_DEADLINE_CHANGE':
      return applyGoalDeadlineChange(p as Parameters<typeof applyGoalDeadlineChange>[0], periods, goals)
    case 'GOAL_ONE_TIME_CONTRIBUTION':
      return applyGoalOneTimeContribution(p as Parameters<typeof applyGoalOneTimeContribution>[0], periods, goals)
    case 'LOAN_EARLY_PAYOFF':
      return applyLoanEarlyPayoff(p as Parameters<typeof applyLoanEarlyPayoff>[0], periods, loans, loanPayments)
    case 'NEW_LOAN':
      return applyNewLoan(p as Parameters<typeof applyNewLoan>[0], periods)
    case 'ACCOUNT_BALANCE_ADJUSTMENT':
      return applyAccountBalanceAdjustment(p as Parameters<typeof applyAccountBalanceAdjustment>[0], periods)
    default:
      return new Map()
  }
}

// ── Main projection ───────────────────────────────────────────────────────────

export function projectScenario(
  scenario: FinancialScenario,
  periods: ProjectionPeriod[],
  baseline: BaselineData,
  recurringRules: RecurringRule[],
  loans: Loan[],
  loanPayments: LoanPayment[],
  goals: SavingsGoal[],
  goalContributions: GoalContribution[],
): ScenarioProjectionResult {
  // Collect modifications from all enabled actions
  const allMods: Array<{ mods: ActionModifications; actionId: string }> = []

  for (const action of scenario.actions) {
    if (!action.enabled) continue
    const mods = dispatchAction(action, periods, recurringRules, loans, loanPayments, goals, goalContributions)
    allMods.push({ mods, actionId: action.id })
  }

  const mergedMap = mergeModifications(allMods, periods)

  // Build monthly projection points
  const months: MonthlyProjectionPoint[] = []
  let baselineRunning = baseline.initialBalance
  let scenarioRunning = baseline.initialBalance

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]
    const baseMonth = baseline.months[i]
    const { mod, actionIds } = mergedMap.get(period.key) ?? {
      mod: { incomeAdjustment: 0, expenseAdjustment: 0, loanAdjustment: 0, goalAdjustment: 0, notes: [] },
      actionIds: [],
    }

    // Baseline values (from pre-built baseline)
    const bIncome = baseMonth.income
    const bExpenses = baseMonth.expenses
    const bLoans = baseMonth.loanPayments
    const bGoals = baseMonth.goalContributions
    const bClose = roundMoney(baselineRunning + bIncome - bExpenses - bLoans - bGoals)

    // Scenario values = baseline + modifications
    const sIncome = roundMoney(bIncome + mod.incomeAdjustment)
    const sExpenses = roundMoney(bExpenses + mod.expenseAdjustment)
    const sLoans = roundMoney(bLoans + mod.loanAdjustment)
    const sGoals = roundMoney(bGoals + mod.goalAdjustment)
    const sClose = roundMoney(scenarioRunning + sIncome - sExpenses - sLoans - sGoals)

    months.push({
      period,
      baselineOpeningBalance: baselineRunning,
      baselineIncome: bIncome,
      baselineExpenses: bExpenses,
      baselineLoanPayments: bLoans,
      baselineGoalContributions: bGoals,
      baselineClosingBalance: bClose,
      scenarioOpeningBalance: scenarioRunning,
      scenarioIncome: sIncome,
      scenarioExpenses: sExpenses,
      scenarioLoanPayments: sLoans,
      scenarioGoalContributions: sGoals,
      scenarioClosingBalance: sClose,
      delta: roundMoney(sClose - bClose),
      appliedActionIds: actionIds,
    })

    baselineRunning = bClose
    scenarioRunning = sClose
  }

  // Aggregate stats
  const baselineBalances = months.map((m) => m.baselineClosingBalance)
  const scenarioBalances = months.map((m) => m.scenarioClosingBalance)

  const baselineNegativeMonths = baselineBalances.filter((b) => b < 0).length
  const scenarioNegativeMonths = scenarioBalances.filter((b) => b < 0).length

  const baselineFirstNeg = months.find((m) => m.baselineClosingBalance < 0)?.period.key ?? null
  const scenarioFirstNeg = months.find((m) => m.scenarioClosingBalance < 0)?.period.key ?? null

  return {
    months,
    baselineFinalBalance: months.at(-1)?.baselineClosingBalance ?? baseline.initialBalance,
    baselineMinBalance: months.length > 0 ? Math.min(...baselineBalances) : baseline.initialBalance,
    baselineTotalIncome: roundMoney(sumMoney(months.map((m) => m.baselineIncome))),
    baselineTotalExpenses: roundMoney(sumMoney(months.map((m) => m.baselineExpenses + m.baselineLoanPayments + m.baselineGoalContributions))),
    baselineNegativeMonths,
    baselineFirstNegativeMonth: baselineFirstNeg,
    scenarioFinalBalance: months.at(-1)?.scenarioClosingBalance ?? baseline.initialBalance,
    scenarioMinBalance: months.length > 0 ? Math.min(...scenarioBalances) : baseline.initialBalance,
    scenarioTotalIncome: roundMoney(sumMoney(months.map((m) => m.scenarioIncome))),
    scenarioTotalExpenses: roundMoney(sumMoney(months.map((m) => m.scenarioExpenses + m.scenarioLoanPayments + m.scenarioGoalContributions))),
    scenarioNegativeMonths,
    scenarioFirstNegativeMonth: scenarioFirstNeg,
    totalDelta: roundMoney(
      (months.at(-1)?.scenarioClosingBalance ?? 0) - (months.at(-1)?.baselineClosingBalance ?? 0),
    ),
    initialBalanceAdjustment: 0,
  }
}
