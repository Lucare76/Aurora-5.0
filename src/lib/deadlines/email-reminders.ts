import { dateAfterDays } from '@/lib/timeline/reminders'

export const DEADLINE_EMAIL_STAGES = [30, 14, 7, 3, 1, 0] as const

/** A configured lead time is the earliest day on which reminders may start. */
export function deadlineEmailStage(dueDate: string, today: string, leadDays: number): number | null {
  return DEADLINE_EMAIL_STAGES.find((days) => days <= leadDays && dateAfterDays(today, days) === dueDate) ?? null
}
