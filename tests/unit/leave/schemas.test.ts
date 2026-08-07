import { describe, expect, it } from 'vitest'

import { leaveEntrySchema, leaveSettingsSchema } from '@/lib/leave/schemas'

describe('leave API schemas', () => {
  it('accetta ferie con giorni e senza ore', () => {
    expect(leaveEntrySchema.safeParse({
      type: 'VACATION',
      start_date: '2026-08-01',
      end_date: '2026-08-10',
      days: 8,
      hours: null,
      start_time: null,
      end_time: null,
      note: 'Ferie estive',
    }).success).toBe(true)
  })

  it('accetta permessi 104 con quarti d ora e senza giorni', () => {
    expect(leaveEntrySchema.safeParse({
      type: 'PERMIT_104',
      start_date: '2026-08-07',
      end_date: '2026-08-07',
      days: null,
      hours: 2.25,
      start_time: '09:00',
      end_time: '11:15',
      note: null,
    }).success).toBe(true)
  })

  it('rifiuta intervalli invertiti e campi contabili non previsti', () => {
    const parsed = leaveEntrySchema.safeParse({
      type: 'VACATION',
      start_date: '2026-08-10',
      end_date: '2026-08-01',
      days: 8,
      account_id: '22222222-2222-4222-8222-222222222222',
    })

    expect(parsed.success).toBe(false)
  })

  it('rifiuta permessi senza ore e ferie con ore', () => {
    expect(leaveEntrySchema.safeParse({
      type: 'PERMIT_104',
      start_date: '2026-08-07',
      end_date: '2026-08-07',
      days: null,
      hours: null,
    }).success).toBe(false)

    expect(leaveEntrySchema.safeParse({
      type: 'VACATION',
      start_date: '2026-08-01',
      end_date: '2026-08-01',
      days: 1,
      hours: 1,
    }).success).toBe(false)
  })

  it('valida impostazioni configurabili con default attesi lato database', () => {
    expect(leaveSettingsSchema.safeParse({
      vacation_days_per_year: 30,
      permit_104_hours_per_month: 24,
      timezone: 'Europe/Rome',
    }).success).toBe(true)
  })
})
