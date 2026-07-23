import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────────

export type BudgetStatus = 'safe' | 'warning' | 'critical' | 'exceeded'

export type BudgetEntry = {
  budgetId: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  parentCategoryName: string | null
  year: number
  month: number
  amount: number
  spent: number
  remaining: number
  percentage: number
  status: BudgetStatus
}

export type BudgetForecast = {
  hasEnoughData: boolean
  projectedSpent: number
  projectedRemaining: number
  projectedPercentage: number
  projectedStatus: BudgetStatus
  projectedOverrun: number
  daysElapsed: number
  daysInMonth: number
  dailyAvgSpend: number
}

export type BudgetComparison = {
  prevMonthSpent: number
  currentMonthSpent: number
  absoluteDiff: number
  percentageDiff: number
  trend: 'up' | 'down' | 'stable' | 'unavailable'
}

export type BudgetAlertType =
  | 'threshold_50' | 'threshold_75' | 'threshold_90' | 'threshold_100' | 'projected_overrun'

export type BudgetAlert = {
  type: BudgetAlertType
  categoryName: string
  threshold: number
  currentPercentage: number
  message: string
  priority: number
}

export type BudgetInsightType =
  | 'projected_overrun' | 'spending_down_vs_last_month' | 'spending_up_vs_last_month'
  | 'best_month_in_period' | 'worst_month_in_period' | 'consistently_within_budget'
  | 'repeated_overrun' | 'early_month_high_spend' | 'budget_almost_exhausted'

export type BudgetInsight = {
  type: BudgetInsightType
  message: string
  categoryName: string
  priority: number
}

export type BudgetHistoryPoint = {
  year: number
  month: number
  budgetAmount: number
  spent: number
  remaining: number
  percentage: number
  status: BudgetStatus
  hadBudget: boolean
}

export type EnrichedBudgetEntry = BudgetEntry & {
  forecast: BudgetForecast
  comparison: BudgetComparison
  topAlert: BudgetAlert | null
}

export type BudgetSummary = {
  totalBudgets: number
  totalAmount: number
  totalSpent: number
  totalRemaining: number
  atRiskCount: number
  exceededCount: number
  topRiskBudgets: {
    categoryName: string
    amount: number
    spent: number
    percentage: number
    status: BudgetStatus
  }[]
}

export type EnrichedBudgetSummary = BudgetSummary & {
  projectedTotalSpent: number
  projectedTotalOverrun: number
  projectedAtRiskCount: number
  topProjectedRisks: {
    categoryName: string
    projectedSpent: number
    amount: number
    projectedOverrun: number
    projectedPercentage: number
  }[]
  budgetAlerts: BudgetAlert[]
  budgetInsights: BudgetInsight[]
}

export type BudgetDetailTransaction = {
  id: string
  date: string
  description: string | null
  amount: number
  categoryName: string
  categoryIcon: string | null
  accountName: string
  isSubcategory: boolean
}

export type BudgetDetailPayload = {
  budget: BudgetEntry
  forecast: BudgetForecast
  comparison: BudgetComparison
  history: BudgetHistoryPoint[]
  alerts: BudgetAlert[]
  insights: BudgetInsight[]
  transactions: BudgetDetailTransaction[]
}

// ── Internal raw types (DB rows) ───────────────────────────────────────────────

type RawBudget   = { id: string; category_id: string; amount: number | string }
type RawCategory = { id: string; name: string; icon: string | null; parent_id: string | null }
type RawTx       = { category_id: string | null; amount: number | string }

// ── Pure helpers ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function eur(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Math.abs(n))
}

/** Status thresholds per spec: <75 safe, 75–89 warning, 90–99 critical, ≥100 exceeded */
export function getBudgetStatus(percentage: number): BudgetStatus {
  if (percentage >= 100) return 'exceeded'
  if (percentage >= 90)  return 'critical'
  if (percentage >= 75)  return 'warning'
  return 'safe'
}

function sortEntries(a: BudgetEntry, b: BudgetEntry): number {
  const order: Record<BudgetStatus, number> = { exceeded: 0, critical: 1, warning: 2, safe: 3 }
  const diff = order[a.status] - order[b.status]
  return diff !== 0 ? diff : b.percentage - a.percentage
}

