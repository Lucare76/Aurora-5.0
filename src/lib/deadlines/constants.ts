export const DEADLINE_CATEGORIES = ['VEHICLE', 'DOCUMENT', 'HEALTH', 'FAMILY', 'SCHOOL', 'SUBSCRIPTION', 'ADMINISTRATIVE', 'OTHER'] as const
export const DEADLINE_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const
export const DEADLINE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH'] as const
export const DEADLINE_RECURRENCES = ['NONE', 'MONTHLY', 'YEARLY'] as const
export const DEADLINE_REMINDER_OPTIONS = [0, 1, 3, 7, 15, 30] as const

export type DeadlineCategory = (typeof DEADLINE_CATEGORIES)[number]
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number]
export type DeadlinePriority = (typeof DEADLINE_PRIORITIES)[number]
export type DeadlineRecurrence = (typeof DEADLINE_RECURRENCES)[number]
export type DeadlineTemporalStatus = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'SCHEDULED' | 'INACTIVE'

export const DEADLINE_CATEGORY_LABELS: Record<DeadlineCategory, string> = {
  VEHICLE: 'Auto',
  DOCUMENT: 'Documenti',
  HEALTH: 'Salute',
  FAMILY: 'Famiglia',
  SCHOOL: 'Scuola',
  SUBSCRIPTION: 'Abbonamenti',
  ADMINISTRATIVE: 'Amministrative',
  OTHER: 'Altro',
}

export const DEADLINE_PRIORITY_LABELS: Record<DeadlinePriority, string> = {
  LOW: 'Bassa',
  NORMAL: 'Normale',
  HIGH: 'Alta',
}

export const DEADLINE_RECURRENCE_LABELS: Record<DeadlineRecurrence, string> = {
  NONE: 'Nessuna',
  MONTHLY: 'Mensile',
  YEARLY: 'Annuale',
}

export const DEADLINE_TEMPORAL_LABELS: Record<DeadlineTemporalStatus, string> = {
  OVERDUE: 'Scaduta',
  TODAY: 'Oggi',
  UPCOMING: 'Imminente',
  SCHEDULED: 'Programmata',
  INACTIVE: 'Storico',
}
