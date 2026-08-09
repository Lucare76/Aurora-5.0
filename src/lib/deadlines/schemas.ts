import { z } from 'zod'
import { DEADLINE_CATEGORIES, DEADLINE_PRIORITIES, DEADLINE_RECURRENCES, DEADLINE_REMINDER_OPTIONS, DEADLINE_STATUSES } from './constants'
import { isValidDateOnly } from './date-only'

const dateOnly = z.string().refine(isValidDateOnly, 'Data non valida.')
const reminder = z.number().int().refine((value) => (DEADLINE_REMINDER_OPTIONS as readonly number[]).includes(value), 'Promemoria non valido.')

export const deadlineInputSchema = z.object({
  title: z.string().trim().min(1, 'Il titolo è obbligatorio.').max(160, 'Titolo troppo lungo.'),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.enum(DEADLINE_CATEGORIES),
  due_date: dateOnly,
  status: z.enum(DEADLINE_STATUSES).optional(),
  priority: z.enum(DEADLINE_PRIORITIES).default('NORMAL'),
  recurrence: z.enum(DEADLINE_RECURRENCES).default('NONE'),
  reminder_days_before: reminder.default(7),
}).strict()

export const deadlinePatchSchema = deadlineInputSchema.partial().extend({
  status: z.enum(DEADLINE_STATUSES).optional(),
  completed_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Nessuna modifica.')

export type DeadlineInput = z.infer<typeof deadlineInputSchema>
export type DeadlinePatch = z.infer<typeof deadlinePatchSchema>
