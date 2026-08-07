import { describe, expect, it } from 'vitest'
import {
  apiKeyMatchesLast4,
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
  toSafeAiProviderSettings,
  validateApiKeyFormat,
} from '@/lib/financial-assistant/providers/personal-settings'

describe('personal AI provider settings', () => {
  it('maschera la chiave senza esporre il valore completo', () => {
    expect(maskApiKey('abcd')).toBe('************abcd')
    expect(maskApiKey(null)).toBeNull()
  })

  it('cifra e decifra una API key server-side', () => {
    const secret = 'a'.repeat(32)
    const apiKey = 'sk-test-personal-key-1234567890'
    const encrypted = encryptApiKey(apiKey, secret)

    expect(encrypted).not.toContain(apiKey)
    expect(decryptApiKey(encrypted, secret)).toBe(apiKey)
    expect(apiKeyMatchesLast4(apiKey, '7890')).toBe(true)
  })

  it('valida i formati minimi dei provider supportati', () => {
    expect(validateApiKeyFormat('OPENAI', 'sk-proj_1234567890abcdef')).toBe(true)
    expect(validateApiKeyFormat('ANTHROPIC', 'sk-ant-api03-1234567890abcdef')).toBe(true)
    expect(validateApiKeyFormat('GEMINI', 'AIzaSyA1234567890abcdefghi')).toBe(true)
    expect(validateApiKeyFormat('OPENAI', 'sk-ant-api03-1234567890abcdef')).toBe(false)
  })

  it('restituisce solo impostazioni sicure per il client', () => {
    const safe = toSafeAiProviderSettings({
      provider: 'OPENAI',
      enabled: true,
      encrypted_api_key: 'v1:not-visible',
      api_key_last4: 'abcd',
      connection_status: 'verified',
      last_checked_at: '2026-08-07T10:00:00.000Z',
      last_error: null,
      updated_at: '2026-08-07T10:00:00.000Z',
    })

    expect(JSON.stringify(safe)).not.toContain('not-visible')
    expect(safe.maskedApiKey).toBe('************abcd')
    expect(safe.configured).toBe(true)
  })
})
