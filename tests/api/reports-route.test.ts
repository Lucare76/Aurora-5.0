import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const categoryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'

function makeBuilder(data: unknown[] = [], error: unknown = null) {
  const builder: Record<string, any> = {}
  for (const method of ['select', 'eq', 'gte', 'lte', 'order']) builder[method] = vi.fn(() => builder)
  builder.then = (resolve: (value: unknown) => void) => resolve({ data, error })
  return builder
}

function mockSupabase(authenticated = true, from = vi.fn((table: string) => {
  if (table === 'accounts') {
    return makeBuilder([{ id: accountId, name: 'Banca', type: 'checking', balance: 1000, currency: 'EUR', color: null, is_active: true, is_hidden: false }])
  }
  if (table === 'categories') {
    return makeBuilder([{ id: categoryId, name: 'Stipendio', type: 'income', color: null, icon: '💰', parent_id: null }])
  }
  return makeBuilder([])
})) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: 'user-1' } : null },
        error: null,
      }),
    },
    from,
  } as never)
}

describe('GET /api/reports', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('restituisce 401 quando la sessione manca', async () => {
    mockSupabase(false)
    const { GET } = await import('@/app/api/reports/route')
    const response = await GET(new Request('http://localhost/api/reports'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'UNAUTHORIZED' })
  }, 30000)

  it('restituisce no-store e payload senza user_id', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/reports/route')
    const response = await GET(new Request('http://localhost/api/reports?range=current-month'))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body.summary).toHaveProperty('totalIncome')
    expect(body.metadata.queryCount).toBe(4)
    expect(JSON.stringify(body)).not.toContain('user_id')
  })

  it('valida range e date custom', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/reports/route')
    expect((await GET(new Request('http://localhost/api/reports?range=wrong'))).status).toBe(400)
    expect(await (await GET(new Request('http://localhost/api/reports?range=custom&from=2026-02-30&to=2026-03-01'))).json()).toEqual({ error: 'INVALID_DATE' })
    expect(await (await GET(new Request('http://localhost/api/reports?range=custom&from=2020-01-01&to=2026-01-02'))).json()).toEqual({ error: 'RANGE_TOO_LARGE' })
  })

  it('blocca filtri account e categoria non appartenenti al payload RLS', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/reports/route')
    const missingAccount = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9'
    const response = await GET(new Request(`http://localhost/api/reports?account=${missingAccount}`))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'INVALID_ACCOUNT' })
  })

  it('nasconde errori database interni dietro REPORT_FAILED', async () => {
    mockSupabase(true, vi.fn(() => makeBuilder([], { code: 'XX000', message: 'secret sql error' })))
    const { GET } = await import('@/app/api/reports/route')
    const response = await GET(new Request('http://localhost/api/reports'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'REPORT_FAILED' })
  })
})
