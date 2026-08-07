import { z } from 'zod'
import { assistantIntentSchema, assistantPeriodSchema, assistantScopeSchema } from '../validation'

export const aiIntentClassificationSchema = z
  .object({
    supported: z.boolean(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    intent: assistantIntentSchema.nullable(),
    scope: assistantScopeSchema.nullable(),
    period: assistantPeriodSchema.nullable(),
    parameters: z.record(z.string(), z.unknown()).default({}),
    missingInputs: z.array(z.string()).default([]),
    reason: z.string().nullable().default(null),
  })
  .strict()

export const aiParameterExtractionSchema = z
  .object({
    period: assistantPeriodSchema.nullable(),
    parameters: z.record(z.string(), z.unknown()).default({}),
    missingInputs: z.array(z.string()).default([]),
  })
  .strict()

export const aiComposedResponseSchema = z
  .object({
    answer: z.string().trim().min(1).max(1_200),
    summary: z.array(z.string().trim().min(1).max(240)).max(6).default([]),
  })
  .strict()

export const intentClassificationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['supported', 'confidence', 'intent', 'scope', 'period', 'parameters', 'missingInputs', 'reason'],
  properties: {
    supported: { type: 'boolean' },
    confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    intent: {
      anyOf: [
        { type: 'string', enum: assistantIntentSchema.options },
        { type: 'null' },
      ],
    },
    scope: {
      anyOf: [
        { type: 'string', enum: assistantScopeSchema.options },
        { type: 'null' },
      ],
    },
    period: {
      anyOf: [
        { type: 'string', enum: assistantPeriodSchema.options },
        { type: 'null' },
      ],
    },
    parameters: { type: 'object', additionalProperties: true },
    missingInputs: { type: 'array', items: { type: 'string' } },
    reason: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const

export const responseCompositionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'summary'],
  properties: {
    answer: { type: 'string' },
    summary: { type: 'array', items: { type: 'string' } },
  },
} as const

export const parameterExtractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['period', 'parameters', 'missingInputs'],
  properties: {
    period: {
      anyOf: [
        { type: 'string', enum: assistantPeriodSchema.options },
        { type: 'null' },
      ],
    },
    parameters: { type: 'object', additionalProperties: true },
    missingInputs: { type: 'array', items: { type: 'string' } },
  },
} as const
