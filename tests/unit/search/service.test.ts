import { describe, expect, it } from 'vitest'
import { groupSearchResults, normalizeSearchQuery, scoreSearchResult } from '@/lib/search/service'
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
})
