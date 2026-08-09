import {
  DEADLINE_TEMPORAL_LABELS,
  type DeadlineTemporalStatus,
} from './constants'
import { daysBetweenDateOnly, todayDateOnly } from './date-only'
import type { PersonalDeadline } from '@/types/database'

export * from './constants'
export * from './date-only'
export * from './schemas'

export function isActiveDeadline(deadline: Pick<PersonalDeadline, 'status'>): boolean {
  return deadline.status === 'ACTIVE'
}

export function daysUntilDeadline(deadline: Pick<PersonalDeadline, 'due_date'>, today = todayDateOnly()): number {
  return daysBetweenDateOnly(today, deadline.due_date)
}

export function classifyDeadlineTemporalStatus(
  deadline: Pick<PersonalDeadline, 'status' | 'due_date'>,
  today = todayDateOnly(),
  upcomingDays = 30,
): DeadlineTemporalStatus {
  if (!isActiveDeadline(deadline)) return 'INACTIVE'
  const days = daysUntilDeadline(deadline, today)
  if (days < 0) return 'OVERDUE'
  if (days === 0) return 'TODAY'
  if (days <= upcomingDays) return 'UPCOMING'
  return 'SCHEDULED'
}

export function shouldRemind(
  deadline: Pick<PersonalDeadline, 'status' | 'due_date' | 'reminder_days_before'>,
  today = todayDateOnly(),
): boolean {
  if (!isActiveDeadline(deadline)) return false
  const days = daysUntilDeadline(deadline, today)
  return days >= 0 && days <= deadline.reminder_days_before
}

const temporalRank: Record<DeadlineTemporalStatus, number> = {
  OVERDUE: 0,
  TODAY: 1,
  UPCOMING: 2,
  SCHEDULED: 3,
  INACTIVE: 4,
}

export function sortDeadlines(deadlines: PersonalDeadline[], today = todayDateOnly()): PersonalDeadline[] {
  return [...deadlines].sort((a, b) => {
    const rank = temporalRank[classifyDeadlineTemporalStatus(a, today)] - temporalRank[classifyDeadlineTemporalStatus(b, today)]
    if (rank !== 0) return rank
    return a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title)
  })
}

export function deadlineStats(deadlines: PersonalDeadline[], today = todayDateOnly()) {
  const active = deadlines.filter(isActiveDeadline)
  return {
    overdue: active.filter((item) => classifyDeadlineTemporalStatus(item, today) === 'OVERDUE').length,
    today: active.filter((item) => classifyDeadlineTemporalStatus(item, today) === 'TODAY').length,
    next30Days: active.filter((item) => {
      const days = daysUntilDeadline(item, today)
      return days >= 0 && days <= 30
    }).length,
    activeTotal: active.length,
  }
}

export function temporalStatusLabel(status: DeadlineTemporalStatus): string {
  return DEADLINE_TEMPORAL_LABELS[status]
}
