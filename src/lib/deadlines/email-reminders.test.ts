import { describe, expect, it } from 'vitest'
import { deadlineEmailStage } from './email-reminders'

describe('deadline email reminders', () => {
  it('sends 30, 14, 7, 3, 1 and day-of reminders within a 30-day setting', () => {
    for (const days of [30, 14, 7, 3, 1, 0]) {
      const date = new Date('2026-09-27T00:00:00Z')
      date.setUTCDate(date.getUTCDate() + days)
      expect(deadlineEmailStage(date.toISOString().slice(0, 10), '2026-09-27', 30)).toBe(days)
    }
  })

  it('respects the chosen lead and skips other dates', () => {
    expect(deadlineEmailStage('2026-10-11', '2026-09-27', 15)).toBe(14)
    expect(deadlineEmailStage('2026-10-11', '2026-09-27', 7)).toBeNull()
    expect(deadlineEmailStage('2026-09-29', '2026-09-27', 30)).toBeNull()
    expect(deadlineEmailStage('2026-09-26', '2026-09-27', 30)).toBeNull()
    expect(deadlineEmailStage('2026-09-27', '2026-09-27', 0)).toBe(0)
  })
})
