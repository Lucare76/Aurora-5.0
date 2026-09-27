import { describe, expect, it } from 'vitest'
import { sourceHealth } from '@/lib/patrimonio/source-health'

describe('patrimonio source health', () => {
  it('evidenzia solo i valori scaduti secondo la fonte e mostra l’ultimo rilevato', () => {
    const now = Date.parse('2026-09-27T10:00:00Z')
    const sources = sourceHealth([
      { id: 'one', name: 'ETF aggiornato', source_type: 'SCALABLE', observed_at: '2026-09-26T10:00:00Z' },
      { id: 'two', name: 'ETF da verificare', source_type: 'SCALABLE', observed_at: '2026-09-24T09:00:00Z' },
      { id: 'three', name: 'Buono', source_type: 'POSTE', observed_at: '2026-09-01T10:00:00Z' },
      { id: 'four', name: 'Moneyfarm', source_type: 'MANUAL', observed_at: '2026-09-19T09:00:00Z' },
    ], now)

    expect(sources[0]).toMatchObject({ count: 2, latest: '2026-09-26T10:00:00.000Z' })
    expect(sources[0].overdue.map(({ asset }) => asset.id)).toEqual(['two'])
    expect(sources[1].overdue).toHaveLength(0)
    expect(sources[2].overdue.map(({ asset }) => asset.id)).toEqual(['four'])
  })
})
