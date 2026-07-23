import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const userId = '11111111-1111-4111-8111-111111111111'

function makeBuilder(data: unknown[] = []) {
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'gte', 'lte', 'not', 'in', 'order', 'limit', 'is']
  for (const m of methods) {
    builder[m] = vi.fn(() => builder)
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data, error: null })
  return builder
}

function mockSupabase(options: { authenticated?: boolean } = {}) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.authenticated === false ? null : { id: userId, email: 'test@example.com' },
        },
        error: null,
      }),
    },
    from: vi.fn(() => makeBuilder()),
  } as never)
}

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('restituisce 401 se non autenticato', async () => {
    mockSupabase({ authenticated: false })
    const { GET } = await import('@/app/api/dashboard/route')

    const response = await GET()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'UNAUTHENTICATED' })
  })

  it('restituisce 200 con payload completo', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/dashboard/route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('netWorth')
    expect(body).toHaveProperty('netWorthVsPrevMonth')
    expect(body).toHaveProperty('monthIncome')
    expect(body).toHaveProperty('monthExpense')
    expect(body).toHaveProperty('monthBalance')
    expect(body).toHaveProperty('topCategories')
    expect(body).toHaveProperty('recentTransactions')
    expect(body).toHaveProperty('insights')
    expect(body).toHaveProperty('budgetSummary')
    expect(body).toHaveProperty('goalsSummary')
    expect(body).toHaveProperty('netWorthTrend')
    expect(body).toHaveProperty('endOfMonthForecast')
    expect(body).toHaveProperty('monthStats')
    expect(body).toHaveProperty('monthRecords')
    expect(body).toHaveProperty('timeline')
    expect(body).toHaveProperty('cashFlowProjection')
    expect(body).toHaveProperty('upcomingBirthdays')
    expect(body).toHaveProperty('firstUseStatus')
    expect(body).toHaveProperty('generatedAt')
  })

  it('restituisce struttura corretta con dati vuoti', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/dashboard/route')

    const response = await GET()
    const body = await response.json()

    expect(body.accounts).toEqual([])
    expect(body.topCategories).toEqual([])
    expect(body.insights).toEqual([])
    expect(body.budgetSummary).toMatchObject({ totalBudgets: 0, atRiskCount: 0, exceededCount: 0, topRiskBudgets: [] })
    expect(body.goalsSummary).toMatchObject({ totalGoals: 0, activeGoals: 0, completedGoals: 0 })
    expect(body.netWorthTrend).toHaveLength(12)
    expect(body.endOfMonthForecast).toHaveProperty('hasEnoughData')
    expect(body.monthStats).toHaveProperty('txCount')
    expect(body.monthRecords).toHaveProperty('totalOps')
    expect(Array.isArray(body.timeline)).toBe(true)
    expect(body.monthlyChart).toHaveLength(6)
    expect(body.cashFlowProjection).toHaveLength(31)
    expect(body.firstUseStatus.hasAccount).toBe(false)
    expect(body.firstUseStatus.hasMovement).toBe(false)
    expect(body.firstUseStatus.hasBudget).toBe(false)
  })

  it('calcola correttamente netWorth dalla somma dei saldi', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === 'accounts') {
          return makeBuilder([
            { id: 'a1', name: 'Conto A', type: 'checking', balance: 1000, currency: 'EUR', color: null, icon: null, is_active: true, is_hidden: false },
            { id: 'a2', name: 'Conto B', type: 'savings',  balance: 2500, currency: 'EUR', color: null, icon: null, is_active: true, is_hidden: false },
          ])
        }
        return makeBuilder()
      }),
    } as never)
    const { GET } = await import('@/app/api/dashboard/route')

    const response = await GET()
    const body = await response.json()

    expect(body.netWorth).toBe(3500)
    expect(body.accounts).toHaveLength(2)
  })

  it('aggrega entrate e uscite del mese corrente correttamente', async () => {
    const now = new Date()
    const dateThisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`

    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === 'transactions') {
          return makeBuilder([
            { id: 't1', account_id: 'a1', category_id: null, type: 'income',  amount: '500', description: null, date: dateThisMonth, transfer_peer_id: null },
            { id: 't2', account_id: 'a1', category_id: null, type: 'expense', amount: '200', description: null, date: dateThisMonth, transfer_peer_id: null },
            { id: 't3', account_id: 'a1', category_id: null, type: 'income',  amount: '100', description: null, date: dateThisMonth, transfer_peer_id: 'peer-uuid' },
          ])
        }
        return makeBuilder()
      }),
    } as never)
    const { GET } = await import('@/app/api/dashboard/route')

    const response = await GET()
    const body = await response.json()

    expect(body.monthIncome).toBe(500)
    expect(body.monthExpense).toBe(200)
    expect(body.monthBalance).toBe(300)
  })

  it('non espone dati sensibili nella risposta', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/dashboard/route')

    const response = await GET()
    const body = await response.json()
    const bodyStr = JSON.stringify(body)

    expect(bodyStr).not.toContain('user_id')
    expect(bodyStr).not.toContain('password')
    expect(bodyStr).not.toContain(userId)
  })

  it('include header Cache-Control: no-store', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/dashboard/route')

    const response = await GET()

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
