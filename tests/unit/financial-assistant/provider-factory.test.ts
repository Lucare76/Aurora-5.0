import { afterEach, describe, expect, it, vi } from 'vitest'

import { createFinancialLanguageProvider, getUserAssistantProviderStatus } from '@/lib/financial-assistant/providers/factory'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

function supabaseWithNoPersonalKey() {
  return supabaseWithPersonalSettings(null)
}

function supabaseWithPersonalSettings(row: Record<string, unknown> | null) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq'] as const) builder[method] = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: row, error: null }))
  return { from: vi.fn(() => builder) }
}

describe('financial assistant provider factory', () => {
  it('non usa la chiave admin globale per la chat utente', async () => {
    process.env.FINANCIAL_ASSISTANT_AI_ENABLED = 'true'
    process.env.FINANCIAL_ASSISTANT_ALLOW_ADMIN_KEY = 'true'
    process.env.FINANCIAL_ASSISTANT_AI_PROVIDER = 'openai'
    process.env.FINANCIAL_ASSISTANT_AI_MODEL = 'gpt-4.1-mini'
    process.env.FINANCIAL_ASSISTANT_AI_API_KEY = 'sk-proj_admin-key-1234567890'

    const supabase = supabaseWithNoPersonalKey()
    const status = await getUserAssistantProviderStatus({ supabase, userId: 'user-1' })
    const provider = await createFinancialLanguageProvider({ supabase, userId: 'user-1' })

    expect(status.available).toBe(false)
    expect(status.reason).toContain('personale')
    expect(provider.status.available).toBe(false)
    expect(provider.status.reason).toContain('personale')
  })

  it('spiega quando il provider personale e salvato ma non abilitato', async () => {
    const status = await getUserAssistantProviderStatus({
      supabase: supabaseWithPersonalSettings({
        provider: 'OPENAI',
        enabled: false,
        encrypted_api_key: 'v1:not-readable',
        api_key_last4: '7890',
        connection_status: 'configured',
      }),
      userId: 'user-1',
    })

    expect(status.available).toBe(false)
    expect(status.reason).toContain('non abilitato')
  })

  it('spiega quando manca il secret server per decifrare la chiave personale', async () => {
    delete process.env.AI_PROVIDER_SETTINGS_SECRET
    delete process.env.FINANCIAL_ASSISTANT_AI_KEY_ENCRYPTION_SECRET

    const status = await getUserAssistantProviderStatus({
      supabase: supabaseWithPersonalSettings({
        provider: 'OPENAI',
        enabled: true,
        encrypted_api_key: 'v1:not-readable',
        api_key_last4: '7890',
        connection_status: 'configured',
      }),
      userId: 'user-1',
    })

    expect(status.available).toBe(false)
    expect(status.reason).toContain('Cifratura')
  })
})
