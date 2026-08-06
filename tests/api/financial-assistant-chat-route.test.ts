import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAssistantRateLimit } from '@/lib/financial-assistant/rate-limit'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

function queryBuilder(data: unknown[] = []) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'in'] as const) builder[method] = vi.fn(() => builder)
  ;(builder as { then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown }).then = (resolve) => resolve({ data, error: null })
  return builder
}

function mockClient(user: { id: string; email?: string } | null) {
  ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => queryBuilder([])),
  })
}

function request(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  resetAssistantRateLimit()
  process.env.FINANCIAL_ASSISTANT_ENABLED = 'true'
  process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = 'luca_renna@hotmail.com'
})

describe('financial assistant chat API', () => {
  it('restituisce 401 senza autenticazione', async () => {
    mockClient(null)
    const { POST } = await import('@/app/api/financial-assistant/chat/route')
    const response = await POST(request({ message: 'Quanto ho speso questo mese?', scope: 'PERSONAL' }))
    expect(response.status).toBe(401)
  })

  it('fallisce chiusa se feature flag disabilitato', async () => {
    process.env.FINANCIAL_ASSISTANT_ENABLED = 'false'
    mockClient({ id: 'user-1', email: 'user@example.com' })
    const { POST } = await import('@/app/api/financial-assistant/chat/route')
    const response = await POST(request({ message: 'Quanto ho speso questo mese?', scope: 'PERSONAL' }))
    expect(response.status).toBe(403)
  })

  it('rifiuta proprietà sconosciute', async () => {
    mockClient({ id: 'user-1', email: 'user@example.com' })
    const { POST } = await import('@/app/api/financial-assistant/chat/route')
    const response = await POST(request({ message: 'Quanto ho speso?', scope: 'PERSONAL', user_id: 'other' }))
    expect(response.status).toBe(400)
  })

  it('rifiuta body assente o JSON invalido', async () => {
    mockClient({ id: 'user-1', email: 'user@example.com' })
    const { POST } = await import('@/app/api/financial-assistant/chat/route')
    const response = await POST({ json: () => Promise.reject(new Error('bad json')) } as Request)
    expect(response.status).toBe(400)
  })

  it('non esegue tool per richiesta non supportata', async () => {
    mockClient({ id: 'user-1', email: 'user@example.com' })
    const { POST } = await import('@/app/api/financial-assistant/chat/route')
    const response = await POST(request({ message: 'Quale ETF devo comprare?', scope: 'PERSONAL' }))
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.result.status).toBe('UNSUPPORTED')
    expect(body.result.readOnly).toBe(true)
  })

  it('rifiuta richieste di scrittura senza mutare dati', async () => {
    mockClient({ id: 'user-1', email: 'user@example.com' })
    const { POST } = await import('@/app/api/financial-assistant/chat/route')
    const response = await POST(request({ message: 'Trasferisci 500 euro ad Aurora', scope: 'PERSONAL' }))
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.result.answer).toContain('solo lettura')
  })

  it('applica rate limit anche quando la confidenza è bassa', async () => {
    mockClient({ id: 'user-1', email: 'user@example.com' })
    const { POST } = await import('@/app/api/financial-assistant/chat/route')
    let response = await POST(request({ message: 'Quale ETF devo comprare?', scope: 'PERSONAL' }))
    for (let i = 0; i < 20; i += 1) {
      response = await POST(request({ message: 'Quale ETF devo comprare?', scope: 'PERSONAL' }))
    }
    expect(response.status).toBe(429)
  })

  it('esegue un intent personale valido tramite orchestrator read-only', async () => {
    mockClient({ id: 'user-1', email: 'user@example.com' })
    const { POST } = await import('@/app/api/financial-assistant/chat/route')
    const response = await POST(request({ message: 'Quanto ho speso questo mese?', scope: 'PERSONAL' }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.parsed.query.intent).toBe('personal.income_expense_summary')
    expect(body.result.readOnly).toBe(true)
  })
})
