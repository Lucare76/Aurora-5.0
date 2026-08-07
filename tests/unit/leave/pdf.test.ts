import { describe, expect, it } from 'vitest'

import { buildLeavePdf } from '@/lib/leave/pdf'
import type { LeaveEntry, LeaveSettings } from '@/types/database'

describe('leave PDF export', () => {
  it('genera un PDF con footer Aurora senza salvare dati', () => {
    const pdf = buildLeavePdf({
      kind: 'summary',
      year: 2026,
      settings: settings(),
      entries: [
        entry({ type: 'VACATION', start_date: '2026-08-01', end_date: '2026-08-10', days: 8 }),
        entry({ type: 'PERMIT_104', start_date: '2026-08-07', end_date: '2026-08-07', hours: 2.25 }),
      ],
    })

    const text = Buffer.from(pdf).toString('latin1')
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('Documento generato da Aurora')
    expect(text).toContain('Riepilogo annuale ferie e permessi')
  })
})

function settings(): LeaveSettings {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    user_id: '11111111-1111-4111-8111-111111111111',
    vacation_days_per_year: 30,
    permit_104_hours_per_month: 24,
    timezone: 'Europe/Rome',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function entry(overrides: Partial<LeaveEntry>): LeaveEntry {
  return {
    id: crypto.randomUUID(),
    user_id: '11111111-1111-4111-8111-111111111111',
    type: 'VACATION',
    start_date: '2026-01-01',
    end_date: '2026-01-01',
    days: null,
    hours: null,
    start_time: null,
    end_time: null,
    note: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
