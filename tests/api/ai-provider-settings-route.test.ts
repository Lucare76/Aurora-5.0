import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/financial-assistant/providers/connection-test', () => ({
  testAiProviderConnection: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { testAiProviderConnection } from '@/lib/financial-assistant/providers/connection-test'

const userId = '11111111-1111-4111-8111-111111111111'

function request(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

describe('AI provider settings API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.AI_PROVIDER_SETTINGS_SECRET = 'x'.repeat(32)
  })

  it('restituisce solo dati mascherati', async () => {
    mockSupabase({
      row: {
        provider: 'OPENAI',
        enabled: true,
        encrypted_api_key: 'v1:secret',
        api_key_last4: 'abcd',
        connection_status: 'verified',
        last_checked_at: null,
        last_error: null,
        updated_at: null,
      },
    })
    const { GET } = await import('@/app/api/settings/ai-provider/route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(JSON.stringify(body)).not.toContain('v1:secret')
    expect(body.data.maskedApiKey).toBe('************abcd')
  }, 30_000)

  it('salva una chiave personale cifrata e non la restituisce', async () => {
    const writes: unknown[] = []
    mockSupabase({ row: null, writes })
    const { PUT } = await import('@/app/api/settings/ai-provider/route')

    const response = await PUT(request({
      provider: 'OPENAI',
      enabled: true,
      apiKey: 'sk-proj_1234567890abcdef',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(JSON.stringify(body)).not.toContain('sk-proj_1234567890abcdef')
    expect(writes[0]).toMatchObject({
      user_id: userId,
      provider: 'OPENAI',
      enabled: true,
      api_key_last4: 'cdef',
    })
    expect(JSON.stringify(writes[0])).not.toContain('sk-proj_1234567890abcdef')
  })

  it('rifiuta provider non valido', async () => {
    mockSupabase({ row: null })
    const { PUT } = await import('@/app/api/settings/ai-provider/route')

    const response = await PUT(request({ provider: 'OTHER', enabled: true, apiKey: 'secret-key' }))

    expect(response.status).toBe(400)
  })

  it('verifica connessione senza esporre la chiave', async () => {
    vi.mocked(testAiProviderConnection).mockResolvedValue({
      ok: true,
      status: 'verified',
      message: 'Connessione riuscita',
    })
    const writes: unknown[] = []
    mockSupabase({ row: null, writes })
    const { POST } = await import('@/app/api/settings/ai-provider/test/route')

    const response = await POST(request({
      provider: 'GEMINI',
      apiKey: 'AIzaSyA1234567890abcdefghi',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.message).toBe('Connessione riuscita')
    expect(JSON.stringify(body)).not.toContain('AIzaSyA1234567890abcdefghi')
    expect(testAiProviderConnection).toHaveBeenCalledWith({
      provider: 'GEMINI',
      apiKey: 'AIzaSyA1234567890abcdefghi',
    })
  })
})

function mockSupabase(options: {
  row: Record<string, unknown> | null
  writes?: unknown[]
}) {
  const writes = options.writes ?? []
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, email: 'user@example.test' } } }),
    },
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve({ data: options.row, error: null })),
        single: vi.fn(() => Promise.resolve({
          data: {
            provider: 'OPENAI',
            enabled: true,
            encrypted_api_key: 'v1:not-returned',
            api_key_last4: 'cdef',
            connection_status: 'configured',
            last_checked_at: null,
            last_error: null,
            updated_at: null,
          },
          error: null,
        })),
        upsert: vi.fn((value: unknown) => {
          writes.push(value)
          return builder
        }),
        update: vi.fn((value: unknown) => {
          writes.push(value)
          return builder
        }),
      }
      return builder
    }),
  } as never)
}
