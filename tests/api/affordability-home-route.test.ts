import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const userId = '11111111-1111-4111-8111-111111111111'
const accountId = '22222222-2222-4222-8222-222222222222'

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    simulationName: 'Casa test',
    condition: 'used',
    purpose: 'primary_home',
    askingPrice: 220000,
    agreedPrice: 210000,
    purchaseDate: '2026-09-01',
    currency: 'EUR',
    ownershipYears: 20,
    paymentMode: 'MORTGAGE',
    accountId,
    downPayment: 40000,
    mortgageAmount: 170000,
    mortgageDurationMonths: 300,
    mortgageMonthlyPayment: 720,
    acquisitionCosts: { notary: 3500, taxes: 2500, agency: 6000 },
    condominium: { monthly: 120 },
    utilities: { electricity: 80, gas: 70, water: 25, internet: 30, waste: 20 },
    insurance: { homeAnnual: 300 },
    recurringTaxes: { imuAnnual: 600, tariAnnual: 250 },
    maintenance: { ordinaryAnnual: 900 },
    currentHousing: { type: 'rent', rentMonthly: 760 },
    residualValue: { estimatedPropertyValue: 230000, residualMortgageDebt: 120000 },
    horizonMonths: 360,
    ...overrides,
  }
}

function makeBuilder(table: string, writes: string[], options: { accountFound?: boolean; accountCurrency?: string } = {}) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit']) builder[method] = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve({
    data: options.accountFound === false ? null : { id: accountId, currency: options.accountCurrency ?? 'EUR', is_active: true },
    error: options.accountFound === false ? { message: 'not found' } : null,
  }))
  builder.insert = vi.fn(() => { writes.push(table); return builder })
  builder.update = vi.fn(() => { writes.push(table); return builder })
  builder.delete = vi.fn(() => { writes.push(table); return builder })
  builder.then = (resolve: (value: unknown) => void) => {
    const rows: Record<string, unknown[]> = {
      accounts: [{ id: accountId, user_id: userId, name: 'Conto', type: 'checking', balance: 80000, currency: 'EUR', is_active: true, is_hidden: false, sort_order: 0, color: null, icon: null, created_at: '2026-01-01', updated_at: '2026-01-01' }],
      recurring_rules: [
        { id: 'r1', type: 'income', amount: 3500, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
        { id: 'r2', type: 'expense', amount: 1800, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
      ],
      transactions: [],
      loans: [],
      loan_payments: [],
      savings_goals: [],
      goal_contributions: [],
    }
    resolve({ data: rows[table] ?? [], error: null })
  }
  return builder
}

function mockSupabase(options: { authenticated?: boolean; accountFound?: boolean; accountCurrency?: string } = {}) {
  const writes: string[] = []
  const rpcs: string[] = []
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.authenticated === false ? null : { id: userId, email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => makeBuilder(table, writes, options)),
    rpc: vi.fn((name: string) => {
      rpcs.push(name)
      return Promise.resolve({ data: null, error: null })
    }),
  } as never)
  return { writes, rpcs }
}

function request(body: unknown) {
  return new Request('http://localhost/api/affordability/home/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function importRoute() {
  return import('@/app/api/affordability/home/calculate/route')
}

describe('POST /api/affordability/home/calculate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 without session', async () => {
    mockSupabase({ authenticated: false })
    const { POST } = await importRoute()
    const response = await POST(request(validPayload()))
    expect(response.status).toBe(401)
  })

  it('returns 422 for invalid input', async () => {
    mockSupabase()
    const { POST } = await importRoute()
    const response = await POST(request(validPayload({ agreedPrice: 0 })))
    expect(response.status).toBe(422)
  })

  it('returns 404 for account owned by another user or missing', async () => {
    mockSupabase({ accountFound: false })
    const { POST } = await importRoute()
    const response = await POST(request(validPayload()))
    expect(response.status).toBe(404)
  })

  it('returns 422 for incompatible account currency', async () => {
    mockSupabase({ accountCurrency: 'USD' })
    const { POST } = await importRoute()
    const response = await POST(request(validPayload()))
    expect(response.status).toBe(422)
  })

  it('calculates a valid home purchase without writes or RPC', async () => {
    const { writes, rpcs } = mockSupabase()
    const { POST } = await importRoute()
    const response = await POST(request(validPayload()))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.engineVersion).toBe('1.1.0-home')
    expect(body.data.homeMetrics).toBeDefined()
    expect(JSON.stringify(body)).not.toContain(userId)
    expect(writes).toEqual([])
    expect(rpcs).toEqual([])
  })

  it('rate limits excessive requests', async () => {
    mockSupabase()
    const { POST } = await importRoute()
    let response: Response | null = null
    for (let i = 0; i < 21; i++) response = await POST(request(validPayload({ simulationName: `Casa ${i}` })))
    expect(response?.status).toBe(429)
  })
})
