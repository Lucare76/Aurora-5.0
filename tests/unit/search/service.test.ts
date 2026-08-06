import { describe, expect, it } from 'vitest'
import { groupSearchResults, normalizeSearchQuery, scoreSearchResult, searchAurora } from '@/lib/search/service'
import type { SearchResult } from '@/lib/search/types'

const baseResult: SearchResult = {
  id: '1',
  type: 'GOAL',
  title: 'Vacanza',
  subtitle: '1.250 € di 2.500 €',
  metadata: ['risparmio', 'mare'],
  href: '/goals/1',
  score: 0,
}

describe('global search service', () => {
  it('normalizes whitespace and trims long queries', () => {
    expect(normalizeSearchQuery('  nuova   transazione  ')).toBe('nuova transazione')
    expect(normalizeSearchQuery('x'.repeat(120))).toHaveLength(100)
  })

  it('ranks exact, prefix, title, subtitle and metadata matches', () => {
    expect(scoreSearchResult('vacanza', baseResult)).toBe(100)
    expect(scoreSearchResult('vac', baseResult)).toBe(80)
    expect(scoreSearchResult('can', baseResult)).toBe(60)
    expect(scoreSearchResult('2500', baseResult)).toBe(40)
    expect(scoreSearchResult('mare', baseResult)).toBe(20)
  })

  it('matches accents and case deterministically', () => {
    expect(scoreSearchResult('caffe', { ...baseResult, title: 'Caffè' })).toBe(100)
    expect(scoreSearchResult('VACANZA', baseResult)).toBe(100)
  })

  it('groups, hides empty groups and caps results per group', () => {
    const results = Array.from({ length: 8 }, (_, index) => ({
      ...baseResult,
      id: String(index),
      title: `Vacanza ${index}`,
      type: 'GOAL' as const,
    }))
    const payload = groupSearchResults('vacanza', results)
    expect(payload.groups).toHaveLength(1)
    expect(payload.groups[0].label).toBe('Obiettivi')
    expect(payload.groups[0].results).toHaveLength(5)
    expect(payload.totalResults).toBe(5)
  })

  it('non espone conti ADI nella ricerca se l utente non è autorizzato', async () => {
    const supabase = searchSupabaseMock({
      accounts: [{ id: 'adi-account', name: 'Carta ADI', type: 'other', balance: 100, currency: 'EUR', is_active: true }],
      accountPurposeLinks: [{ account_id: 'adi-account', purpose: 'ADI' }],
    })

    const payload = await searchAurora(supabase as never, 'carta', 'user-1', { canAccessPrivateFinance: false })

    expect(payload.totalResults).toBe(0)
  })

  it('espone conti ADI nella ricerca solo se l utente è autorizzato', async () => {
    const supabase = searchSupabaseMock({
      accounts: [{ id: 'adi-account', name: 'Carta ADI', type: 'other', balance: 100, currency: 'EUR', is_active: true }],
      accountPurposeLinks: [{ account_id: 'adi-account', purpose: 'ADI' }],
    })

    const payload = await searchAurora(supabase as never, 'carta', 'user-1', { canAccessPrivateFinance: true })

    expect(payload.groups[0].results[0]).toMatchObject({
      title: 'Carta ADI',
      href: '/adi',
    })
  })

  it('non espone conti Aurora nella ricerca se l utente non è autorizzato', async () => {
    const supabase = searchSupabaseMock({
      accounts: [{ id: 'aurora-account', name: 'Aurora piano', type: 'savings', balance: 100, currency: 'EUR', is_active: true }],
      accountPurposeLinks: [{ account_id: 'aurora-account', purpose: 'DEPENDENT_AURORA' }],
    })

    const payload = await searchAurora(supabase as never, 'aurora', 'user-1', { canAccessPrivateFinance: false })

    expect(payload.totalResults).toBe(0)
  })
})

function searchSupabaseMock(data: { accounts?: unknown[]; accountPurposeLinks?: unknown[] }) {
  return {
    from(table: string) {
      return queryBuilder(table === 'accounts'
        ? data.accounts ?? []
        : table === 'account_purpose_links'
          ? data.accountPurposeLinks ?? []
          : [])
    },
  }
}

function queryBuilder(data: unknown[]) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'or', 'order', 'limit', 'in'] as const) {
    builder[method] = () => builder
  }
  ;(builder as { then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown }).then = (resolve) => resolve({ data, error: null })
  return builder
}
