import { z } from 'zod'
import type { AutomationRule, AutomationRuleInput } from './types'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const transactionType = z.enum(['income', 'expense', 'transfer'])

export const descriptionConditionSchema = z.object({
  type: z.literal('description'),
  operator: z.enum(['CONTAINS', 'EQUALS', 'STARTS_WITH', 'ENDS_WITH', 'NOT_CONTAINS']),
  value: z.string().trim().min(1).max(120),
}).strict()

export const amountConditionSchema = z.object({
  type: z.literal('amount'),
  operator: z.enum(['EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'BETWEEN']),
  value: z.number().finite().nonnegative().optional(),
  min: z.number().finite().nonnegative().optional(),
  max: z.number().finite().nonnegative().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.operator === 'BETWEEN') {
    if (value.min === undefined || value.max === undefined || value.min > value.max) {
      ctx.addIssue({ code: 'custom', path: ['min'], message: 'Intervallo importo non valido' })
    }
    return
  }
  if (value.value === undefined) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Importo richiesto' })
  }
})

export const conditionSchema = z.discriminatedUnion('type', [
  descriptionConditionSchema,
  amountConditionSchema,
  z.object({ type: z.literal('transaction_type'), value: transactionType }).strict(),
  z.object({ type: z.literal('account'), mode: z.enum(['ANY', 'NONE', 'SELECTED']).optional(), account_id: uuid.nullable() }).strict(),
  z.object({ type: z.literal('category'), mode: z.enum(['ANY', 'NONE', 'SELECTED']).optional(), category_id: uuid.nullable() }).strict(),
  z.object({
    type: z.literal('date'),
    date_from: isoDate.nullable().optional(),
    date_to: isoDate.nullable().optional(),
    day_of_month: z.number().int().min(1).max(31).nullable().optional(),
    day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  }).strict(),
])

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set_category'), category_id: uuid.nullable() }).strict(),
  z.object({ type: z.literal('set_account'), account_id: uuid }).strict(),
  z.object({ type: z.literal('set_transaction_type'), transaction_type: z.enum(['income', 'expense']) }).strict(),
  z.object({ type: z.literal('normalize_description'), description: z.string().trim().min(1).max(160) }).strict(),
  z.object({ type: z.literal('append_note'), note: z.string().trim().min(1).max(500) }).strict(),
])

export const ruleInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
  priority: z.number().int().min(1).max(10000).default(100),
  match_mode: z.enum(['ALL', 'ANY']).default('ALL'),
  stop_processing: z.boolean().default(true),
  apply_to_new_transactions: z.boolean().default(false),
  archived: z.boolean().default(false),
  conditions: z.array(conditionSchema).min(1).max(10),
  actions: z.array(actionSchema).min(1).max(10),
}).strict()

export const ruleRowSchema = ruleInputSchema.extend({
  id: uuid,
  user_id: uuid,
  created_at: z.string(),
  updated_at: z.string(),
})

export const previewRequestSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.number().int().min(1).max(20).default(20).optional(),
}).strict()

export const testRuleSchema = z.object({
  description: z.string().nullable().optional(),
  amount: z.number().finite().nonnegative(),
  type: transactionType,
  account_id: uuid,
  category_id: uuid.nullable().optional(),
  date: isoDate,
  notes: z.string().nullable().optional(),
  transfer_peer_id: uuid.nullable().optional(),
}).strict()

export const applyRuleSchema = z.object({
  from: isoDate,
  to: isoDate,
  confirm: z.literal(true),
  limit: z.number().int().min(1).max(500).default(500).optional(),
}).strict()

export function normalizeRuleInput(input: unknown): AutomationRuleInput {
  return ruleInputSchema.parse(input) as AutomationRuleInput
}

export function normalizeRuleRow(input: unknown): AutomationRule {
  return ruleRowSchema.parse(input) as AutomationRule
}

export function normalizeRuleRows(input: unknown[]): AutomationRule[] {
  return input.map((row) => normalizeRuleRow(row))
}
