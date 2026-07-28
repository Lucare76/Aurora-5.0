import type { AffordabilityBaseline, AffordabilityDataQuality, AffordabilityDbData } from './types'
import {
  FREQUENCY_MONTHLY_FACTOR,
  LOOKBACK_MONTHS,
  MIN_MONTHS_FOR_GOOD_QUALITY,
  MIN_MONTHS_FOR_MEDIA_QUALITY,
} from './constants'
import { roundMoney, sumMoney, averageMoney } from '@/lib/scenarios/money'

// ── Recurring rules → monthly estimate ───────────────────────────────────────

function recurringToMonthly(
  rules: AffordabilityDbData['recurringRules'],
  type: 'income' | 'expense',
  now: Date,
): number {
  const active = rules.filter((r) => {
    if (!r.is_active || r.type !== type) return false
    if (r.end_date && new Date(r.end_date + 'T00:00:00Z') < now) return false
    return true
  })
  const total = sumMoney(
    active.map((r) => {
      const factor = FREQUENCY_MONTHLY_FACTOR[r.frequency] ?? 1
      return roundMoney(r.amount * factor)
    }),
  )
  return total
}

// ── Transactions → monthly average over lookback window ───────────────────────

type TxSummary = { type: string; amount: number; date: string; transfer_peer_id: string | null }

function monthlyAvgFromTransactions(
  transactions: TxSummary[],
  type: 'income' | 'expense',
  now: Date,
  lookbackMonths: number,
): { average: number; monthsCovered: number } {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - lookbackMonths)

  const relevant = transactions.filter(
    (tx) =>
      tx.type === type &&
      tx.transfer_peer_id === null &&
      new Date(tx.date + 'T00:00:00Z') >= cutoff &&
      new Date(tx.date + 'T00:00:00Z') <= now,
  )

  if (relevant.length === 0) return { average: 0, monthsCovered: 0 }

  // Group by month
  const byMonth = new Map<string, number>()
  for (const tx of relevant) {
    const key = tx.date.slice(0, 7) // YYYY-MM
    byMonth.set(key, roundMoney((byMonth.get(key) ?? 0) + tx.amount))
  }

  const monthTotals = [...byMonth.values()]
  const monthsCovered = monthTotals.length

  // Divide total by lookbackMonths (not just months covered), to get honest average
  const total = sumMoney(monthTotals)
  const average = roundMoney(total / lookbackMonths)

  return { average, monthsCovered }
}

// ── Loan payment estimate (last LOOKBACK_MONTHS) ──────────────────────────────

function estimateLoanPayments(
  loans: AffordabilityDbData['loans'],
  payments: AffordabilityDbData['loanPayments'],
  now: Date,
): number {
  const activeLoans = loans.filter((l) => !l.is_settled)
  if (activeLoans.length === 0) return 0

  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - LOOKBACK_MONTHS)

  const recent = payments.filter((p) => new Date(p.paid_at) >= cutoff)
  if (recent.length === 0) {
    // Fallback: remaining / months left
    const estimate = activeLoans.reduce((sum, l) => {
      if (!l.due_date) return sum + roundMoney(l.remaining / 24)
      const monthsLeft = Math.max(
        1,
        (new Date(l.due_date).getUTCFullYear() - now.getUTCFullYear()) * 12 +
          (new Date(l.due_date).getUTCMonth() - now.getUTCMonth()),
      )
      return sum + roundMoney(l.remaining / monthsLeft)
    }, 0)
    return roundMoney(estimate)
  }

  return roundMoney(sumMoney(recent.map((p) => p.amount)) / LOOKBACK_MONTHS)
}

// ── Goal contribution estimate ────────────────────────────────────────────────

function estimateGoalContributions(
  goals: AffordabilityDbData['goals'],
  contributions: AffordabilityDbData['goalContributions'],
  now: Date,
  include: boolean,
): number {
  if (!include) return 0
  const activeGoalIds = new Set(
    goals.filter((g) => g.status === 'ACTIVE' && !g.archived).map((g) => g.id),
  )
  if (activeGoalIds.size === 0) return 0

  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - LOOKBACK_MONTHS)

  const recent = contributions.filter(
    (c) => activeGoalIds.has(c.goal_id) && new Date(c.date + 'T00:00:00Z') >= cutoff,
  )
  if (recent.length === 0) return 0

  return roundMoney(sumMoney(recent.map((c) => c.amount)) / LOOKBACK_MONTHS)
}

// ── Data quality ──────────────────────────────────────────────────────────────

