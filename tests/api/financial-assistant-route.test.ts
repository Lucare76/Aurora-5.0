import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

function mockClient(user: { id: string; email?: string } | null) {
  ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => {
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit'] as const) builder[method] = vi.fn(() => builder)
      ;(builder as { then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown }).then = (resolve) => resolve({ data: [], error: null })
      return builder
    }),
  })
}

function request(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FINANCIAL_ASSISTANT_ENABLED = 'true'
  process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = 'luca_renna@hotmail.com'
})

describe('financial assistant API routes', () => {
  it('GET capabilities richiede autenticazione', async () => {
    mockClient(null)
    const { GET } = await import('@/app/api/financial-assistant/capabilities/route')
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('GET capabilities nasconde strumenti privati ai non autorizzati', async () => {
    mockClient({ id: 'user-1', email: 'altra@example.com' })
    const { GET } = await import('@/app/api/financial-assistant/capabilities/route')
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.scopes).toEqual(['PERSONAL'])
    expect(JSON.stringify(body.capabilities)).not.toContain('adi.summary')
    expect(JSON.stringify(body.capabilities)).not.toContain('aurora.savings_summary')
  })

  it('POST query restituisce 403 quando la feature flag e disattivata', async () => {
    process.env.FINANCIAL_ASSISTANT_ENABLED = 'false'
    mockClient({ id: 'user-1', email: 'luca_renna@hotmail.com' })
    const { POST } = await import('@/app/api/financial-assistant/query/route')
    const response = await POST(request({ intent: 'personal.financial_summary' }))
    const body = await response.json()
    expect(response.status).toBe(403)
    expect(body.status).toBe('DISABLED')
  })

  it('POST query valida il body in modo strict', async () => {
    mockClient({ id: 'user-1', email: 'luca_renna@hotmail.com' })
    const { POST } = await import('@/app/api/financial-assistant/query/route')
    const response = await POST(request({ intent: 'personal.financial_summary', user_id: 'altro' }))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.status).toBe('INVALID_REQUEST')
  })
})
