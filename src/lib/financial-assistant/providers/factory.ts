import { getFinancialAssistantAiStatus, getOpenAiProviderConfig, getProviderDefaults, type ExternalProviderName } from './config'
import { createDeterministicProvider } from './deterministic-provider'
import { OpenAiFinancialLanguageProvider } from './external-provider'
import { resolvePersonalAiProvider } from './personal-settings'
import { recordAiUsage } from '../usage/service'
import type { AssistantProviderStatus, FinancialLanguageProvider } from './types'

export function getAssistantProviderStatus(): AssistantProviderStatus {
  return getFinancialAssistantAiStatus()
}

export async function getUserAssistantProviderStatus(params?: {
  supabase?: { from: (table: string) => any }
  userId?: string
}): Promise<AssistantProviderStatus> {
  if (params?.supabase && params.userId) {
    try {
      const personal = await resolvePersonalAiProvider(params.supabase, params.userId)
      if (personal) return { available: true, provider: providerNameToKind(personal.provider), reason: null }
    } catch {
      // Missing migration or temporary settings failure must not break deterministic mode.
    }
  }
  return getAssistantProviderStatus()
}

export async function createFinancialLanguageProvider(params?: {
  supabase?: { from: (table: string) => any }
  userId?: string
}): Promise<FinancialLanguageProvider> {
  if (params?.supabase && params.userId) {
    try {
      const personal = await resolvePersonalAiProvider(params.supabase, params.userId)
      if (personal) {
        const provider = providerNameToKind(personal.provider)
        return new OpenAiFinancialLanguageProvider({
          ...getProviderDefaults(provider),
          apiKey: personal.apiKey,
          onUsage: (usage) => recordAiUsage({ supabase: params.supabase!, userId: params.userId!, usage }).catch(() => {}),
        })
      }
    } catch {
      // Fall through to explicit admin provider or deterministic mode.
    }
  }
  const config = getOpenAiProviderConfig()
  if (!config) return createDeterministicProvider(getFinancialAssistantAiStatus().reason ?? 'Provider AI non disponibile.')
  return new OpenAiFinancialLanguageProvider(params?.supabase && params.userId
    ? {
        ...config,
        onUsage: (usage) => recordAiUsage({ supabase: params.supabase!, userId: params.userId!, usage }).catch(() => {}),
      }
    : config)
}

export function isAssistantAiAvailable(): boolean {
  return getAssistantProviderStatus().available
}

export async function isUserAssistantAiAvailable(params?: {
  supabase?: { from: (table: string) => any }
  userId?: string
}): Promise<boolean> {
  return (await getUserAssistantProviderStatus(params)).available
}

function providerNameToKind(provider: 'OPENAI' | 'ANTHROPIC' | 'GEMINI'): ExternalProviderName {
  if (provider === 'ANTHROPIC') return 'anthropic'
  if (provider === 'GEMINI') return 'gemini'
  return 'openai'
}
