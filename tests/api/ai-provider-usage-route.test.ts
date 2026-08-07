import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

const userId = '11111111-1111-4111-8111-111111111111'

describe('AI provider usage API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('ritorna 401 senza autenticazione', async () => {
    mockSupabase({ authenticated: false, rows: [] })
    const { GET } = await import('@/app/api/ai-provider/usage/route')

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('ritorna riepilogo vuoto', async () => {
    const calls = mockSupabase({ rows: [] })
    const { GET } = await import('@/app/api/ai-provider/usage/route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.today.requestCount).toBe(0)
    expect(body.data.currentMonth.totalTokens).toBe(0)
    expect(JSON.stringify(body)).not.toContain(userId)
    expect(calls.filters).toContainEqual({ column: 'user_id', value: userId })
  })

  it('ritorna usage presente e costo stimato', async () => {
    mockSupabase({ rows: [usageRow()] })
    const { GET } = await import('@/app/api/ai-provider/usage/route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.currentMonth.requestCount).toBe(3)
    expect(body.data.currentMonth.estimatedCost).toBe(0.0123)
    expect(body.data.currentMonth.models).toEqual(['gpt-4.1-mini'])
  })

  it('mantiene costo null per modello sconosciuto o provider non prezzato', async () => {
    mockSupabase({ rows: [usageRow({ provider: 'GEMINI', model: 'gemini-2.5-flash', estimated_cost_usd: null })] })
    const { GET } = await import('@/app/api/ai-provider/usage/route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.currentMonth.estimatedCost).toBeNull()
  })

  it('sanifica errore DB', async () => {
    mockSupabase({ rows: [], error: { message: 'relation missing private detail' } })
    const { GET } = await import('@/app/api/ai-provider/usage/route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(JSON.stringify(body)).not.toContain('relation missing')
  })
})

function usageRow(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'OPENAI',
    model: 'gpt-4.1-mini',
    usage_date: new Date().toLocaleDateString('en-CA'),
    request_count: 3,
    input_tokens: 1000,
    output_tokens: 200,
    total_tokens: 1200,
    estimated_cost_usd: 0.0123,
    last_request_at: new Date().toISOString(),
    ...overrides,
  }
}

function mockSupabase(options: {
  authenticated?: boolean
  rows: unknown[]
  error?: { message: string } | null
}) {
  const filters: Array<{ column: string; value: unknown }> = []
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.authenticated === false ? null : { id: userId, email: 'user@example.test' } },
      }),
    },
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ column, value })
          return builder
        }),
        gte: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        order: vi.fn(() => Promise.resolve({ data: options.rows, error: options.error ?? null })),
      }
      return builder
    }),
  } as never)
  return { filters }
}