/**
 * Pure function — no DB access. Used by service and dashboard.
 *
 * Accounting rules:
 * - Only type='expense' AND transfer_peer_id IS NULL transactions count
 * - Root category (parent_id IS NULL) rolls up direct children
 * - Child category only counts own category spending
 * - No double-counting between parent and child budgets
 */
export function computeBudgetEntries(
  budgets: RawBudget[],
  categories: RawCategory[],
  expenseTxs: RawTx[],
  year: number,
  month: number,
): BudgetEntry[] {
  const catById = new Map<string, RawCategory>(categories.map((c) => [c.id, c]))

  const childrenOf = new Map<string, string[]>()
  for (const c of categories) {
    if (c.parent_id) {
      const arr = childrenOf.get(c.parent_id) ?? []
      arr.push(c.id)
      childrenOf.set(c.parent_id, arr)
    }
  }

  const spentByRawCat: Record<string, number> = {}
  for (const tx of expenseTxs) {
    if (!tx.category_id) continue
    spentByRawCat[tx.category_id] = (spentByRawCat[tx.category_id] ?? 0) + Number(tx.amount)
  }

  return budgets
    .map((b) => {
      const cat    = catById.get(b.category_id)
      const isRoot = !cat?.parent_id

      let spent = spentByRawCat[b.category_id] ?? 0
      if (isRoot) {
        for (const childId of childrenOf.get(b.category_id) ?? []) {
          spent += spentByRawCat[childId] ?? 0
        }
      }

      spent = round2(spent)
      const amount     = round2(Number(b.amount))
      const remaining  = round2(amount - spent)
      const percentage = amount > 0 ? Math.round((spent / amount) * 100) : 0
      const status     = getBudgetStatus(percentage)
      const parentCat  = cat?.parent_id ? catById.get(cat.parent_id) : undefined

      return {
        budgetId:           b.id,
        categoryId:         b.category_id,
        categoryName:       cat?.name ?? 'Categoria',
        categoryIcon:       cat?.icon ?? null,
        parentCategoryName: parentCat?.name ?? null,
        year,
        month,
        amount,
        spent,
        remaining,
        percentage,
        status,
      } satisfies BudgetEntry
    })
    .sort(sortEntries)
}

export function computeBudgetSummary(entries: BudgetEntry[]): BudgetSummary {
  const totalAmount    = round2(entries.reduce((s, e) => s + e.amount, 0))
  const totalSpent     = round2(entries.reduce((s, e) => s + e.spent, 0))
  const totalRemaining = round2(totalAmount - totalSpent)
  const atRiskCount    = entries.filter((e) => e.status !== 'safe').length
  const exceededCount  = entries.filter((e) => e.status === 'exceeded').length

  const topRiskBudgets = entries
    .filter((e) => e.status !== 'safe')
    .slice(0, 3)
    .map((e) => ({
      categoryName: e.categoryName,
      amount:       e.amount,
      spent:        e.spent,
      percentage:   e.percentage,
      status:       e.status,
    }))

  return { totalBudgets: entries.length, totalAmount, totalSpent, totalRemaining, atRiskCount, exceededCount, topRiskBudgets }
}

// ── Sprint 7B: Pure computation functions ──────────────────────────────────────

/**
 * Computes end-of-month spend forecast for a single budget entry.
 *
 * hasEnoughData = daysElapsed >= 3 AND spent > 0
 * projectedSpent = (spent / daysElapsed) * daysInMonth
 *
 * For past months, daysElapsed = daysInMonth (month complete).
 * For future months, hasEnoughData = false.
 */
export function buildBudgetForecast(
  spent: number,
  amount: number,
  year: number,
  month: number,
  now: Date,
): BudgetForecast {
  const daysInMonth = new Date(year, month, 0).getDate()
  const nowYear     = now.getFullYear()
  const nowMonth    = now.getMonth() + 1

  let daysElapsed: number
  if (year === nowYear && month === nowMonth) {
    daysElapsed = now.getDate()
  } else if (year < nowYear || (year === nowYear && month < nowMonth)) {
    daysElapsed = daysInMonth // past month: fully elapsed
  } else {
    daysElapsed = 0 // future month: no data yet
  }

  const hasEnoughData = daysElapsed >= 3 && spent > 0

  if (!hasEnoughData) {
    return {
      hasEnoughData:      false,
      projectedSpent:     0,
      projectedRemaining: round2(amount),
      projectedPercentage: 0,
      projectedStatus:    'safe',
      projectedOverrun:   0,
      daysElapsed,
      daysInMonth,
      dailyAvgSpend:      0,
    }
  }

  const dailyAvg           = spent / daysElapsed
  const dailyAvgSpend      = round2(dailyAvg)
  const projectedSpent     = round2(dailyAvg * daysInMonth)
  const projectedRemaining = round2(amount - projectedSpent)
  const projectedPercentage = amount > 0 ? Math.round((projectedSpent / amount) * 100) : 0
  const projectedStatus    = getBudgetStatus(projectedPercentage)
  const projectedOverrun   = projectedSpent > amount ? round2(projectedSpent - amount) : 0

  return {
    hasEnoughData: true,
    projectedSpent,
    projectedRemaining,
    projectedPercentage,
    projectedStatus,
    projectedOverrun,
    daysElapsed,
    daysInMonth,
    dailyAvgSpend,
  }
}

