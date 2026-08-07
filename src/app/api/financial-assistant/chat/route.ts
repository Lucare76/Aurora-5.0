import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertAssistantRateLimit } from '@/lib/financial-assistant/rate-limit'
import { buildAssistantResult } from '@/lib/financial-assistant/response-contract'
import { runFinancialAssistantQuery, statusToHttpStatus } from '@/lib/financial-assistant/orchestrator'
import { getAllowedScopes, isFinancialAssistantEnabled } from '@/lib/financial-assistant/scope-policy'
import { MAX_ASSISTANT_MESSAGE_LENGTH } from '@/lib/financial-assistant/constants'
import { parseNaturalLanguageMessage } from '@/lib/financial-assistant/natural-language'
import { listAssistantCapabilities } from '@/lib/financial-assistant/intent-registry'
import { FinancialAssistantProviderError } from '@/lib/financial-assistant/providers/errors'
import { createFinancialLanguageProvider, isAssistantAiAvailable } from '@/lib/financial-assistant/providers/factory'
import { validateComposedResponseAgainstFacts } from '@/lib/financial-assistant/providers/evidence-lock'
import { buildAiClassificationPayload, buildAiCompositionPayload } from '@/lib/financial-assistant/providers/redaction'
import { createClient } from '@/lib/supabase/server'
import type { AssistantAiMode, AssistantPrivacyMode } from '@/lib/financial-assistant/providers/types'
import type { AssistantQuery } from '@/lib/financial-assistant/types'

const chatSchema = z
  .object({
    message: z.string().trim().min(1, 'Scrivi una domanda.').max(MAX_ASSISTANT_MESSAGE_LENGTH),
    scope: z.enum(['PERSONAL', 'AURORA', 'ADI']).default('PERSONAL'),
    draft: z.record(z.string(), z.unknown()).nullable().optional(),
    privacyMode: z.enum(['ESSENTIAL_ONLY', 'SMART_REDACTED']).default('ESSENTIAL_ONLY'),
    aiConsent: z.boolean().default(false),
  })
  .strict()

function baseAiMode(privacyMode: AssistantPrivacyMode): AssistantAiMode {
  const aiAvailable = isAssistantAiAvailable()
  return {
    privacyMode,
    aiAvailable,
    deterministicModeAvailable: true,
    responseEnhancementAvailable: aiAvailable,
    aiClassificationUsed: false,
    aiExtractionUsed: false,
    aiCompositionUsed: false,
    deterministicFallbackUsed: false,
  }
}

function canUseSmartMode(input: { privacyMode: AssistantPrivacyMode; aiConsent: boolean }): boolean {
  return input.privacyMode === 'SMART_REDACTED' && input.aiConsent && isAssistantAiAvailable()
}

async function classifyWithAi(params: {
  message: string
  requestedScope: AssistantQuery['scope']
  userEmail: string | null
}): Promise<AssistantQuery | null> {
  const allowedScopes = getAllowedScopes(params.userEmail)
  const capabilities = listAssistantCapabilities(allowedScopes)
  const provider = createFinancialLanguageProvider()
  const classification = await provider.classifyIntent(buildAiClassificationPayload({
    message: params.message,
    requestedScope: params.requestedScope ?? 'PERSONAL',
    allowedScopes,
    allowedIntents: capabilities,
  }))

  if (!classification.supported || classification.confidence === 'LOW' || !classification.intent) return null
  const allowed = capabilities.find((capability) => capability.intent === classification.intent)
  if (!allowed) return null
  const scope = classification.scope && allowedScopes.includes(classification.scope) ? classification.scope : allowed.scope
  if (allowed.scope !== scope) return null

  return {
    intent: classification.intent,
    scope,
    message: params.message,
    period: classification.period ?? undefined,
    parameters: classification.parameters,
  }
}

