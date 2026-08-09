import {
  TIMELINE_CATEGORIES,
  TIMELINE_IMPORTANCE,
  TIMELINE_MAX_TAG_LENGTH,
  TIMELINE_SUBJECTS,
  type TimelineCategory,
  type TimelineImportance,
  type TimelineSubject,
} from './constants'
import type { PersonalTimelineEvent, TimelineStatistics, TimelineYearGroup } from './types'

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function normalizeTimelineTags(input?: string[] | string | null): string[] {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of raw) {
    const tag = item
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, TIMELINE_MAX_TAG_LENGTH)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

export function sortTimelineEventsDesc(events: PersonalTimelineEvent[]): PersonalTimelineEvent[] {
  return [...events].sort((a, b) =>
    b.event_date.localeCompare(a.event_date) ||
    b.created_at.localeCompare(a.created_at) ||
    a.title.localeCompare(b.title),
  )
}

export function groupTimelineByYearMonth(events: PersonalTimelineEvent[], locale = 'it-IT'): TimelineYearGroup[] {
  const sorted = sortTimelineEventsDesc(events)
  const years = new Map<number, Map<string, PersonalTimelineEvent[]>>()
  for (const event of sorted) {
    const year = Number(event.event_date.slice(0, 4))
    const monthKey = event.event_date.slice(0, 7)
    if (!years.has(year)) years.set(year, new Map())
    const months = years.get(year)!
    months.set(monthKey, [...(months.get(monthKey) ?? []), event])
  }

  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, monthEvents]) => ({
          monthKey,
          monthLabel: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(`${monthKey}-01T00:00:00`)),
          events: monthEvents,
        })),
    }))
}

export function formatTimelinePeriod(event: Pick<PersonalTimelineEvent, 'event_date' | 'end_date'>, locale = 'it-IT'): string {
  const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const start = formatter.format(new Date(`${event.event_date}T00:00:00`))
  if (!event.end_date || event.end_date === event.event_date) return start
  return `${start} - ${formatter.format(new Date(`${event.end_date}T00:00:00`))}`
}

export function timelineStatistics(events: PersonalTimelineEvent[], today = new Date()): TimelineStatistics {
  const currentYear = today.getFullYear()
  const bySubject = Object.fromEntries(TIMELINE_SUBJECTS.map((subject) => [subject, 0])) as Record<TimelineSubject, number>
  const byCategory = Object.fromEntries(TIMELINE_CATEGORIES.map((category) => [category, 0])) as Record<TimelineCategory, number>

  for (const event of events) {
    bySubject[event.subject] += 1
    byCategory[event.category] += 1
  }

  const mostFrequentSubject = (Object.entries(bySubject) as Array<[TimelineSubject, number]>)
    .sort((a, b) => b[1] - a[1])[0]

  return {
    total: events.length,
    currentYear: events.filter((event) => Number(event.event_date.slice(0, 4)) === currentYear).length,
    bySubject,
    byCategory,
    mostFrequentSubject: mostFrequentSubject && mostFrequentSubject[1] > 0 ? mostFrequentSubject[0] : null,
  }
}

export function timelineFingerprint(event: Pick<PersonalTimelineEvent, 'event_date' | 'title' | 'subject' | 'category'>): string {
  return [
    event.event_date,
    normalizeFingerprintText(event.title),
    event.subject,
    event.category,
  ].join('|')
}

export function normalizeFingerprintText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function filterTimelineEvents(
  events: PersonalTimelineEvent[],
  filters: { subject?: TimelineSubject; category?: TimelineCategory; year?: number; search?: string },
): PersonalTimelineEvent[] {
  const q = filters.search?.trim().toLowerCase()
  return events.filter((event) => {
    if (filters.subject && event.subject !== filters.subject) return false
    if (filters.category && event.category !== filters.category) return false
    if (filters.year && Number(event.event_date.slice(0, 4)) !== filters.year) return false
    if (!q) return true
    return [event.title, event.description, event.location, event.provider].some((value) => value?.toLowerCase().includes(q))
  })
}

export function isTimelineSubject(value: string): value is TimelineSubject {
  return (TIMELINE_SUBJECTS as readonly string[]).includes(value)
}

export function isTimelineCategory(value: string): value is TimelineCategory {
  return (TIMELINE_CATEGORIES as readonly string[]).includes(value)
}

export function isTimelineImportance(value: string): value is TimelineImportance {
  return (TIMELINE_IMPORTANCE as readonly string[]).includes(value)
}