/**
 * Compares current vs previous month spending for a single category.
 * trend='unavailable' when prevSpent=0 and currentSpent>0 (no baseline to compare).
 * trend='stable' when relative change < 3%.
 */
export function buildBudgetComparison(
  currentSpent: number,
  prevSpent: number,
): BudgetComparison {
  const absoluteDiff = round2(currentSpent - prevSpent)

  if (prevSpent === 0) {
    return {
      prevMonthSpent:    0,
      currentMonthSpent: currentSpent,
      absoluteDiff,
      percentageDiff:    0,
      trend: currentSpent === 0 ? 'stable' : 'unavailable',
    }
  }

  const percentageDiff  = Math.round(((currentSpent - prevSpent) / prevSpent) * 100)
  const stableThreshold = 0.03 // 3% relative change counts as stable

  let trend: 'up' | 'down' | 'stable'
  if (Math.abs(currentSpent - prevSpent) / prevSpent < stableThreshold) {
    trend = 'stable'
  } else if (currentSpent > prevSpent) {
    trend = 'up'
  } else {
    trend = 'down'
  }

  return { prevMonthSpent: prevSpent, currentMonthSpent: currentSpent, absoluteDiff, percentageDiff, trend }
}

/**
 * Generates alerts from current budget entries.
 * Emits only the highest triggered threshold per category; also one projected_overrun
 * per category when forecast indicates overrun but current hasn't exceeded yet.
 * No duplicates. Sorted by priority (1 = highest).
 */
export function buildBudgetAlerts(
  entries: Array<{ categoryId: string; categoryName: string; spent: number; amount: number; percentage: number }>,
  forecasts: Map<string, BudgetForecast>,
): BudgetAlert[] {
  const alerts: BudgetAlert[] = []
  const seen  = new Set<string>()

  for (const entry of entries) {
    const { categoryId, categoryName, percentage, spent, amount } = entry

    const thresholds: [number, BudgetAlertType][] = [
      [100, 'threshold_100'],
      [90,  'threshold_90'],
      [75,  'threshold_75'],
      [50,  'threshold_50'],
    ]

    for (const [thr, type] of thresholds) {
      if (percentage >= thr) {
        const key = `${categoryId}:real`
        if (!seen.has(key)) {
          seen.add(key)
          const overrun = round2(spent - amount)
          alerts.push({
            type,
            categoryName,
            threshold: thr,
            currentPercentage: percentage,
            message:
              thr === 100
                ? `Hai superato il budget ${categoryName} di ${eur(overrun)}.`
                : thr === 90
                ? `Il budget ${categoryName} è quasi esaurito (${percentage}%).`
                : `Hai utilizzato il ${percentage}% del budget ${categoryName}.`,
            priority: thr === 100 ? 1 : thr === 90 ? 2 : thr === 75 ? 3 : 4,
          })
        }
        break
      }
    }

    const forecast = forecasts.get(categoryId)
    if (forecast?.hasEnoughData && forecast.projectedOverrun > 0 && percentage < 100) {
      const key = `${categoryId}:projected`
      if (!seen.has(key)) {
        seen.add(key)
        alerts.push({
          type: 'projected_overrun',
          categoryName,
          threshold: 100,
          currentPercentage: percentage,
          message: `Al ritmo attuale potresti superare il budget ${categoryName} di circa ${eur(forecast.projectedOverrun)}.`,
          priority: forecast.projectedOverrun > amount * 0.2 ? 2 : 3,
        })
      }
    }
  }

  return alerts.sort((a, b) => a.priority - b.priority)
}

