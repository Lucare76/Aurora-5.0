import { describe, expect, it } from 'vitest'
import { dateAfterDays, localDate, reminderKey, reminderStage } from './reminders'

describe('timeline reminders', () => {
  it('fires only 14, 7 and 3 calendar days before the event', () => {
    expect(reminderStage('2026-10-11', '2026-09-27')).toBe(14)
    expect(reminderStage('2026-10-04', '2026-09-27')).toBe(7)
    expect(reminderStage('2026-09-30', '2026-09-27')).toBe(3)
    expect(reminderStage('2026-09-29', '2026-09-27')).toBeNull()
    expect(reminderStage('2026-09-26', '2026-09-27')).toBeNull()
  })

  it('handles leap years, month boundaries and Rome daylight saving time', () => {
    expect(dateAfterDays('2028-02-27', 3)).toBe('2028-03-01')
    expect(localDate(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-29')
    expect(localDate(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25')
    expect(reminderStage('2026-04-05', '2026-03-29')).toBe(7)
  })

  it('uses the event date and stage in its unique key', () => {
    expect(reminderKey('id', '2026-10-11', 14)).not.toBe(reminderKey('id', '2026-10-11', 7))
    expect(reminderKey('id', '2026-10-11', 14)).not.toBe(reminderKey('id', '2026-10-12', 14))
  })
})
