import { SCORE_THRESHOLDS } from './constants'
import { roundMoney, roundScore } from './helpers'
import type { ComponentScore, HealthBudget, HealthCategory, HealthFactor, HealthTransaction } from './types'

export type BudgetHealthSummary = {
  activeBudgets: number
  warningBudgets: number
  exceededBudgets: number
  totalLimit: number
  totalSpent: number
  aggregateUsagePercentage: number | null
  totalOverspend: number
  atRiskCategories: Array<{ categoryId: string; spent: number; limit: number; usage: number }>
}

function categoryIdsForBudget(categoryId: string, categories: HealthCategory[]): Set<string> {
  const ids = new Set([categoryId])
  for (const category of categories) {
    if (category.parent_id === categoryId) ids.add(category.id)
  }
  return ids
}

export function summarizeBudgets(params: {
  budgets: HealthBudget[]
  categories: HealthCategory[]
  transactions: HealthTransaction[]
  year: number
  month: number
}): BudgetHealthSummary {
  const key = `${params.year}-${String(params.month).padStart(2, '0')}`
  let totalLimit = 0
  let totalSpent = 0
  let warningBudgets = 0
  let exceededBudgets = 0
  let totalOverspend = 0
  const atRiskCategories: BudgetHealthSummary['atRiskCategories'] = []

  for (const budget of params.budgets.filter((item) => item.year === params.year && item.month === params.month)) {
    const categoryIds = categoryIdsForBudget(budget.category_id, params.categories)
    const spent = roundMoney(params.transactions
      .filter((tx) => tx.type === 'expense' && !tx.transfer_peer_id && tx.date.slice(0, 7) === key && tx.category_id && categoryIds.has(tx.category_id))
      .reduce((sum, tx) => sum + tx.amount, 0))
    const limit = roundMoney(budget.amount)
    const usage = limit > 0 ? roundMoney((spent / limit) * 100) : 0
    totalLimit = roundMoney(totalLimit + limit)
    totalSpent = roundMoney(totalSpent + spent)
    if (usage >= SCORE_THRESHOLDS.budgetExceededUsage) {
      exceededBudgets += 1
      totalOverspend = roundMoney(totalOverspend + Math.max(spent - limit, 0))
    } else if (usage >= SCORE_THRESHOLDS.budgetWarningUsage) {
      warningBudgets += 1
    }
    if (usage >= SCORE_THRESHOLDS.budgetWarningUsage) atRiskCategories.push({ categoryId: budget.category_id, spent, limit, usage })
  }

  return {
    activeBudgets: params.budgets.filter((item) => item.year === params.year && item.month === params.month).length,
    warningBudgets,
    exceededBudgets,
    totalLimit,
    totalSpent,
    aggregateUsagePercentage: totalLimit > 0 ? roundMoney((totalSpent / totalLimit) * 100) : null,
    totalOverspend,
    atRiskCategories: atRiskCategories.sort((a, b) => b.usage - a.usage),
  }
}

export function calculateBudgetScore(summary: BudgetHealthSummary, weight: number): ComponentScore {
  if (summary.activeBudgets === 0) {
    return {
      component: 'budgets',
      score: null,
      weight,
      contribution: 0,
      availability: 'NOT_APPLICABLE',
      status: 'neutral',
      factors: [{ id: 'budgets-none', component: 'budgets', impact: 'NEUTRAL', severity: 'INFO', title: 'Budget non presenti', description: 'La componente budget non incide sul punteggio perché non ci sono budget attivi.' }],
    }
  }

  let score = 100 - summary.exceededBudgets * 22 - summary.warningBudgets * 8
  if ((summary.aggregateUsagePercentage ?? 0) > 100) score -= Math.min(25, ((summary.aggregateUsagePercentage ?? 100) - 100) * 0.5)
  const finalScore = roundScore(score)
  const factors: HealthFactor[] = summary.exceededBudgets > 0
    ? [{ id: 'budgets-exceeded', component: 'budgets', impact: 'NEGATIVE', severity: 'WARNING', title: 'Budget superati', description: `${summary.exceededBudgets} budget hanno superato il limite nel periodo.`, metricValue: summary.exceededBudgets, metricUnit: 'budget' }]
    : [{ id: 'budgets-ok', component: 'budgets', impact: 'POSITIVE', severity: 'INFO', title: 'Budget sotto controllo', description: 'I budget del periodo non risultano superati.', metricValue: summary.aggregateUsagePercentage, metricUnit: '%' }]

  return {
    component: 'budgets',
    score: finalScore,
    weight,
    contribution: roundMoney((finalScore / 100) * weight),
    availability: 'AVAILABLE',
    status: finalScore >= 75 ? 'good' : finalScore >= 50 ? 'watch' : 'risk',
    factors,
  }
}
