import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FINANCIAL_ASSISTANT_ENGINE_VERSION } from '@/lib/financial-assistant/constants'
import { listAssistantCapabilities } from '@/lib/financial-assistant/intent-registry'
import { isUserAssistantAiAvailable } from '@/lib/financial-assistant/providers/factory'
import { getAllowedScopes, isFinancialAssistantEnabled } from '@/lib/financial-assistant/scope-policy'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })
  }

  const enabled = isFinancialAssistantEnabled()
  const allowedScopes = getAllowedScopes(user.email)
  const aiAvailable = enabled ? await isUserAssistantAiAvailable({ supabase, userId: user.id }) : false

  return NextResponse.json({
    enabled,
    readOnly: true,
    version: FINANCIAL_ASSISTANT_ENGINE_VERSION,
    scopes: enabled ? allowedScopes : [],
    capabilities: enabled ? listAssistantCapabilities(allowedScopes) : [],
    aiAvailable,
    deterministicModeAvailable: true,
    responseEnhancementAvailable: aiAvailable,
  })
}
