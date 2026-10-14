import { z } from 'zod'
import { parseItalianDate } from '@/lib/dates/italian'

export const installmentScheduleSchema = z.object({
  amount: z.number().finite().positive().max(1_000_000_000).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001),
  frequency: z.enum(['monthly', 'weekly']),
  interval: z.number().int().min(1).max(12),
  first_due_date: z.string().refine((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && parseItalianDate(date) === date),
  first_installment_number: z.number().int().min(1).max(360),
  paused: z.boolean().default(false),
})
