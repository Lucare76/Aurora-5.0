import { z } from 'zod'
import { MAX_ASSISTANT_MESSAGE_LENGTH } from './constants'

export const assistantIntentSchema = z.enum([
  'personal.financial_summary',
  'personal.income_expense_summary',
  'personal.spending_by_category',
  'personal.emergency_fund_status',
  'personal.financial_health_explanation',
  'personal.budget_summary',
  'personal.goal_summary',
  'affordability.generic',
  'affordability.car',
  'affordability.home',
  'affordability.travel',
  'decision.compare',
  'aurora.savings_summary',
  'adi.summary',
])

export const assistantScopeSchema = z.enum(['PERSONAL', 'AURORA', 'ADI'])
export const assistantPeriodSchema = z.enum(['CURRENT_MONTH', 'PREVIOUS_MONTH', 'LAST_3_MONTHS', 'LAST_6_MONTHS', 'LAST_12_MONTHS', 'ALL_TIME'])

const forbiddenClientKeys = ['user_id', 'userId', 'email', 'sql', 'rpc', 'serviceRole', 'systemPrompt', 'apiKey']

export const assistantQuerySchema = z
  .object({
    intent: assistantIntentSchema,
    scope: assistantScopeSchema.optional(),
    message: z.string().trim().max(MAX_ASSISTANT_MESSAGE_LENGTH).optional(),
    period: assistantPeriodSchema.optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const key of forbiddenClientKeys) {
      if (Object.prototype.hasOwnProperty.call(value.parameters ?? {}, key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['parameters', key],
          message: 'Campo non consentito nella richiesta.',
        })
      }
    }
  })

export function parseAssistantQuery(input: unknown) {
  return assistantQuerySchema.parse(input)
}

