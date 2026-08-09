import { describe, expect, it } from 'vitest'
import {
  classifyDeadlineTemporalStatus,
  deadlineStats,
  daysBetweenDateOnly,
  daysUntilDeadline,
  isValidDateOnly,
  shouldRemind,
  sortDeadlines,
  todayDateOnly,
} from '@/lib/deadlines'
import type { PersonalDeadline } from '@/types/database'

const base = {
  id: '1',
  user_id: 'user-1',
  title: 'Scadenza',
  description: null,
  category: 'VEHICLE',
  priority: 'NORMAL',
  recurrence: 'NONE',
  reminder_days_before: 7,
  completed_at: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
} satisfies Omit<PersonalDeadline, 'due_date' | 'status'>

function deadline(overrides: Partial<PersonalDeadline>): PersonalDeadline {
  return { ...base, due_date: '2026-08-10', status: 'ACTIVE', ...overrides } as PersonalDeadline
}

describe('personal deadlines helpers', () => {
  it('classifica scaduta, oggi, imminente e futura', () => {
    expect(classifyDeadlineTemporalStatus(deadline({ due_date: '2026-08-08' }), '2026-08-09')).toBe('OVERDUE')
    expect(classifyDeadlineTemporalStatus(deadline({ due_date: '2026-08-09' }), '2026-08-09')).toBe('TODAY')
    expect(classifyDeadlineTemporalStatus(deadline({ due_date: '2026-08-16' }), '2026-08-09')).toBe('UPCOMING')
    expect(classifyDeadlineTemporalStatus(deadline({ due_date: '2026-10-01' }), '2026-08-09')).toBe('SCHEDULED')
  })

  it('completed e cancelled non sono attive', () => {
    expect(classifyDeadlineTemporalStatus(deadline({ status: 'COMPLETED', completed_at: '2026-08-09T10:00:00.000Z' }), '2026-08-09')).toBe('INACTIVE')
    expect(classifyDeadlineTemporalStatus(deadline({ status: 'CANCELLED' }), '2026-08-09')).toBe('INACTIVE')
    expect(deadlineStats([
      deadline({ status: 'COMPLETED', completed_at: '2026-08-09T10:00:00.000Z' }),
      deadline({ status: 'CANCELLED' }),
    ], '2026-08-09').activeTotal).toBe(0)
  })

  it('calcola giorni mancanti e reminder', () => {
    expect(daysUntilDeadline(deadline({ due_date: '2026-08-16' }), '2026-08-09')).toBe(7)
    expect(shouldRemind(deadline({ due_date: '2026-08-09', reminder_days_before: 0 }), '2026-08-09')).toBe(true)
    expect(shouldRemind(deadline({ due_date: '2026-08-16', reminder_days_before: 7 }), '2026-08-09')).toBe(true)
    expect(shouldRemind(deadline({ due_date: '2026-08-17', reminder_days_before: 7 }), '2026-08-09')).toBe(false)
  })

  it('ordina scadute, oggi e future per data crescente', () => {
    const sorted = sortDeadlines([
      deadline({ id: 'future', due_date: '2026-09-01' }),
      deadline({ id: 'overdue', due_date: '2026-08-01' }),
      deadline({ id: 'today', due_date: '2026-08-09' }),
    ], '2026-08-09')
    expect(sorted.map((item) => item.id)).toEqual(['overdue', 'today', 'future'])
  })

  it('calcola statistiche prossimi 30 giorni', () => {
    expect(deadlineStats([
      deadline({ due_date: '2026-08-01' }),
      deadline({ due_date: '2026-08-09' }),
      deadline({ due_date: '2026-09-08' }),
      deadline({ due_date: '2026-09-09' }),
    ], '2026-08-09')).toMatchObject({ overdue: 1, today: 1, next30Days: 2, activeTotal: 4 })
  })

  it('gestisce date civili senza slittamento timezone', () => {
    expect(isValidDateOnly('2026-08-31')).toBe(true)
    expect(daysBetweenDateOnly('2026-08-31', '2026-09-01')).toBe(1)
    expect(todayDateOnly(new Date('2026-08-31T23:30:00+02:00'))).toBe('2026-08-31')
  })
})
