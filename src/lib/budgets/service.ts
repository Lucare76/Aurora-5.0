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

// ── Internal raw types (DB rows) ───────────────────────────────────────────────

type RawBudget   = { id: string; category_id: string; amount: number | string }
type RawCategory = { id: string; name: string; icon: string | null; parent_id: string | null }
type RawTx       = { category_id: string | null; amount: number | string }

// ── Pure helpers ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
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
 *   (legacy peer transfers have transfer_peer_id set; modern transfers use type='transfer')
 * - If budget category is a root category (parent_id IS NULL), spending includes
 *   all direct children as well (avoids needing a budget per-subcategory)
 * - If budget category is a child category, only that category's spending counts
 * - No double-counting: budgets are independent even if user has both parent and child budgets
 */
export function computeBudgetEntries(
  budgets: RawBudget[],
  categories: RawCategory[],
  expenseTxs: RawTx[],
  year: number,
  month: number,
): BudgetEntry[] {
  const catById = new Map<string, RawCategory>(categories.map((c) => [c.id, c]))

  // Build parent → [children IDs] map
  const childrenOf = new Map<string, string[]>()
  for (const c of categories) {
    if (c.parent_id) {
      const arr = childrenOf.get(c.parent_id) ?? []
      arr.push(c.id)
      childrenOf.set(c.parent_id, arr)
    }
  }

  // Sum spending per raw category_id
  const spentByRawCat: Record<string, number> = {}
  for (const tx of expenseTxs) {
    if (!tx.category_id) continue
    spentByRawCat[tx.category_id] = (spentByRawCat[tx.category_id] ?? 0) + Number(tx.amount)
  }

  return budgets
    .map((b) => {
      const cat = catById.get(b.category_id)
      const isRoot = !cat?.parent_id // no parent → root category

      // Root budgets roll up children's spending
      let spent = spentByRawCat[b.category_id] ?? 0
      if (isRoot) {
        for (const childId of childrenOf.get(b.category_id) ?? []) {
          spent += spentByRawCat[childId] ?? 0
        }
      }

      spent = round2(spent)
      const amount    = round2(Number(b.amount))
      const remaining = round2(amount - spent)
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

// ── DB queries ────────────────────────────────────────────────────────────────

function monthBounds(year: number, month: number): { start: string; end: string } {
  const mm    = String(month).padStart(2, '0')
  const last  = new Date(year, month, 0).getDate()
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

  // Collect all category IDs needed for tx query (budget cats + their children)
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
