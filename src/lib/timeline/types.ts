import type { TimelineCategory, TimelineImportance, TimelineSubject } from './constants'

export type PersonalTimelineEvent = {
  id: string
  user_id: string
  event_date: string
  end_date: string | null
  title: string
  description: string | null
  category: TimelineCategory
  subject: TimelineSubject
  location: string | null
  provider: string | null
  tags: string[]
  importance: TimelineImportance
  created_at: string
  updated_at: string
}

export type TimelineYearGroup = {
  year: number
  months: TimelineMonthGroup[]
}

export type TimelineMonthGroup = {
  monthKey: string
  monthLabel: string
  events: PersonalTimelineEvent[]
}

export type TimelineStatistics = {
  total: number
  currentYear: number
  bySubject: Record<TimelineSubject, number>
  byCategory: Record<TimelineCategory, number>
  mostFrequentSubject: TimelineSubject | null
}
