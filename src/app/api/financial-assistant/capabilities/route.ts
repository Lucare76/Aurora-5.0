import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FINANCIAL_ASSISTANT_ENGINE_VERSION } from '@/lib/financial-assistant/constants'
import { listAssistantCapabilities } from '@/lib/financial-assistant/intent-registry'
import { getUserAssistantProviderStatus } from '@/lib/financial-assistant/providers/factory'
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
  const providerStatus = enabled
    ? await getUserAssistantProviderStatus({ supabase, userId: user.id })
    : { available: false, provider: 'none' as const, reason: 'Assistente finanziario non abilitato.' }

  return NextResponse.json({
    enabled,
    readOnly: true,
    version: FINANCIAL_ASSISTANT_ENGINE_VERSION,
    scopes: enabled ? allowedScopes : [],
    capabilities: enabled ? listAssistantCapabilities(allowedScopes) : [],
    aiAvailable: providerStatus.available,
    aiProvider: providerStatus.provider,
    aiUnavailableReason: providerStatus.reason,
    deterministicModeAvailable: true,
    responseEnhancementAvailable: providerStatus.available,
  })
}
