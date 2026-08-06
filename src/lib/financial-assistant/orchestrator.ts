import { buildAssistantContext } from './context-builder'
import { FinancialAssistantError, safeAssistantErrorMessage } from './errors'
import { logAssistantAudit } from './audit-log'
import { assertNoWriteIntent } from './permissions'
import { assertAssistantRateLimit } from './rate-limit'
import { buildAssistantResult } from './response-contract'
import { assertScopeAllowed, isFinancialAssistantEnabled } from './scope-policy'
import { getAssistantTool } from './tool-registry'
import { parseAssistantQuery } from './validation'
import { assertNoPromptInjection } from './intents/prompt-injection-policy'
import type { AssistantQuery, AssistantRuntime } from './types'
import { ZodError } from 'zod'

type SupabaseLike = {
  from: (table: string) => any
}

export async function runFinancialAssistantQuery(params: {
  supabase: SupabaseLike
  runtime: AssistantRuntime
  body: unknown
}) {
  let query: AssistantQuery | null = null
  try {
    if (!isFinancialAssistantEnabled()) {
      throw new FinancialAssistantError('DISABLED', 'Assistente finanziario non abilitato.', 403)
    }

    query = parseAssistantQuery(params.body)
    assertNoWriteIntent(query.message)
    assertNoPromptInjection(query.message)
    assertAssistantRateLimit(params.runtime.user.id)

    const scope = assertScopeAllowed({
      email: params.runtime.email,
      intent: query.intent,
      requestedScope: query.scope,
    })
    const tool = getAssistantTool(query.intent)
    if (!tool) throw new FinancialAssistantError('UNSUPPORTED', 'Questo strumento non e disponibile.', 404)
    if (tool.scope !== scope) throw new FinancialAssistantError('FORBIDDEN', 'Lo strumento non puo leggere questo perimetro.', 403)

    const context = await buildAssistantContext({
      supabase: params.supabase,
      runtime: params.runtime,
      query,
      scope,
    })
    const result = await tool.execute({ query, context })
    logAssistantAudit({ userId: params.runtime.user.id, intent: query.intent, scope, status: result.status })
    return result
  } catch (error) {
    const assistantError = error instanceof FinancialAssistantError
      ? error
      : error instanceof ZodError
        ? new FinancialAssistantError('INVALID_REQUEST', 'La richiesta non e valida.', 400)
        : null
    const result = buildAssistantResult({
      status: assistantError?.code ?? 'ERROR',
      intent: query?.intent ?? null,
      scope: query?.scope ?? null,
      answer: safeAssistantErrorMessage(error),
      warnings: process.env.NODE_ENV !== 'production' && error instanceof Error ? [error.message] : [],
    })
    logAssistantAudit({
      userId: params.runtime.user.id,
      intent: query?.intent ?? null,
      scope: query?.scope ?? null,
      status: result.status,
      message: result.answer,
    })
    return result
  }
}

export function statusToHttpStatus(status: string): number {
  if (status === 'OK' || status === 'NEEDS_INPUT') return 200
  if (status === 'INVALID_REQUEST') return 400
  if (status === 'FORBIDDEN' || status === 'DISABLED') return 403
  if (status === 'RATE_LIMITED') return 429
  if (status === 'UNSUPPORTED') return 404
  return 500
}
