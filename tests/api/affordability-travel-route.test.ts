import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const createClientMock = vi.mocked(createClient)
const userId = '11111111-1111-4111-8111-111111111111'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    simulationName: 'Vacanza',
    currency: 'EUR',
    travelers: 2,
    adults: 2,
    children: 0,
    bookingDate: '2026-07-01',
    departureDate: '2026-10-01',
    returnDate: '2026-10-07',
    transport: { mainTrip: 400 },
    lodging: { totalCost: 900 },
    meals: { mode: 'daily_budget', dailyBudgetPerPerson: 35 },
    activities: { excursions: 250 },
    extras: { contingency: 150 },
    ...overrides,
  }
}

function builder(table: string, writes: string[]) {
  const b: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit']) b[method] = vi.fn(() => b)
  b.insert = vi.fn(() => { writes.push(table); return b })
  b.update = vi.fn(() => { writes.push(table); return b })
  b.delete = vi.fn(() => { writes.push(table); return b })
  b.then = (resolve: (value: unknown) => void) => {
    const rows: Record<string, unknown[]> = {
      accounts: [{ id: 'a1', user_id: userId, name: 'Conto', type: 'checking', balance: 10000, currency: 'EUR', is_active: true, is_hidden: false, sort_order: 0, color: null, icon: null, created_at: '2026-01-01', updated_at: '2026-01-01' }],
      recurring_rules: [{ id: 'r1', type: 'income', amount: 3000, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true }],
      transactions: [],
      loans: [],
      loan_payments: [],
      savings_goals: [],
      goal_contributions: [],
    }
    resolve({ data: rows[table] ?? [], error: null })
  }
  return b
}

function mockSupabase(options: { authenticated?: boolean } = {}) {
  const writes: string[] = []
  const rpcs: string[] = []
  createClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.authenticated === false ? null : { id: userId } }, error: null }) },
    from: vi.fn((table: string) => builder(table, writes)),
    rpc: vi.fn((name: string) => { rpcs.push(name); return Promise.resolve({ data: null, error: null }) }),
  } as never)
  return { writes, rpcs }
}

function request(body: unknown) {
  return new Request('http://localhost/api/affordability/travel/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function route() {
  return import('@/app/api/affordability/travel/calculate/route')
}

describe('POST /api/affordability/travel/calculate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 without authentication', async () => {
    mockSupabase({ authenticated: false })
    const { POST } = await route()
    expect((await POST(request(payload()))).status).toBe(401)
  })

  it('returns 422 for invalid input', async () => {
    mockSupabase()
    const { POST } = await route()
    expect((await POST(request(payload({ travelers: 0 })))).status).toBe(422)
  })

  it('calculates valid travel and does not write or call RPC', async () => {
    const { writes, rpcs } = mockSupabase()
    const { POST } = await route()
    const response = await POST(request(payload()))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.engineVersion).toBe('1.1.0-travel')
    expect(body.data.travelMetrics.totalTripCost).toBeGreaterThan(0)
    expect(JSON.stringify(body)).not.toContain(userId)
    expect(writes).toEqual([])
    expect(rpcs).toEqual([])
  })

  it('rate limits excessive requests', async () => {
    mockSupabase()
    const { POST } = await route()
    let response: Response | null = null
    for (let i = 0; i < 21; i++) response = await POST(request(payload({ simulationName: `Vacanza ${i}` })))
    expect(response?.status).toBe(429)
  })
})