/**
 * Generates insights from enriched entries (no history needed).
 * Returns at most maxCount insights, sorted by priority.
 */
export function buildBudgetInsights(
  entries: EnrichedBudgetEntry[],
  maxCount = 5,
): BudgetInsight[] {
  const insights: BudgetInsight[] = []
  const coveredCats = new Set<string>()

  for (const entry of entries) {
    if (insights.length >= maxCount) break
    const { categoryName, forecast, comparison, percentage } = entry

    if (forecast.hasEnoughData && forecast.projectedOverrun > 0 && percentage < 100) {
      insights.push({
        type: 'projected_overrun',
        categoryName,
        message: `Al ritmo attuale supererai il budget ${categoryName} di circa ${eur(forecast.projectedOverrun)}.`,
        priority: 1,
      })
      coveredCats.add(categoryName)
      if (insights.length >= maxCount) break
    }

    if (!coveredCats.has(categoryName) && forecast.hasEnoughData && forecast.daysElapsed < 10 && percentage > 40) {
      insights.push({
        type: 'early_month_high_spend',
        categoryName,
        message: `Nei primi ${forecast.daysElapsed} giorni hai già usato il ${percentage}% del budget ${categoryName}.`,
        priority: 2,
      })
      coveredCats.add(categoryName)
      if (insights.length >= maxCount) break
    }

    if (!coveredCats.has(categoryName) && percentage >= 75 && percentage < 100) {
      insights.push({
        type: 'budget_almost_exhausted',
        categoryName,
        message: `Il budget ${categoryName} è all'${percentage}%: monitoralo da vicino.`,
        priority: 2,
      })
      coveredCats.add(categoryName)
      if (insights.length >= maxCount) break
    }

    if (comparison.trend === 'down' && comparison.absoluteDiff < -5) {
      insights.push({
        type: 'spending_down_vs_last_month',
        categoryName,
        message: `Hai speso il ${Math.abs(comparison.percentageDiff)}% in meno per ${categoryName} rispetto al mese scorso.`,
        priority: 3,
      })
      coveredCats.add(categoryName)
      if (insights.length >= maxCount) break
    }
  }

  // Fill remaining slots with spending_up
  for (const entry of entries) {
    if (insights.length >= maxCount) break
    const { categoryName, comparison, percentage } = entry
    if (
      comparison.trend === 'up' &&
      comparison.percentageDiff > 20 &&
      percentage < 75 &&
      !coveredCats.has(categoryName)
    ) {
      insights.push({
        type: 'spending_up_vs_last_month',
        categoryName,
        message: `Stai spendendo il ${comparison.percentageDiff}% in più per ${categoryName} rispetto al mese scorso.`,
        priority: 4,
      })
      coveredCats.add(categoryName)
    }
  }

  return insights.sort((a, b) => a.priority - b.priority).slice(0, maxCount)
}

/**
 * Generates insights from 12-month history (used in detail page).
 * categoryName is set by the caller after calling this function.
 */
export function buildBudgetHistoryInsights(
  history: BudgetHistoryPoint[],
  maxCount = 5,
): BudgetInsight[] {
  const insights: BudgetInsight[] = []
  const withBudget = history.filter((h) => h.hadBudget)
  if (withBudget.length === 0) return insights

  const last6 = withBudget.slice(-6)
  const overrunCount = last6.filter((h) => h.status === 'exceeded').length
  if (overrunCount >= 2) {
    insights.push({
      type: 'repeated_overrun',
      categoryName: '',
      message: `Hai superato questo budget in ${overrunCount} degli ultimi ${last6.length} mesi.`,
      priority: 1,
    })
  }

  const last3  = withBudget.slice(-3)
  const allSafe = last3.length >= 3 && last3.every((h) => h.status === 'safe')
  if (allSafe) {
    insights.push({
      type: 'consistently_within_budget',
      categoryName: '',
      message: `Sei rimasto sotto budget per 3 mesi consecutivi.`,
      priority: 3,
    })
  }

  if (withBudget.length >= 3) {
    const spends = withBudget.map((h) => h.spent)
    const minSpent = Math.min(...spends)
    const maxSpent = Math.max(...spends)

    const bestPoint = withBudget.find((h) => h.spent === minSpent)
    if (bestPoint) {
      insights.push({
        type: 'best_month_in_period',
        categoryName: '',
        message: `La spesa più bassa degli ultimi ${history.length} mesi: ${eur(bestPoint.spent)}.`,
        priority: 4,
      })
    }

    if (maxSpent !== minSpent) {
      const worstPoint = withBudget.find((h) => h.spent === maxSpent)
      if (worstPoint) {
        insights.push({
          type: 'worst_month_in_period',
          categoryName: '',
          message: `Picco di spesa negli ultimi ${history.length} mesi: ${eur(worstPoint.spent)}.`,
          priority: 5,
        })
      }
    }
  }

  return insights.sort((a, b) => a.priority - b.priority).slice(0, maxCount)
}

