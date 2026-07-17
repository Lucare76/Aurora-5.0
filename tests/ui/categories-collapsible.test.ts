import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  CollapsibleCategorySection,
  toggleExpandedCategoryIds,
} from '@/app/(app)/categories/collapsible-category-list'
import type { Category } from '@/types/database'

const categories = {
  home: category({ id: 'cat-home', name: 'Casa', icon: '🏠' }),
  rent: category({ id: 'cat-rent', name: 'Affitto', parent_id: 'cat-home', icon: '🏡' }),
  bills: category({ id: 'cat-bills', name: 'Bollette', parent_id: 'cat-home', icon: '💡' }),
  food: category({ id: 'cat-food', name: 'Alimentari', icon: '🛒' }),
  grocery: category({ id: 'cat-grocery', name: 'Supermercato', parent_id: 'cat-food', icon: '🛍️' }),
  transport: category({ id: 'cat-transport', name: 'Trasporti', icon: '🚗' }),
}

const tree = [
  { category: categories.home, children: [categories.rent, categories.bills] },
  { category: categories.food, children: [categories.grocery] },
  { category: categories.transport, children: [] },
]

describe('categorie collassabili', () => {
  it('renderizza le categorie padre collassate di default e nasconde le sottocategorie', () => {
    const html = renderSection()

    expect(html).toContain('Casa')
    expect(html).toContain('Alimentari')
    expect(html).toContain('Trasporti')
    expect(html).not.toContain('Affitto')
    expect(html).not.toContain('Bollette')
    expect(html).not.toContain('Supermercato')
    expect(html).toContain('aria-label="Espandi Casa"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('espande e richiude una categoria usando la stessa transizione di stato della pagina', () => {
    const opened = toggleExpandedCategoryIds(new Set(), categories.home.id)
    expect(opened.has(categories.home.id)).toBe(true)

    const openedHtml = renderSection(opened)
    expect(openedHtml).toContain('Affitto')
    expect(openedHtml).toContain('Bollette')
    expect(openedHtml).toContain('aria-label="Comprimi Casa"')
    expect(openedHtml).toContain('aria-expanded="true"')

    const closed = toggleExpandedCategoryIds(opened, categories.home.id)
    expect(closed.has(categories.home.id)).toBe(false)

    const closedHtml = renderSection(closed)
    expect(closedHtml).not.toContain('Affitto')
    expect(closedHtml).not.toContain('Bollette')
    expect(closedHtml).toContain('aria-label="Espandi Casa"')
  })

  it('gestisce apertura e chiusura indipendente di due categorie padre', () => {
    const homeOpen = toggleExpandedCategoryIds(new Set(), categories.home.id)
    const bothOpen = toggleExpandedCategoryIds(homeOpen, categories.food.id)

    expect(renderSection(homeOpen)).toContain('Affitto')
    expect(renderSection(homeOpen)).not.toContain('Supermercato')

    const bothOpenHtml = renderSection(bothOpen)
    expect(bothOpenHtml).toContain('Affitto')
    expect(bothOpenHtml).toContain('Supermercato')

    const onlyFoodOpen = toggleExpandedCategoryIds(bothOpen, categories.home.id)
    const onlyFoodOpenHtml = renderSection(onlyFoodOpen)
    expect(onlyFoodOpenHtml).not.toContain('Affitto')
    expect(onlyFoodOpenHtml).toContain('Supermercato')
  })

  it('non mostra il pulsante di espansione per categorie senza sottocategorie', () => {
    const html = renderSection()

    expect(html).toContain('Trasporti')
    expect(html).not.toContain('aria-label="Espandi Trasporti"')
    expect(html).not.toContain('aria-label="Comprimi Trasporti"')
  })

  it('mostra ChevronRight quando chiusa e ChevronDown quando aperta', () => {
    const closedHtml = renderSection()
    expect(closedHtml).toContain('lucide-chevron-right')
    expect(closedHtml).not.toContain('lucide-chevron-down')

    const openHtml = renderSection(new Set([categories.home.id]))
    expect(openHtml).toContain('lucide-chevron-down')
  })

  it('mantiene utilizzabili le azioni modifica, sottocategoria ed elimina nel menu', () => {
    const html = renderSection(new Set(), categories.home.id)

    expect(html).toContain('Modifica')
    expect(html).toContain('Aggiungi sottocategoria')
    expect(html).toContain('Elimina')
  })

  it('non modifica categorie, sottocategorie o conteggi durante il rendering', () => {
    const snapshot = JSON.stringify({ tree, categories })
    const counts = { 'cat-home': 3, 'cat-rent': 2 }

    renderSection(new Set([categories.home.id]), null, counts)

    expect(JSON.stringify({ tree, categories })).toBe(snapshot)
    expect(counts).toEqual({ 'cat-home': 3, 'cat-rent': 2 })
  })
})

function renderSection(
  expandedCategoryIds = new Set<string>(),
  openMenuId: string | null = null,
  transactionCount: Record<string, number> = {},
): string {
  return renderToStaticMarkup(
    React.createElement(CollapsibleCategorySection, {
      title: 'Uscite',
      type: 'expense',
      items: tree,
      transactionCount,
      openMenuId,
      expandedCategoryIds,
      onToggleExpanded: vi.fn(),
      onToggleMenu: vi.fn(),
      onEdit: vi.fn(),
      onCreateChild: vi.fn(),
      onDelete: vi.fn(),
    }),
  )
}

function category(overrides: Partial<Category>): Category {
  return {
    id: 'cat',
    user_id: 'user-test',
    name: 'Categoria',
    type: 'expense',
    color: '#6366f1',
    icon: null,
    parent_id: null,
    is_default: false,
    sort_order: 0,
    created_at: '2026-07-17T00:00:00.000Z',
    ...overrides,
  }
}
