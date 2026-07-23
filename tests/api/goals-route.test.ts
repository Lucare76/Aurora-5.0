import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const userId = '11111111-1111-4111-8111-111111111111'
const goalId = '22222222-2222-4222-8222-222222222222'

function makeBuilder(data: unknown = null, error: unknown = null, count?: number) {
  const b: Record<string, any> = {}
  for (const method of ['select', 'eq', 'neq', 'order', 'limit', 'insert', 'update', 'delete']) b[method] = vi.fn(() => b)
  b.single = vi.fn(() => Promise.resolve({ data, error }))
  b.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  b.then = (resolve: (value: unknown) => void) => resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error, count })
  return b
}

function mockAuth(authenticated = true) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: userId } : null },
        error: null,
      }),
    },
  }
}

describe('GET /api/goals', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    createClientMock.mockResolvedValue({ ...mockAuth(false), from: vi.fn(() => makeBuilder()) } as never)
    const { GET } = await import('@/app/api/goals/route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' })
  })

  it('returns data and no-store when authenticated', async () => {
    createClientMock.mockResolvedValue({ ...mockAuth(), from: vi.fn(() => makeBuilder([])) } as never)
    const { GET } = await import('@/app/api/goals/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({ data: [] })
  })
})

describe('POST /api/goals', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('rejects invalid target amount', async () => {
    createClientMock.mockResolvedValue({ ...mockAuth(), from: vi.fn(() => makeBuilder()) } as never)
    const { POST } = await import('@/app/api/goals/route')
    const res = await POST(new Request('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({ name: 'Viaggio', targetAmount: -1 }),
    }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'INVALID_AMOUNT' })
  })

  it('creates a goal for authenticated users', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder({ id: goalId })),
    } as never)
    const { POST } = await import('@/app/api/goals/route')
    const res = await POST(new Request('http://localhost/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Viaggio', targetAmount: 1200, targetDate: null }),
    }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ data: { id: goalId } })
  })
})

describe('goal detail routes', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('returns 400 for invalid goal uuid', async () => {
    createClientMock.mockResolvedValue({ ...mockAuth(), from: vi.fn(() => makeBuilder()) } as never)
    const { GET } = await import('@/app/api/goals/[id]/route')
    const res = await GET(new Request('http://localhost/api/goals/nope'), { params: Promise.resolve({ id: 'nope' }) })
    expect(res.status).toBe(400)
  })

  it('rejects invalid contribution amounts', async () => {
    createClientMock.mockResolvedValue({ ...mockAuth(), from: vi.fn(() => makeBuilder()) } as never)
    const { POST } = await import('@/app/api/goals/[id]/contributions/route')
    const res = await POST(new Request(`http://localhost/api/goals/${goalId}/contributions`, {
      method: 'POST',
      body: JSON.stringify({ amount: 0, date: '2026-07-23' }),
    }), { params: Promise.resolve({ id: goalId }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'INVALID_AMOUNT' })
  })
})