/**
 * Computes 12-month history for a category from bulk-loaded data.
 * Exported for use in both service functions and tests.
 */
export function computeBudgetHistory(
  categoryId: string,
  childIds: string[],
  pastBudgets: Array<{ year: number; month: number; amount: number | string }>,
  allTxs: Array<{ category_id: string | null; amount: number | string; date: string }>,
  now: Date,
): BudgetHistoryPoint[] {
  const allCatIds = new Set([categoryId, ...childIds])
  const result: BudgetHistoryPoint[] = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1

    const budget       = pastBudgets.find((b) => b.year === y && b.month === m)
    const budgetAmount = budget ? round2(Number(budget.amount)) : 0

    const mm    = String(m).padStart(2, '0')
    const last  = new Date(y, m, 0).getDate()
    const start = `${y}-${mm}-01`
    const end   = `${y}-${mm}-${String(last).padStart(2, '0')}`

    const monthTxs = allTxs.filter(
      (tx) => tx.date >= start && tx.date <= end && tx.category_id && allCatIds.has(tx.category_id),
    )

    const spent      = round2(monthTxs.reduce((s, tx) => s + Number(tx.amount), 0))
    const remaining  = round2(budgetAmount - spent)
    const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0

    result.push({
      year: y,
      month: m,
      budgetAmount,
      spent,
      remaining,
      percentage,
      status: budgetAmount > 0 ? getBudgetStatus(percentage) : 'safe',
      hadBudget: Boolean(budget),
    })
  }

  return result
}

/**
 * Wraps BudgetSummary with enriched forecast/alert/insight data.
 */
export function computeEnrichedBudgetSummary(
  base: BudgetSummary,
  entries: EnrichedBudgetEntry[],
  alerts: BudgetAlert[],
  insights: BudgetInsight[],
): EnrichedBudgetSummary {
  const withData = entries.filter((e) => e.forecast.hasEnoughData)

  const projectedTotalSpent   = round2(withData.reduce((s, e) => s + e.forecast.projectedSpent, 0))
  const projectedTotalOverrun = round2(withData.reduce((s, e) => s + e.forecast.projectedOverrun, 0))
  const projectedAtRiskCount  = withData.filter((e) => e.forecast.projectedStatus !== 'safe').length

  const topProjectedRisks = withData
    .filter((e) => e.forecast.projectedOverrun > 0)
    .sort((a, b) => b.forecast.projectedOverrun - a.forecast.projectedOverrun)
    .slice(0, 3)
    .map((e) => ({
      categoryName:        e.categoryName,
      projectedSpent:      e.forecast.projectedSpent,
      amount:              e.amount,
      projectedOverrun:    e.forecast.projectedOverrun,
      projectedPercentage: e.forecast.projectedPercentage,
    }))

  return {
    ...base,
    projectedTotalSpent,
    projectedTotalOverrun,
    projectedAtRiskCount,
    topProjectedRisks,
    budgetAlerts:   alerts,
    budgetInsights: insights,
  }
}

// ── DB queries ────────────────────────────────────────────────────────────────

