import { describe, expect, it, vi } from 'vitest'
import { countOpenDataIntegrityIssuesBySeverity } from '@/lib/data-integrity/service'

describe('countOpenDataIntegrityIssuesBySeverity', () => {
  it('conta tutte le issue open per severity senza caricare righe', async () => {
    const supabase = mockSupabaseCounts({ CRITICAL: 2, WARNING: 8, INFO: 1 })

    const result = await countOpenDataIntegrityIssuesBySeverity(supabase as any, 'user-1')

    expect(result.persistenceAvailable).toBe(true)
    expect(result.summary.critical).toBe(2)
    expect(result.summary.warning).toBe(8)
    expect(result.summary.info).toBe(1)
    expect(result.summary.open).toBe(11)
    expect(result.summary.total).toBe(11)
    expect(supabase.from).toHaveBeenCalledTimes(3)
  })

  it('restituisce summary vuoto quando non ci sono issue open', async () => {
    const result = await countOpenDataIntegrityIssuesBySeverity(mockSupabaseCounts({ CRITICAL: 0, WARNING: 0, INFO: 0 }) as any, 'user-1')

    expect(result.persistenceAvailable).toBe(true)
    expect(result.summary.warning).toBe(0)
    expect(result.summary.info).toBe(0)
    expect(result.summary.statusLabel).toBe('Nessun dato')
  })

  it('sanitizza gli errori di query marcando la persistenza non disponibile', async () => {
    const result = await countOpenDataIntegrityIssuesBySeverity(mockSupabaseCounts({ CRITICAL: 0, WARNING: 0, INFO: 0 }, true) as any, 'user-1')

    expect(result.persistenceAvailable).toBe(false)
    expect(result.summary.open).toBe(0)
  })
})

function mockSupabaseCounts(counts: Record<string, number>, fail = false) {
  return {
    from: vi.fn(() => {
      let selectedSeverity = 'INFO'
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn((field: string, value: string) => {
          if (field === 'severity') selectedSeverity = value
          return builder
        }),
        then: (resolve: (value: unknown) => void) => resolve({
          count: fail ? null : counts[selectedSeverity] ?? 0,
          error: fail ? { message: 'query failed' } : null,
        }),
      }
      return builder
    }),
  }
}
