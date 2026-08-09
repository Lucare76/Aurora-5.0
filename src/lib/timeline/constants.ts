export const TIMELINE_SUBJECTS = ['SELF', 'AURORA', 'ILENIA', 'FAMILY'] as const
export const TIMELINE_CATEGORIES = ['HEALTH', 'THERAPY', 'SCHOOL', 'DOCUMENT', 'ADMINISTRATIVE', 'TRAVEL', 'FAMILY', 'MILESTONE', 'OTHER'] as const
export const TIMELINE_IMPORTANCE = ['LOW', 'NORMAL', 'HIGH'] as const

export type TimelineSubject = (typeof TIMELINE_SUBJECTS)[number]
export type TimelineCategory = (typeof TIMELINE_CATEGORIES)[number]
export type TimelineImportance = (typeof TIMELINE_IMPORTANCE)[number]

export const TIMELINE_SUBJECT_LABELS: Record<TimelineSubject, string> = {
  SELF: 'Io',
  AURORA: 'Aurora',
  ILENIA: 'Ilenia',
  FAMILY: 'Famiglia',
}

export const TIMELINE_CATEGORY_LABELS: Record<TimelineCategory, string> = {
  HEALTH: 'Salute',
  THERAPY: 'Terapia',
  SCHOOL: 'Scuola',
  DOCUMENT: 'Documenti',
  ADMINISTRATIVE: 'Amministrative',
  TRAVEL: 'Viaggi',
  FAMILY: 'Famiglia',
  MILESTONE: 'Traguardi',
  OTHER: 'Altro',
}

export const TIMELINE_IMPORTANCE_LABELS: Record<TimelineImportance, string> = {
  LOW: 'Bassa',
  NORMAL: 'Normale',
  HIGH: 'Alta',
}

export const TIMELINE_MAX_TAGS = 12
export const TIMELINE_MAX_TAG_LENGTH = 32
