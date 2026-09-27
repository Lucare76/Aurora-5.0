import type { DeadlineRecurrence } from './constants'

/** Keep the original day where possible, clamping dates such as 29 February. */
export function nextRenewalDate(dueDate: string, recurrence: DeadlineRecurrence, interval: number): string {
  if (recurrence === 'NONE' || !Number.isInteger(interval) || interval < 1 || interval > 120) {
    throw new Error('Invalid recurrence')
  }
  const [year, month, day] = dueDate.split('-').map(Number)
  const months = recurrence === 'YEARLY' ? interval * 12 : interval
  const first = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(day, lastDay))
  return first.toISOString().slice(0, 10)
}
