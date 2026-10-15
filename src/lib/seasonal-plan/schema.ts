import { z } from 'zod'
import { parseItalianDate } from '@/lib/dates/italian'
const money = z
  .number()
  .finite()
  .min(0)
  .max(1e9)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-5,
    'Usa al massimo due decimali',
  )
const date = z
  .string()
  .refine(
    (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && parseItalianDate(v) === v,
    'Data non valida',
  )
const confidence = z.enum(['CONFIRMED', 'ESTIMATED'])
export const seasonalPlanSchema = z.object({
  account_ids: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .refine((v) => new Set(v).size === v.length),
  reserve: money,
  monthly_extra_expenses: money,
  reviewed: z.boolean(),
  months: z
    .array(
      z
        .object({
          month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
          kind: z.enum(['SALARY', 'NASPI', 'OTHER', 'NONE']),
          amount: money,
          day: z.number().int().min(1).max(31),
          confidence,
          received: z.boolean(),
          extra: z
            .object({
              amount: money,
              day: z.number().int().min(1).max(31),
              confidence,
              received: z.boolean(),
              label: z.string().trim().min(1).max(100),
            })
            .default({
              amount: 0,
              day: 27,
              confidence: 'ESTIMATED',
              received: false,
              label: 'Altre entrate',
            }),
        })
        .refine((m) => m.kind !== 'NONE' || m.amount === 0),
    )
    .min(1)
    .max(24)
    .refine(
      (v) => new Set(v.map((m) => m.month)).size === v.length,
      'Mesi duplicati',
    ),
  commitments: z
    .array(
      z
        .object({
          id: z.string().uuid(),
          title: z.string().trim().min(1).max(100),
          kind: z.enum(['FIXED', 'PAC', 'OTHER']),
          amount: money.refine((v) => v > 0),
          start_date: date,
          end_date: date,
          confidence,
        })
        .refine((v) => v.end_date >= v.start_date),
    )
    .max(100)
    .refine((v) => new Set(v.map((c) => c.id)).size === v.length),
})
export type SeasonalPlan = z.infer<typeof seasonalPlanSchema>
export function monthKeys(today: string, count = 12): string[] {
  const [y, m] = today.split('-').map(Number)
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 7),
  )
}
export function emptyPlan(today: string, ids: string[] = []): SeasonalPlan {
  return {
    account_ids: ids,
    reserve: 0,
    monthly_extra_expenses: 0,
    reviewed: false,
    commitments: [],
    months: monthKeys(today).map((month) => ({
      month,
      kind: 'NONE',
      amount: 0,
      day: 27,
      confidence: 'ESTIMATED',
      received: false,
      extra: {
        amount: 0,
        day: 27,
        confidence: 'ESTIMATED',
        received: false,
        label: 'Altre entrate',
      },
    })),
  }
}