function assessDataQuality(
  monthsCoveredIncome: number,
  monthsCoveredExpenses: number,
  hasAccounts: boolean,
  hasRecurring: boolean,
): { quality: AffordabilityDataQuality; score: number } {
  if (!hasAccounts) return { quality: 'INSUFFICIENTE', score: 0 }

  const months = Math.max(monthsCoveredIncome, monthsCoveredExpenses)

  if (months >= MIN_MONTHS_FOR_GOOD_QUALITY) {
    return { quality: 'ALTA', score: 90 }
  }
  if (months >= MIN_MONTHS_FOR_MEDIA_QUALITY) {
    return { quality: 'MEDIA', score: 65 }
  }
  if (months >= 1 || hasRecurring) {
    return { quality: 'BASSA', score: 30 }
  }
  if (hasRecurring) {
    return { quality: 'BASSA', score: 25 }
  }
  return { quality: 'INSUFFICIENTE', score: 5 }
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildAffordabilityBaseline(
  data: AffordabilityDbData,
  includeGoalContributions: boolean,
  now: Date,
): AffordabilityBaseline {
  const warnings: string[] = []

  const activeAccounts = data.accounts.filter((a) => a.is_active)
  const totalLiquidity = roundMoney(sumMoney(activeAccounts.map((a) => a.balance)))

  if (activeAccounts.length === 0) {
    return {
      totalLiquidity: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      monthlyMargin: 0,
      monthlyLoanPayments: 0,
      monthlyGoalContributions: 0,
      coverageMonths: null,
      existingMonthlyDebtBurden: 0,
      dataQuality: 'INSUFFICIENTE',
      dataQualityScore: 0,
      historicMonthsAvailable: 0,
      incomeSource: 'NONE',
      expenseSource: 'NONE',
      hasActiveRecurring: false,
      hasLoans: false,
      warnings: ['Nessun conto attivo trovato.'],
    }
  }

  const { average: txIncome, monthsCovered: monthsIncome } = monthlyAvgFromTransactions(
    data.recentTransactions,
    'income',
    now,
    LOOKBACK_MONTHS,
  )
  const { average: txExpenses, monthsCovered: monthsExpenses } = monthlyAvgFromTransactions(
    data.recentTransactions,
    'expense',
    now,
    LOOKBACK_MONTHS,
  )

  const recurringIncome = recurringToMonthly(data.recurringRules, 'income', now)
  const recurringExpenses = recurringToMonthly(data.recurringRules, 'expense', now)
  const hasActiveRecurring = data.recurringRules.some((r) => r.is_active)

  // Choose best income estimate
  let monthlyIncome: number
  let incomeSource: AffordabilityBaseline['incomeSource']
  if (txIncome > 0) {
    monthlyIncome = txIncome
    incomeSource = 'TRANSACTIONS'
  } else if (recurringIncome > 0) {
    monthlyIncome = recurringIncome
    incomeSource = 'RECURRING'
    warnings.push('Entrate stimate dalle ricorrenze attive (nessuna transazione recente di entrata).')
  } else {
    monthlyIncome = 0
    incomeSource = 'NONE'
    warnings.push('Nessuna entrata trovata: stima mensile pari a zero.')
  }

  // Choose best expense estimate
  let monthlyExpenses: number
  let expenseSource: AffordabilityBaseline['expenseSource']
  if (txExpenses > 0) {
    monthlyExpenses = txExpenses
    expenseSource = 'TRANSACTIONS'
  } else if (recurringExpenses > 0) {
    monthlyExpenses = recurringExpenses
    expenseSource = 'RECURRING'
    warnings.push('Uscite stimate dalle ricorrenze attive (nessuna transazione recente di uscita).')
  } else {
    monthlyExpenses = 0
    expenseSource = 'NONE'
    warnings.push('Nessuna uscita trovata: stima mensile pari a zero.')
  }

  const monthlyLoanPayments = estimateLoanPayments(data.loans, data.loanPayments, now)
  const monthlyGoalContributions = estimateGoalContributions(
    data.goals,
    data.goalContributions,
    now,
    includeGoalContributions,
  )
  const existingMonthlyDebtBurden = monthlyLoanPayments

  const monthlyMargin = roundMoney(
    monthlyIncome - monthlyExpenses - monthlyLoanPayments - monthlyGoalContributions,
  )

  const coverageMonths =
    monthlyExpenses > 0 ? roundMoney(totalLiquidity / monthlyExpenses) : null

  const { quality: dataQuality, score: dataQualityScore } = assessDataQuality(
    monthsIncome,
    monthsExpenses,
    activeAccounts.length > 0,
    hasActiveRecurring,
  )

  const historicMonthsAvailable = Math.max(monthsIncome, monthsExpenses)

  if (data.loans.some((l) => !l.is_settled) && monthlyLoanPayments === 0) {
    warnings.push('Prestiti attivi rilevati ma nessun pagamento recente trovato. La stima potrebbe sottovalutare il peso del debito.')
  }

  return {
    totalLiquidity,
    monthlyIncome,
    monthlyExpenses,
    monthlyMargin,
    monthlyLoanPayments,
    monthlyGoalContributions,
    coverageMonths,
    existingMonthlyDebtBurden,
    dataQuality,
    dataQualityScore,
    historicMonthsAvailable,
    incomeSource,
    expenseSource,
    hasActiveRecurring,
    hasLoans: data.loans.some((l) => !l.is_settled),
    warnings,
  }
}
