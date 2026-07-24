import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const userId = '11111111-1111-4111-8111-111111111111'

function makeBuilder(data: unknown[] = [], error: unknown = null) {
  const b: Record<string, any> = {}
  for (const method of ['select', 'eq', 'or', 'order', 'limit', 'in']) b[method] = vi.fn(() => b)
  b.then = (resolve: (value: unknown) => void) => resolve({ data, error })
  return b
}

function mockSupabase(authenticated = true, from: any = vi.fn(() => makeBuilder())) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: userId } : null },
        error: null,
      }),
    },
    from,
  } as never)
}

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(),
    } as never)
    const { GET } = await import('@/app/api/search/route')
    const res = await GET(new Request('http://localhost/api/search?q=vacanza'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' })
  }, 30000)

  it('validates query shape and length', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/search/route')
    expect((await GET(new Request('http://localhost/api/search'))).status).toBe(400)
    expect(await (await GET(new Request('http://localhost/api/search?q=a'))).json()).toEqual({ error: 'QUERY_TOO_SHORT' })
    expect(await (await GET(new Request(`http://localhost/api/search?q=${'x'.repeat(101)}`))).json()).toEqual({ error: 'QUERY_TOO_LONG' })
  })

  it('returns no-store payload for valid searches', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'savings_goals') {
        return makeBuilder([{ id: 'g1', name: 'Vacanza', notes: null, target_amount: 2500, current_amount: 1250, status: 'ACTIVE', archived: false, target_date: null }])
      }
      return makeBuilder([])
    })
    mockSupabase(true, from)
    const { GET } = await import('@/app/api/search/route')
    const res = await GET(new Request('http://localhost/api/search?q=vacanza'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(body.query).toBe('vacanza')
    expect(body.totalResults).toBe(1)
    expect(JSON.stringify(body)).not.toContain(userId)
  })

  it('hides database errors behind SEARCH_FAILED', async () => {
    mockSupabase(true, vi.fn(() => makeBuilder([], { code: 'XX000', message: 'secret db error' })))
    const { GET } = await import('@/app/api/search/route')
    const res = await GET(new Request('http://localhost/api/search?q=conto'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'SEARCH_FAILED' })
  })
})
