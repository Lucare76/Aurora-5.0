import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertAssistantRateLimit } from '@/lib/financial-assistant/rate-limit'
import { buildAssistantResult } from '@/lib/financial-assistant/response-contract'
import { runFinancialAssistantQuery, statusToHttpStatus } from '@/lib/financial-assistant/orchestrator'
import { isFinancialAssistantEnabled } from '@/lib/financial-assistant/scope-policy'
import { MAX_ASSISTANT_MESSAGE_LENGTH } from '@/lib/financial-assistant/constants'
import { parseNaturalLanguageMessage } from '@/lib/financial-assistant/natural-language'
import { createClient } from '@/lib/supabase/server'

const chatSchema = z
  .object({
    message: z.string().trim().min(1, 'Scrivi una domanda.').max(MAX_ASSISTANT_MESSAGE_LENGTH),
    scope: z.enum(['PERSONAL', 'AURORA', 'ADI']).default('PERSONAL'),
    draft: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()

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
  if (!parsedMessage.supported || parsedMessage.confidence === 'LOW' || !parsedMessage.query) {
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
    return NextResponse.json({ parsed: parsedMessage, result }, { status: statusToHttpStatus(result.status) })
  }

  const result = await runFinancialAssistantQuery({
    supabase,
    runtime: { user, email: user.email ?? null, now: new Date() },
    body: parsedMessage.query,
  })

  return NextResponse.json({ parsed: parsedMessage, result }, { status: statusToHttpStatus(result.status) })
}
