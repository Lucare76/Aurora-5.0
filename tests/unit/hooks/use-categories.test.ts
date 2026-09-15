import { describe, expect, it } from 'vitest'
import { buildCategoryTree } from '@/hooks/use-categories'
import type { Category } from '@/types/database'

function cat(overrides: Partial<Category>): Category {
  return {
    id: 'id',
    user_id: 'user',
    name: 'name',
    type: 'expense',
    color: null,
    icon: null,
    parent_id: null,
    is_default: false,
    sort_order: 0,
    created_at: '',
    ...overrides,
  } as Category
}

const income = cat({ id: 'income', name: 'Stipendio', type: 'income' })
const expense = cat({ id: 'expense', name: 'Alimentari', type: 'expense' })
const both = cat({ id: 'both', name: 'Rimborsi', type: 'both' })
const categories = [income, expense, both]

describe('buildCategoryTree — filtro form manuale movimenti (FASE 4/12)', () => {
  it('per una transazione income, mostra solo categorie income e both', () => {
    const ids = buildCategoryTree(categories, 'income').map((n) => n.category.id)
    expect(ids).toContain('income')
    expect(ids).toContain('both')
    expect(ids).not.toContain('expense')
  })

  it('per una transazione expense, mostra solo categorie expense e both', () => {
    const ids = buildCategoryTree(categories, 'expense').map((n) => n.category.id)
    expect(ids).toContain('expense')
    expect(ids).toContain('both')
    expect(ids).not.toContain('income')
  })

  it('senza type esplicito, mostra tutte le categorie (comportamento invariato)', () => {
    const ids = buildCategoryTree(categories).map((n) => n.category.id)
    expect(ids.sort()).toEqual(['both', 'expense', 'income'])
  })

  it('non rompe le categorie type=both: compaiono sia nel tree income sia in quello expense', () => {
    expect(buildCategoryTree(categories, 'income').some((n) => n.category.id === 'both')).toBe(true)
    expect(buildCategoryTree(categories, 'expense').some((n) => n.category.id === 'both')).toBe(true)
  })

  it('filtra anche le sottocategorie in modo coerente col parent', () => {
    const childIncome = cat({ id: 'child-income', name: 'Bonus', type: 'income', parent_id: 'income' })
    const childExpense = cat({ id: 'child-expense', name: 'Carne', type: 'expense', parent_id: 'expense' })
    const tree = buildCategoryTree([...categories, childIncome, childExpense], 'income')
    const incomeNode = tree.find((n) => n.category.id === 'income')
    expect(incomeNode?.children.map((c) => c.id)).toEqual(['child-income'])
  })
})
