import { describe, expect, it } from 'vitest'
import { computeBudgetEntries, computeBudgetSummary, getBudgetStatus } from '@/lib/budgets/service'

// ── Fixtures ───────────────────────────────────────────────────────────────

const YEAR  = 2026
const MONTH = 7

const catAlimentari = { id: 'cat-1', name: 'Alimentari', icon: '🛒', parent_id: null }
const catFrutta     = { id: 'cat-1a', name: 'Frutta', icon: '🍎', parent_id: 'cat-1' }
const catVerdura    = { id: 'cat-1b', name: 'Verdura', icon: '🥦', parent_id: 'cat-1' }
const catBollette   = { id: 'cat-2', name: 'Bollette', icon: '💡', parent_id: null }
const catStipendio  = { id: 'cat-inc', name: 'Stipendio', icon: '💼', parent_id: null }

const budgetAlimentari = { id: 'b-1', category_id: 'cat-1', amount: 400 }
const budgetFrutta     = { id: 'b-2', category_id: 'cat-1a', amount: 100 }
const budgetBollette   = { id: 'b-3', category_id: 'cat-2', amount: 200 }

// ── getBudgetStatus ────────────────────────────────────────────────────────

describe('getBudgetStatus', () => {
  it('returns safe below 75%', () => {
    expect(getBudgetStatus(0)).toBe('safe')
    expect(getBudgetStatus(74)).toBe('safe')
  })
  it('returns warning at 75%–89%', () => {
    expect(getBudgetStatus(75)).toBe('warning')
    expect(getBudgetStatus(89)).toBe('warning')
  })
  it('returns critical at 90%–99%', () => {
    expect(getBudgetStatus(90)).toBe('critical')
    expect(getBudgetStatus(99)).toBe('critical')
  })
  it('returns exceeded at 100%+', () => {
    expect(getBudgetStatus(100)).toBe('exceeded')
    expect(getBudgetStatus(150)).toBe('exceeded')
  })
})

// ── computeBudgetEntries ───────────────────────────────────────────────────

describe('computeBudgetEntries', () => {
  it('returns empty array when no budgets', () => {
    const result = computeBudgetEntries([], [catAlimentari], [], YEAR, MONTH)
    expect(result).toHaveLength(0)
  })

  it('computes entry for a simple root category with no spending', () => {
    const [entry] = computeBudgetEntries([budgetAlimentari], [catAlimentari], [], YEAR, MONTH)
    expect(entry.categoryId).toBe('cat-1')
    expect(entry.categoryName).toBe('Alimentari')
    expect(entry.amount).toBe(400)
    expect(entry.spent).toBe(0)
    expect(entry.remaining).toBe(400)
    expect(entry.percentage).toBe(0)
    expect(entry.status).toBe('safe')
    expect(entry.parentCategoryName).toBeNull()
  })

  it('includes direct children spending in a root budget', () => {
    const txFrutta  = { category_id: 'cat-1a', amount: 60 }
    const txVerdura = { category_id: 'cat-1b', amount: 80 }

    const categories = [catAlimentari, catFrutta, catVerdura]
    const [entry] = computeBudgetEntries([budgetAlimentari], categories, [txFrutta, txVerdura], YEAR, MONTH)

    expect(entry.spent).toBe(140)
    expect(entry.remaining).toBe(260)
    expect(entry.percentage).toBe(35) // 140/400 = 35%
    expect(entry.status).toBe('safe')
  })

  it('includes own + children spending for root category', () => {
    const txDirect  = { category_id: 'cat-1',  amount: 100 }
    const txFrutta  = { category_id: 'cat-1a', amount: 200 }

    const categories = [catAlimentari, catFrutta]
    const [entry] = computeBudgetEntries([budgetAlimentari], categories, [txDirect, txFrutta], YEAR, MONTH)

    expect(entry.spent).toBe(300)
    expect(entry.percentage).toBe(75)
    expect(entry.status).toBe('warning')
  })

  it('child budget only counts own category (no parent rollup)', () => {
    const txFrutta  = { category_id: 'cat-1a', amount: 60 }
    const txVerdura = { category_id: 'cat-1b', amount: 999 }

    const categories = [catAlimentari, catFrutta, catVerdura]
    const entries = computeBudgetEntries([budgetFrutta], categories, [txFrutta, txVerdura], YEAR, MONTH)

    const entry = entries.find((e) => e.categoryId === 'cat-1a')!
    expect(entry.spent).toBe(60)
  })

  it('sets parentCategoryName for child category budget', () => {
    const categories = [catAlimentari, catFrutta]
    const [entry] = computeBudgetEntries([budgetFrutta], categories, [], YEAR, MONTH)
    expect(entry.parentCategoryName).toBe('Alimentari')
  })

  it('marks entry as exceeded when spending exceeds 100%', () => {
    const tx = { category_id: 'cat-2', amount: 250 }
    const [entry] = computeBudgetEntries([budgetBollette], [catBollette], [tx], YEAR, MONTH)
    expect(entry.percentage).toBe(125)
    expect(entry.status).toBe('exceeded')
    expect(entry.remaining).toBe(-50)
  })

  it('marks entry as critical at 95%', () => {
    const tx = { category_id: 'cat-2', amount: 190 }
    const [entry] = computeBudgetEntries([budgetBollette], [catBollette], [tx], YEAR, MONTH)
    expect(entry.percentage).toBe(95)
    expect(entry.status).toBe('critical')
  })

  it('excludes income transactions (caller must pre-filter; function trusts its input)', () => {
    // computeBudgetEntries does NOT filter by type — that is done upstream.
    // Here we verify that all passed txs are counted (behaviour contract).
    const tx = { category_id: 'cat-inc', amount: 3000 }
    const result = computeBudgetEntries(
      [{ id: 'b-inc', category_id: 'cat-inc', amount: 500 }],
      [catStipendio],
      [tx],
      YEAR,
      MONTH,
    )
    // The pure function counts it — filtering is the service/API caller's responsibility
    expect(result[0].spent).toBe(3000)
  })

  it('handles tx with null category_id gracefully', () => {
    const tx = { category_id: null, amount: 999 }
    const [entry] = computeBudgetEntries([budgetBollette], [catBollette], [tx], YEAR, MONTH)
    expect(entry.spent).toBe(0)
  })

  it('sorts entries: exceeded → critical → warning → safe', () => {
    const budgets = [
      { id: 'b-safe',     category_id: 'cat-s', amount: 1000 },
      { id: 'b-exceeded', category_id: 'cat-e', amount: 100 },
      { id: 'b-warning',  category_id: 'cat-w', amount: 200 },
      { id: 'b-critical', category_id: 'cat-c', amount: 300 },
    ]
    const categories = [
      { id: 'cat-s', name: 'Safe',     icon: null, parent_id: null },
      { id: 'cat-e', name: 'Exceeded', icon: null, parent_id: null },
      { id: 'cat-w', name: 'Warning',  icon: null, parent_id: null },
      { id: 'cat-c', name: 'Critical', icon: null, parent_id: null },
    ]
    const txs = [
      { category_id: 'cat-e', amount: 110 },
      { category_id: 'cat-w', amount: 160 },
      { category_id: 'cat-c', amount: 285 },
    ]
    const entries = computeBudgetEntries(budgets, categories, txs, YEAR, MONTH)
    expect(entries.map((e) => e.status)).toEqual(['exceeded', 'critical', 'warning', 'safe'])
  })

  it('no double-counting: parent and child budget are independent', () => {
    const tx = { category_id: 'cat-1a', amount: 50 }
    const categories = [catAlimentari, catFrutta]
    const entries = computeBudgetEntries(
      [budgetAlimentari, budgetFrutta],
      categories,
      [tx],
      YEAR,
      MONTH,
    )

    const parentEntry = entries.find((e) => e.categoryId === 'cat-1')!
    const childEntry  = entries.find((e) => e.categoryId === 'cat-1a')!

    // Parent budget rolls up children (50), child budget also counts 50 — but they are separate
    expect(parentEntry.spent).toBe(50)
    expect(childEntry.spent).toBe(50)
  })

  it('sets year and month on each entry', () => {
    const [entry] = computeBudgetEntries([budgetBollette], [catBollette], [], YEAR, MONTH)
    expect(entry.year).toBe(YEAR)
    expect(entry.month).toBe(MONTH)
  })
})

