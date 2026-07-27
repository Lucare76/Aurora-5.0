import type {
  Account, RecurringRule, SavingsGoal, GoalContribution,
  Loan, LoanPayment,
} from '@/types/database'
import type { ProjectionPeriod, ScenarioAssumptions } from './types'
import { countOccurrencesInPeriod, parseDateUTC } from './dates'
import { roundMoney, sumMoney, averageMoney } from './money'
import { CONTRIBUTION_LOOKBACK_MONTHS } from './constants'

// ── Result types ──────────────────────────────────────────────────────────────

export type BaselineMonthData = {
  period: ProjectionPeriod
  openingBalance: number
  income: number
  expenses: number
  loanPayments: number
  goalContributions: number
  closingBalance: number
  activeRuleIds: string[]
}

export type BaselineData = {
  months: BaselineMonthData[]
  initialBalance: number
  monthlyLoanEstimate: number       // average monthly loan payment
  monthlyGoalContributionEstimate: number
  includedAccountIds: string[]
  warnings: string[]
}

// ── Account balance ───────────────────────────────────────────────────────────

export function computeInitialBalance(
  accounts: Account[],
  assumptions: ScenarioAssumptions,
): number {
  const included = accounts.filter(
    (a) => a.is_active && !assumptions.excludedAccountIds.includes(a.id),
  )
  return roundMoney(included.reduce((sum, a) => sum + a.balance, 0))
}

// ── Recurring rules ───────────────────────────────────────────────────────────

function expandRecurringInPeriod(
  rules: RecurringRule[],
  period: ProjectionPeriod,
): { income: number; expenses: number; activeIds: string[] } {
  const periodStart = parseDateUTC(period.startDate)
  const periodEnd = parseDateUTC(period.endDate)
  let income = 0
  let expenses = 0
  const activeIds: string[] = []

  for (const rule of rules) {
    if (!rule.is_active) continue
    const n = countOccurrencesInPeriod(rule, periodStart, periodEnd)
    if (n === 0) continue
    const total = roundMoney(rule.amount * n)
    if (rule.type === 'income') {
      income = roundMoney(income + total)
      activeIds.push(rule.id)
    } else if (rule.type === 'expense') {
      expenses = roundMoney(expenses + total)
      activeIds.push(rule.id)
    }
    // 'transfer' rules are excluded from the balance projection
  }

  return { income, expenses, activeIds }
}

// ── Loan payment estimate ─────────────────────────────────────────────────────

export function estimateMonthlyLoanPayment(
  loans: Loan[],
  loanPayments: LoanPayment[],
  assumptions: ScenarioAssumptions,
): number {
  if (assumptions.loanPaymentSource === 'none') return 0

  const activeLoans = loans.filter((l) => !l.is_settled)
  if (activeLoans.length === 0) return 0

  // Use recent payments as estimate
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - CONTRIBUTION_LOOKBACK_MONTHS)

  const recentPayments = loanPayments.filter(
    (p) => new Date(p.paid_at) >= cutoff,
  )

  if (recentPayments.length === 0) {
    // Fallback: estimate remaining/12 per active loan
    const estimate = activeLoans.reduce((sum, l) => {
      if (!l.due_date) return sum
      const monthsLeft = Math.max(1,
        (new Date(l.due_date).getFullYear() - now.getFullYear()) * 12 +
        (new Date(l.due_date).getMonth() - now.getMonth())
      )
      return sum + l.remaining / monthsLeft
    }, 0)
    return roundMoney(estimate)
  }

  const total = sumMoney(recentPayments.map((p) => p.amount))
  return roundMoney(total / CONTRIBUTION_LOOKBACK_MONTHS)
}

// ── Goal contribution estimate ────────────────────────────────────────────────

export function estimateMonthlyGoalContribution(
  goals: SavingsGoal[],
  contributions: GoalContribution[],
  assumptions: ScenarioAssumptions,
): number {
  if (assumptions.goalContributionSource === 'none') return 0
  if (!assumptions.includeGoalContributions) return 0

  const activeGoalIds = new Set(
    goals.filter((g) => g.status === 'ACTIVE' && !g.archived).map((g) => g.id),
  )
  if (activeGoalIds.size === 0) return 0

  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - CONTRIBUTION_LOOKBACK_MONTHS)

  const recent = contributions.filter(
    (c) => activeGoalIds.has(c.goal_id) && new Date(c.date) >= cutoff,
  )

  if (recent.length === 0) return 0

  const total = sumMoney(recent.map((c) => c.amount))
  return roundMoney(total / CONTRIBUTION_LOOKBACK_MONTHS)
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildBaseline(
  periods: ProjectionPeriod[],
  accounts: Account[],
  recurringRules: RecurringRule[],
  loans: Loan[],
  loanPayments: LoanPayment[],
  goals: SavingsGoal[],
  goalContributions: GoalContribution[],
  assumptions: ScenarioAssumptions,
): BaselineData {
  const warnings: string[] = []
  const includedAccounts = accounts.filter(
    (a) => a.is_active && !assumptions.excludedAccountIds.includes(a.id),
  )
  const initialBalance = roundMoney(
    includedAccounts.reduce((sum, a) => sum + a.balance, 0),
  )

  const monthlyLoanEstimate = estimateMonthlyLoanPayment(loans, loanPayments, assumptions)
  const monthlyGoalContributionEstimate = estimateMonthlyGoalContribution(
    goals, goalContributions, assumptions,
  )

  if (loans.filter((l) => !l.is_settled).length > 0 && monthlyLoanEstimate === 0) {
    warnings.push('Prestiti attivi rilevati ma nessun pagamento recente disponibile per la stima.')
  }

  const months: BaselineMonthData[] = []
  let runningBalance = initialBalance

  for (const period of periods) {
    const { income, expenses, activeIds } = expandRecurringInPeriod(recurringRules, period)
    const loanPaymentsMonth = monthlyLoanEstimate
    const goalContribMonth = monthlyGoalContributionEstimate

    const closingBalance = roundMoney(
      runningBalance + income - expenses - loanPaymentsMonth - goalContribMonth,
    )

    months.push({
      period,
      openingBalance: runningBalance,
      income,
      expenses,
      loanPayments: loanPaymentsMonth,
      goalContributions: goalContribMonth,
      closingBalance,
      activeRuleIds: activeIds,
    })

    runningBalance = closingBalance
  }

  return {
    months,
    initialBalance,
    monthlyLoanEstimate,
    monthlyGoalContributionEstimate,
    includedAccountIds: includedAccounts.map((a) => a.id),
    warnings,
  }
}
