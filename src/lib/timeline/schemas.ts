import { z } from 'zod'
import {
  TIMELINE_CATEGORIES,
  TIMELINE_IMPORTANCE,
  TIMELINE_MAX_TAGS,
  TIMELINE_SUBJECTS,
} from './constants'
import { isValidDateOnly, normalizeTimelineTags } from './helpers'

const dateOnly = z.string().refine(isValidDateOnly, 'Data non valida.')
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

const timelineBaseSchema = z.object({
  title: z.string().trim().min(1, 'Il titolo è obbligatorio.').max(180, 'Titolo troppo lungo.'),
  subject: z.enum(TIMELINE_SUBJECTS),
  category: z.enum(TIMELINE_CATEGORIES),
  event_date: dateOnly,
  end_date: dateOnly.nullable().optional(),
  description: optionalText(2000),
  location: optionalText(160),
  provider: optionalText(160),
  tags: z.union([z.array(z.string()), z.string()]).optional().transform((value) => normalizeTimelineTags(value)).refine((tags) => tags.length <= TIMELINE_MAX_TAGS, 'Troppi tag.'),
  importance: z.enum(TIMELINE_IMPORTANCE).default('NORMAL'),
}).strict()

export const timelineInputSchema = timelineBaseSchema.superRefine((value, ctx) => {
  if (value.end_date && value.end_date < value.event_date) {
    ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'La data fine deve essere successiva o uguale alla data iniziale.' })
  }
})

export const timelinePatchSchema = timelineBaseSchema.partial().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({ code: 'custom', message: 'Nessuna modifica.' })
  }
  if (value.event_date && value.end_date && value.end_date < value.event_date) {
    ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'La data fine deve essere successiva o uguale alla data iniziale.' })
  }
})

export const timelineQuerySchema = z.object({
  subject: z.enum(TIMELINE_SUBJECTS).optional(),
  category: z.enum(TIMELINE_CATEGORIES).optional(),
  year: z.coerce.number().int().min(1900).max(3000).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  offset: z.coerce.number().int().min(0).default(0),
}).strict()

export type TimelineInput = z.infer<typeof timelineInputSchema>
export type TimelinePatch = z.infer<typeof timelinePatchSchema>
export type TimelineQuery = z.infer<typeof timelineQuerySchema>
