export const TIMELINE_REMINDER_DAYS = [14, 7, 3] as const

export function localDate(now: Date, timezone = 'Europe/Rome'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function dateAfterDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

export function reminderStage(eventDate: string, today: string): number | null {
  return TIMELINE_REMINDER_DAYS.find((days) => dateAfterDays(today, days) === eventDate) ?? null
}

export function reminderKey(id: string, eventDate: string, days: number): string {
  return `timeline:${id}:${eventDate}:${days}`
}