function monthBounds(year: number, month: number): { start: string; end: string } {
  const mm   = String(month).padStart(2, '0')
  const last = new Date(year, month, 0).getDate()
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, '0')}` }
}

export async function listMonthlyBudgets(
  supabase: SupabaseClient,
  year: number,
  month: number,
): Promise<BudgetEntry[]> {
  const [{ data: budgets, error: bErr }, { data: categories, error: cErr }] = await Promise.all([
    supabase.from('budgets').select('id,category_id,amount').eq('year', year).eq('month', month),
    supabase.from('categories').select('id,name,icon,parent_id'),
  ])

  if (bErr) throw bErr
  if (cErr) throw cErr
  if (!budgets?.length) return []

  const cats = (categories ?? []) as RawCategory[]

  const childrenOf = new Map<string, string[]>()
  for (const c of cats) {
    if (c.parent_id) {
      const arr = childrenOf.get(c.parent_id) ?? []
      arr.push(c.id)
      childrenOf.set(c.parent_id, arr)
    }
  }

  const neededIds = new Set<string>()
  for (const b of budgets) {
    neededIds.add(b.category_id)
    for (const cId of childrenOf.get(b.category_id) ?? []) neededIds.add(cId)
  }

  const { start, end } = monthBounds(year, month)
  const { data: txData } = await supabase
    .from('transactions')
    .select('category_id,amount')
    .in('category_id', [...neededIds])
    .eq('type', 'expense')
    .is('transfer_peer_id', null)
    .gte('date', start)
    .lte('date', end)

  return computeBudgetEntries(
    budgets as RawBudget[],
    cats,
    (txData ?? []) as RawTx[],
    year,
    month,
  )
}

/**
 * Like listMonthlyBudgets but also loads prev-month spending for comparison
 * and computes forecast + alerts per entry. 3 queries total — no N+1.
 */
export async function listMonthlyBudgetsEnriched(
  supabase: SupabaseClient,
  year: number,
  month: number,
  now: Date,
): Promise<EnrichedBudgetEntry[]> {
  const [{ data: budgets, error: bErr }, { data: categories, error: cErr }] = await Promise.all([
    supabase.from('budgets').select('id,category_id,amount').eq('year', year).eq('month', month),
    supabase.from('categories').select('id,name,icon,parent_id'),
  ])

  if (bErr) throw bErr
  if (cErr) throw cErr
  if (!budgets?.length) return []

  const cats = (categories ?? []) as RawCategory[]

  const childrenOf = new Map<string, string[]>()
  for (const c of cats) {
    if (c.parent_id) {
      const arr = childrenOf.get(c.parent_id) ?? []
      arr.push(c.id)
      childrenOf.set(c.parent_id, arr)
    }
  }

  const neededIds = new Set<string>()
  for (const b of budgets) {
    neededIds.add(b.category_id)
    for (const cId of childrenOf.get(b.category_id) ?? []) neededIds.add(cId)
  }

  const { start: curStart, end: curEnd } = monthBounds(year, month)
  const prevDate  = new Date(year, month - 2, 1)
  const { start: prevStart, end: prevEnd } = monthBounds(prevDate.getFullYear(), prevDate.getMonth() + 1)

  const [{ data: curTxData }, { data: prevTxData }] = await Promise.all([
    supabase
      .from('transactions')
      .select('category_id,amount')
      .in('category_id', [...neededIds])
      .eq('type', 'expense')
      .is('transfer_peer_id', null)
      .gte('date', curStart)
      .lte('date', curEnd),
    supabase
      .from('transactions')
      .select('category_id,amount')
      .in('category_id', [...neededIds])
      .eq('type', 'expense')
      .is('transfer_peer_id', null)
      .gte('date', prevStart)
      .lte('date', prevEnd),
  ])

  const catById = new Map<string, RawCategory>(cats.map((c) => [c.id, c]))

  const baseEntries = computeBudgetEntries(
    budgets as RawBudget[],
    cats,
    (curTxData ?? []) as RawTx[],
    year,
    month,
  )

  const prevSpentByRawCat: Record<string, number> = {}
  for (const tx of (prevTxData ?? []) as RawTx[]) {
    if (!tx.category_id) continue
    prevSpentByRawCat[tx.category_id] = (prevSpentByRawCat[tx.category_id] ?? 0) + Number(tx.amount)
  }

  const forecasts = new Map<string, BudgetForecast>()
  const enriched: EnrichedBudgetEntry[] = baseEntries.map((entry) => {
    const forecast = buildBudgetForecast(entry.spent, entry.amount, year, month, now)
    forecasts.set(entry.categoryId, forecast)

    const cat    = catById.get(entry.categoryId)
    const isRoot = !cat?.parent_id

    let prevSpent = prevSpentByRawCat[entry.categoryId] ?? 0
    if (isRoot) {
      for (const childId of childrenOf.get(entry.categoryId) ?? []) {
        prevSpent += prevSpentByRawCat[childId] ?? 0
      }
    }

    return { ...entry, forecast, comparison: buildBudgetComparison(entry.spent, round2(prevSpent)), topAlert: null }
  })

  const alerts = buildBudgetAlerts(enriched, forecasts)
  for (const entry of enriched) {
    const alert = alerts.find((a) => a.categoryName === entry.categoryName)
    entry.topAlert = alert ?? null
  }

  return enriched
}

/**
 * Full budget detail: entry, forecast, comparison, 12-month history,
 * alerts, insights, up to 50 contributing transactions.
 * Uses 3 bulk queries — no N+1.
 */
export async function getBudgetDetail(
  supabase: SupabaseClient,
  budgetId: string,
): Promise<BudgetDetailPayload | null> {
  const { data: budget } = await supabase
    .from('budgets')
    .select('id,category_id,year,month,amount')
    .eq('id', budgetId)
    .maybeSingle()

  if (!budget) return null

  const { data: allCats } = await supabase
    .from('categories')
    .select('id,name,icon,parent_id')

  const cats    = (allCats ?? []) as RawCategory[]
  const catById = new Map<string, RawCategory>(cats.map((c) => [c.id, c]))
  const cat     = catById.get(budget.category_id)
  const isRoot  = !cat?.parent_id

  const childrenOf = new Map<string, string[]>()
  for (const c of cats) {
    if (c.parent_id) {
      const arr = childrenOf.get(c.parent_id) ?? []
      arr.push(c.id)
      childrenOf.set(c.parent_id, arr)
    }
  }

  const childIds  = isRoot ? (childrenOf.get(budget.category_id) ?? []) : []
  const allCatIds = [budget.category_id, ...childIds]

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const startStr = twelveMonthsAgo.toLocaleDateString('en-CA')
  const endStr   = now.toLocaleDateString('en-CA')

  const [{ data: txData }, { data: budgetHistory }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id,account_id,category_id,amount,description,date')
      .in('category_id', allCatIds)
      .eq('type', 'expense')
      .is('transfer_peer_id', null)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: false }),
    supabase
      .from('budgets')
      .select('year,month,amount')
      .eq('category_id', budget.category_id)
      .gte('year', twelveMonthsAgo.getFullYear())
      .order('year', { ascending: true })
      .order('month', { ascending: true }),
  ])

  const accountIds = [...new Set(((txData ?? []) as any[]).map((t) => t.account_id as string))]
  const { data: accsData } = accountIds.length
    ? await supabase.from('accounts').select('id,name').in('id', accountIds)
    : { data: [] }

  const accById = new Map<string, string>(
    ((accsData ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name]),
  )

  const curYear  = budget.year as number
  const curMonth = budget.month as number
  const amount   = round2(Number(budget.amount))
  const { start: curStart, end: curEnd } = monthBounds(curYear, curMonth)

  const curMonthTxs = ((txData ?? []) as any[]).filter((tx) => tx.date >= curStart && tx.date <= curEnd)
  const spent = round2(curMonthTxs.reduce((s: number, tx: any) => s + Number(tx.amount), 0))

  const prevDate  = new Date(curYear, curMonth - 2, 1)
  const { start: prevStart, end: prevEnd } = monthBounds(prevDate.getFullYear(), prevDate.getMonth() + 1)
  const prevTxs   = ((txData ?? []) as any[]).filter((tx) => tx.date >= prevStart && tx.date <= prevEnd)
  const prevSpent = round2(prevTxs.reduce((s: number, tx: any) => s + Number(tx.amount), 0))

  const parentCat = cat?.parent_id ? catById.get(cat.parent_id) : undefined
  const percentage = amount > 0 ? Math.round((spent / amount) * 100) : 0

  const entry: BudgetEntry = {
    budgetId:           budget.id,
    categoryId:         budget.category_id,
    categoryName:       cat?.name ?? 'Categoria',
    categoryIcon:       cat?.icon ?? null,
    parentCategoryName: parentCat?.name ?? null,
    year:               curYear,
    month:              curMonth,
    amount,
    spent,
    remaining:  round2(amount - spent),
    percentage,
    status:     getBudgetStatus(percentage),
  }

  const forecast   = buildBudgetForecast(spent, amount, curYear, curMonth, now)
  const comparison = buildBudgetComparison(spent, prevSpent)
  const forecasts  = new Map([[entry.categoryId, forecast]])

  const alerts = buildBudgetAlerts(
    [{ categoryId: entry.categoryId, categoryName: entry.categoryName, spent, amount, percentage }],
    forecasts,
  )

  const history = computeBudgetHistory(
    budget.category_id,
    childIds,
    (budgetHistory ?? []) as Array<{ year: number; month: number; amount: number }>,
    ((txData ?? []) as any[]).map((tx) => ({
      category_id: tx.category_id,
      amount:      tx.amount,
      date:        tx.date,
    })),
    now,
  )

  const enriched: EnrichedBudgetEntry = { ...entry, forecast, comparison, topAlert: alerts[0] ?? null }
  const currentInsights = buildBudgetInsights([enriched], 3)
  const historyInsights = buildBudgetHistoryInsights(history, 5)
    .map((i) => ({ ...i, categoryName: entry.categoryName }))
  const insights = [...currentInsights, ...historyInsights]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5)

  const transactions: BudgetDetailTransaction[] = curMonthTxs.slice(0, 50).map((tx: any) => {
    const txCat = catById.get(tx.category_id)
    return {
      id:            tx.id,
      date:          tx.date,
      description:   tx.description ?? null,
      amount:        round2(Number(tx.amount)),
      categoryName:  txCat?.name ?? 'Categoria',
      categoryIcon:  txCat?.icon ?? null,
      accountName:   accById.get(tx.account_id) ?? 'Conto',
      isSubcategory: tx.category_id !== budget.category_id,
    }
  })

  return { budget: entry, forecast, comparison, history, alerts, insights, transactions }
}

/** Returns 12-month history for a budget (standalone endpoint). */
export async function getBudgetHistory(
  supabase: SupabaseClient,
  budgetId: string,
): Promise<{ history: BudgetHistoryPoint[]; categoryName: string } | null> {
  const { data: budget } = await supabase
    .from('budgets')
    .select('id,category_id,year,month,amount')
    .eq('id', budgetId)
    .maybeSingle()

  if (!budget) return null

  const { data: allCats } = await supabase
    .from('categories')
    .select('id,name,icon,parent_id')

  const cats    = (allCats ?? []) as RawCategory[]
  const catById = new Map<string, RawCategory>(cats.map((c) => [c.id, c]))
  const cat     = catById.get(budget.category_id)
  const isRoot  = !cat?.parent_id

  const childrenOf = new Map<string, string[]>()
  for (const c of cats) {
    if (c.parent_id) {
      const arr = childrenOf.get(c.parent_id) ?? []
      arr.push(c.id)
      childrenOf.set(c.parent_id, arr)
    }
  }

  const childIds  = isRoot ? (childrenOf.get(budget.category_id) ?? []) : []
  const allCatIds = [budget.category_id, ...childIds]

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const startStr = twelveMonthsAgo.toLocaleDateString('en-CA')
  const endStr   = now.toLocaleDateString('en-CA')

  const [{ data: txData }, { data: pastBudgets }] = await Promise.all([
    supabase
      .from('transactions')
      .select('category_id,amount,date')
      .in('category_id', allCatIds)
      .eq('type', 'expense')
      .is('transfer_peer_id', null)
      .gte('date', startStr)
      .lte('date', endStr),
    supabase
      .from('budgets')
      .select('year,month,amount')
      .eq('category_id', budget.category_id)
      .gte('year', twelveMonthsAgo.getFullYear())
      .order('year', { ascending: true })
      .order('month', { ascending: true }),
  ])

  const history = computeBudgetHistory(
    budget.category_id,
    childIds,
    (pastBudgets ?? []) as Array<{ year: number; month: number; amount: number }>,
    (txData ?? []) as Array<{ category_id: string | null; amount: number | string; date: string }>,
    now,
  )

  return { history, categoryName: cat?.name ?? 'Categoria' }
}

export async function createMonthlyBudget(
  supabase: SupabaseClient,
  params: { categoryId: string; year: number; month: number; amount: number },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('budgets')
    .insert({ category_id: params.categoryId, year: params.year, month: params.month, amount: params.amount })
    .select('id')
    .single()

  if (error) throw error
  return { id: data.id }
}

export async function updateMonthlyBudget(
  supabase: SupabaseClient,
  budgetId: string,
  params: { amount: number },
): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .update({ amount: params.amount })
    .eq('id', budgetId)

  if (error) throw error
}

export async function deleteMonthlyBudget(
  supabase: SupabaseClient,
  budgetId: string,
): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId)

  if (error) throw error
}
