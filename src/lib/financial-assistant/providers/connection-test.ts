import { getProviderDefaults, type ExternalProviderName } from './config'
import { validateApiKeyFormat } from './personal-settings'
import type { AiProvider } from '@/types/database'

export type AiConnectionTestResult =
  | { ok: true; status: 'verified'; message: 'Connessione riuscita' }
  | { ok: false; status: 'auth_error' | 'unreachable' | 'invalid_format'; message: string }

export async function testAiProviderConnection(params: {
  provider: AiProvider
  apiKey: string
  fetchImpl?: typeof fetch
}): Promise<AiConnectionTestResult> {
  const apiKey = params.apiKey.trim()
  if (!validateApiKeyFormat(params.provider, apiKey)) {
    return { ok: false, status: 'invalid_format', message: 'Formato API key non valido.' }
  }

  const fetcher = params.fetchImpl ?? fetch
  const provider = providerToExternal(params.provider)
  try {
    const response = await pingProvider({ provider, apiKey, fetcher })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: 'auth_error', message: 'Errore autenticazione.' }
    }
    if (!response.ok) {
      return { ok: false, status: 'unreachable', message: 'Provider non raggiungibile.' }
    }
    return { ok: true, status: 'verified', message: 'Connessione riuscita' }
  } catch {
    return { ok: false, status: 'unreachable', message: 'Provider non raggiungibile.' }
  }
}

function providerToExternal(provider: AiProvider): ExternalProviderName {
  if (provider === 'ANTHROPIC') return 'anthropic'
  if (provider === 'GEMINI') return 'gemini'
  return 'openai'
}

function pingProvider(params: {
  provider: ExternalProviderName
  apiKey: string
  fetcher: typeof fetch
}): Promise<Response> {
  const defaults = getProviderDefaults(params.provider)
  if (params.provider === 'anthropic') {
    return params.fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: defaults.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
  }
  if (params.provider === 'gemini') {
    return params.fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(defaults.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': params.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    })
  }
  return params.fetcher(`https://api.openai.com/v1/models/${encodeURIComponent(defaults.model)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${params.apiKey}` },
  })
}
