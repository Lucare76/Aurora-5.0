import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const userId     = '11111111-1111-4111-8111-111111111111'
const budgetId   = '22222222-2222-4222-8222-222222222222'
const categoryId = '33333333-3333-4333-8333-333333333333'

function makeBuilder(data: unknown = null, error: unknown = null) {
  const b: Record<string, unknown> = {}
  const chain = ['select', 'eq', 'gte', 'lte', 'in', 'is', 'order', 'insert', 'update', 'delete', 'upsert']
  for (const m of chain) b[m] = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  b.single      = vi.fn(() => Promise.resolve({ data, error }))
  b.then        = (resolve: (v: unknown) => void) => resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error })
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

// ── GET /api/budgets ───────────────────────────────────────────────────────

describe('GET /api/budgets', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(false),
      from: vi.fn(() => makeBuilder()),
    } as never)
    const { GET } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets')
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' })
  })

  it('returns 400 for invalid period params', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder()),
    } as never)
    const { GET } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets?year=abc&month=99')
    const res = await GET(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'INVALID_PERIOD' })
  })

  it('returns 200 with empty data when no budgets exist', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder([])),
    } as never)
    const { GET } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets?year=2026&month=7')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('includes Cache-Control: no-store header', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder([])),
    } as never)
    const { GET } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets')
    const res = await GET(req)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

// ── POST /api/budgets ──────────────────────────────────────────────────────

describe('POST /api/budgets', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(false),
      from: vi.fn(() => makeBuilder()),
    } as never)
    const { POST } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryId, year: 2026, month: 7, amount: 300 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing/invalid body', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder()),
    } as never)
    const { POST } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative amount', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder({ id: categoryId })),
    } as never)
    const { POST } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, year: 2026, month: 7, amount: -100 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'INVALID_AMOUNT' })
  })

  it('returns 404 when category not found', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder(null)),
    } as never)
    const { POST } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, year: 2026, month: 7, amount: 300 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'CATEGORY_NOT_FOUND' })
  })

  it('returns 409 when budget already exists for that category/month', async () => {
    const catBuilder  = makeBuilder({ id: categoryId })
    const insertBuilder = makeBuilder()
    insertBuilder.single = vi.fn(() => Promise.resolve({ data: null, error: { code: '23505' } }))

    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn((table: string) => {
        if (table === 'categories') return catBuilder
        return insertBuilder
      }),
    } as never)
    const { POST } = await import('@/app/api/budgets/route')
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, year: 2026, month: 7, amount: 300 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'BUDGET_ALREADY_EXISTS' })
  })
})

// ── PATCH /api/budgets/[id] ────────────────────────────────────────────────

describe('PATCH /api/budgets/[id]', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(false),
      from: vi.fn(() => makeBuilder()),
    } as never)
    const { PATCH } = await import('@/app/api/budgets/[id]/route')
    const req = new Request(`http://localhost/api/budgets/${budgetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500 }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: budgetId }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when budget not found', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder(null)),
    } as never)
    const { PATCH } = await import('@/app/api/budgets/[id]/route')
    const req = new Request(`http://localhost/api/budgets/${budgetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500 }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: budgetId }) })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'BUDGET_NOT_FOUND' })
  })

  it('returns 400 for invalid amount', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder({ id: budgetId })),
    } as never)
    const { PATCH } = await import('@/app/api/budgets/[id]/route')
    const req = new Request(`http://localhost/api/budgets/${budgetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 0 }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: budgetId }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'INVALID_AMOUNT' })
  })
})

// ── DELETE /api/budgets/[id] ───────────────────────────────────────────────

describe('DELETE /api/budgets/[id]', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(false),
      from: vi.fn(() => makeBuilder()),
    } as never)
    const { DELETE } = await import('@/app/api/budgets/[id]/route')
    const req = new Request(`http://localhost/api/budgets/${budgetId}`, { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: budgetId }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when budget not found', async () => {
    createClientMock.mockResolvedValue({
      ...mockAuth(),
      from: vi.fn(() => makeBuilder(null)),
    } as never)
    const { DELETE } = await import('@/app/api/budgets/[id]/route')
    const req = new Request(`http://localhost/api/budgets/${budgetId}`, { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: budgetId }) })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'BUDGET_NOT_FOUND' })
  })
})