async function maybeComposeWithAi(params: {
  message: string
  result: Awaited<ReturnType<typeof runFinancialAssistantQuery>>
  mode: AssistantAiMode
}): Promise<Awaited<ReturnType<typeof runFinancialAssistantQuery>>> {
  if (!params.mode.aiAvailable || params.mode.privacyMode !== 'SMART_REDACTED' || params.result.status !== 'OK') return params.result
  try {
    const payload = buildAiCompositionPayload(params.message, params.result)
    const composed = await createFinancialLanguageProvider().composeResponse(payload)
    const validated = validateComposedResponseAgainstFacts(composed, payload.allowedFacts)
    params.mode.aiCompositionUsed = true
    return {
      ...params.result,
      answer: validated.answer,
      summary: validated.summary.length > 0 ? validated.summary : params.result.summary,
    }
  } catch (error) {
    params.mode.deterministicFallbackUsed = true
    if (process.env.NODE_ENV !== 'production' && !(error instanceof FinancialAssistantProviderError)) {
      console.warn('Financial assistant AI composition fallback:', error)
    }
    return params.result
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })
  if (!isFinancialAssistantEnabled()) return NextResponse.json({ error: 'Assistente finanziario non abilitato.' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsedBody = chatSchema.safeParse(body)
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Richiesta non valida.', details: parsedBody.error.flatten() }, { status: 400 })
  }

  const parsedMessage = parseNaturalLanguageMessage(parsedBody.data.message, parsedBody.data.scope)
  const aiMode = baseAiMode(parsedBody.data.privacyMode)
  let query = parsedMessage.query

  const deterministicWriteRejection = parsedMessage.reason?.includes('solo lettura') ?? false
  if (!deterministicWriteRejection && parsedMessage.confidence !== 'HIGH' && canUseSmartMode(parsedBody.data)) {
    try {
      const aiQuery = await classifyWithAi({
        message: parsedMessage.normalizedMessage,
        requestedScope: parsedBody.data.scope,
        userEmail: user.email ?? null,
      })
      if (aiQuery) {
        query = aiQuery
        aiMode.aiClassificationUsed = true
      } else {
        aiMode.deterministicFallbackUsed = true
      }
    } catch (error) {
      aiMode.deterministicFallbackUsed = true
      if (process.env.NODE_ENV !== 'production' && !(error instanceof FinancialAssistantProviderError)) {
        console.warn('Financial assistant AI classification fallback:', error)
      }
    }
  }

  if (!query || (!parsedMessage.supported && !aiMode.aiClassificationUsed) || (parsedMessage.confidence === 'LOW' && !aiMode.aiClassificationUsed)) {
    try {
      assertAssistantRateLimit(user.id)
    } catch {
      return NextResponse.json({ error: 'Hai raggiunto il limite temporaneo di richieste. Riprova tra poco.' }, { status: 429 })
    }

    const result = buildAssistantResult({
      status: parsedMessage.supported ? 'NEEDS_INPUT' : 'UNSUPPORTED',
      intent: parsedMessage.query?.intent ?? null,
      scope: parsedBody.data.scope,
      answer: parsedMessage.reason ?? 'Non ho capito con sicurezza la domanda. Scegli uno degli esempi supportati.',
      missingInputs: parsedMessage.missingInputs.map((field) => ({
        field,
        label: field === 'message' ? 'Domanda' : field,
        reason: 'Serve un dettaglio in più per interpretare la richiesta.',
      })),
      warnings: ['Nessun tool finanziario è stato eseguito perché la confidenza è bassa.'],
    })
    return NextResponse.json({ parsed: parsedMessage, result, mode: aiMode }, { status: statusToHttpStatus(result.status) })
  }

  const deterministicResult = await runFinancialAssistantQuery({
    supabase,
    runtime: { user, email: user.email ?? null, now: new Date() },
    body: query,
  })
  const result = canUseSmartMode(parsedBody.data)
    ? await maybeComposeWithAi({ message: parsedBody.data.message, result: deterministicResult, mode: aiMode })
    : deterministicResult

  return NextResponse.json({ parsed: parsedMessage, result, mode: aiMode }, { status: statusToHttpStatus(result.status) })
}