// ── computeBudgetSummary ───────────────────────────────────────────────────

describe('computeBudgetSummary', () => {
  it('returns zero summary for empty entries', () => {
    const s = computeBudgetSummary([])
    expect(s).toEqual({
      totalBudgets:  0,
      totalAmount:   0,
      totalSpent:    0,
      totalRemaining: 0,
      atRiskCount:   0,
      exceededCount: 0,
      topRiskBudgets: [],
    })
  })

  it('computes totals correctly', () => {
    const entries = computeBudgetEntries(
      [budgetAlimentari, budgetBollette],
      [catAlimentari, catBollette],
      [
        { category_id: 'cat-1', amount: 300 },
        { category_id: 'cat-2', amount: 250 },
      ],
      YEAR, MONTH,
    )
    const s = computeBudgetSummary(entries)
    expect(s.totalBudgets).toBe(2)
    expect(s.totalAmount).toBe(600)
    expect(s.totalSpent).toBe(550)
    expect(s.totalRemaining).toBe(50)
    expect(s.exceededCount).toBe(1)
    expect(s.atRiskCount).toBeGreaterThanOrEqual(1)
  })

  it('topRiskBudgets includes only non-safe entries, max 3', () => {
    const budgets = Array.from({ length: 5 }, (_, i) => ({
      id: `b${i}`, category_id: `c${i}`, amount: 100,
    }))
    const categories = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`, name: `Cat ${i}`, icon: null, parent_id: null,
    }))
    const txs = [
      { category_id: 'c0', amount: 110 }, // exceeded
      { category_id: 'c1', amount: 92 },  // critical
      { category_id: 'c2', amount: 80 },  // warning
      { category_id: 'c3', amount: 76 },  // warning
      { category_id: 'c4', amount: 10 },  // safe
    ]
    const entries = computeBudgetEntries(budgets, categories, txs, YEAR, MONTH)
    const s = computeBudgetSummary(entries)

    expect(s.topRiskBudgets).toHaveLength(3) // max 3
    expect(s.topRiskBudgets[0].status).toBe('exceeded')
    expect(s.topRiskBudgets[1].status).toBe('critical')
  })
})
