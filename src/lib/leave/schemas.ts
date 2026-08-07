import { z } from 'zod'

export const leaveEntryTypeSchema = z.enum(['VACATION', 'PERMIT_104'])
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeOnly = z.string().regex(/^\d{2}:\d{2}$/).nullable().optional()

export const leaveSettingsSchema = z.object({
  vacation_days_per_year: z.number().min(0).max(365),
  permit_104_hours_per_month: z.number().min(0).max(744),
  timezone: z.string().trim().min(1).max(80),
}).strict()

export const leaveEntrySchema = z.object({
  type: leaveEntryTypeSchema,
  start_date: dateOnly,
  end_date: dateOnly,
  days: z.number().min(0).max(366).nullable().optional(),
  hours: z.number().min(0).max(24).multipleOf(0.25).nullable().optional(),
  start_time: timeOnly,
  end_time: timeOnly,
  note: z.string().trim().max(1000).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.end_date < value.start_date) {
    ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'La data fine non può precedere la data inizio.' })
  }
  if (value.type === 'VACATION') {
    if (value.days == null) ctx.addIssue({ code: 'custom', path: ['days'], message: 'Inserisci i giorni ferie.' })
    if (value.hours != null) ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Le ferie non usano ore.' })
  }
  if (value.type === 'PERMIT_104') {
    if (value.hours == null) ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Inserisci le ore di permesso.' })
    if (value.days != null) ctx.addIssue({ code: 'custom', path: ['days'], message: 'I permessi 104 non usano giorni.' })
  }
})
