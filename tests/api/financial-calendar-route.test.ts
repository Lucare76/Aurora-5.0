import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const categoryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'

function makeBuilder(data: unknown = [], error: unknown = null) {
  const builder: Record<string, any> = {}
  for (const method of ['select', 'eq', 'gte', 'lte', 'order']) builder[method] = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  builder.then = (resolve: (value: unknown) => void) => resolve({ data, error })
  return builder
}

function mockSupabase(authenticated = true, from = vi.fn((table: string) => {
  if (table === 'profiles') return makeBuilder({ timezone: 'Europe/Rome' })
  if (table === 'accounts') return makeBuilder([{ id: accountId, name: 'Banca', type: 'checking', balance: 1000, currency: 'EUR', is_active: true, is_hidden: false }])
  if (table === 'categories') return makeBuilder([{ id: categoryId, name: 'Stipendio', type: 'income', icon: '💰', parent_id: null }])
  return makeBuilder([])
})) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: authenticated ? { id: 'user-1' } : null }, error: null }),
    },
    from,
  } as never)
}

describe('GET /api/financial-calendar', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('restituisce 401 se non autenticato', async () => {
    mockSupabase(false)
    const { GET } = await import('@/app/api/financial-calendar/route')
    const response = await GET(new Request('http://localhost/api/financial-calendar'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'UNAUTHORIZED' })
  }, 60000)

  it('restituisce payload no-store e non espone user_id', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/financial-calendar/route')
    const response = await GET(new Request('http://localhost/api/financial-calendar?month=2026-07'))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body.summary).toHaveProperty('projectedClosingBalance')
    expect(body.metadata.queryCount).toBe(8)
    expect(JSON.stringify(body)).not.toContain('user_id')
  }, 60000)

  it('valida mese, range e soglia', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/financial-calendar/route')
    expect(await (await GET(new Request('http://localhost/api/financial-calendar?month=2026-13'))).json()).toEqual({ error: 'INVALID_MONTH' })
    expect(await (await GET(new Request('http://localhost/api/financial-calendar?view=agenda&range=900'))).json()).toEqual({ error: 'RANGE_TOO_LARGE' })
    expect(await (await GET(new Request('http://localhost/api/financial-calendar?threshold=abc'))).json()).toEqual({ error: 'INVALID_THRESHOLD' })
  })

  it('blocca account non disponibile nel payload RLS', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/financial-calendar/route')
    const response = await GET(new Request('http://localhost/api/financial-calendar?account=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'INVALID_ACCOUNT' })
  })

  it('nasconde errori database dietro CALENDAR_FAILED', async () => {
    mockSupabase(true, vi.fn(() => makeBuilder([], { code: 'XX000', message: 'secret sql' })))
    const { GET } = await import('@/app/api/financial-calendar/route')
    const response = await GET(new Request('http://localhost/api/financial-calendar'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'CALENDAR_FAILED' })
  })
})
