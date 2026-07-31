import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'

// Only the Supabase boundary is mocked — the real Sprint 24A adapters, engine
// and the real domain affordability engines run unmocked, exactly as the
// sprint rules require ("mockare soltanto il confine API, non il core").
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

const USER_ID = 'user-1'

function makeQueryBuilder(data: unknown[] | null, error: unknown = null) {
  const builder: Record<string, unknown> = {}
  const chain = ['select', 'eq', 'order', 'limit', 'in', 'single'] as const
  for (const method of chain) {
    builder[method] = vi.fn(() => builder)
  }
  ;(builder as { then: (resolve: (v: { data: unknown[] | null; error: unknown }) => unknown) => unknown }).then = (resolve) =>
    resolve({ data, error })
  return builder
}

type TableData = Record<string, unknown[] | null>
type TableErrors = Record<string, unknown>

function makeSupabase(
  tableData: TableData,
  user: { id: string } | null = { id: USER_ID },
  throwOnTable?: string,
  tableErrors: TableErrors = {},
) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (throwOnTable && table === throwOnTable) {
        throw new Error('boom: simulated internal failure')
      }
      return makeQueryBuilder(table in tableData ? tableData[table] : [], tableErrors[table] ?? null)
    }),
  }
}

const BASE_TABLE_DATA: TableData = {
  accounts: [{ id: 'acc-1', user_id: USER_ID, balance: 5000, is_active: true, currency: 'EUR' }],
  recurring_rules: [
    { id: 'rec-income', type: 'income', amount: 2000, frequency: 'monthly', start_date: '2026-01-01', end_date: null, next_due_date: '2026-08-01', is_active: true },
    { id: 'rec-expense', type: 'expense', amount: 1200, frequency: 'monthly', start_date: '2026-01-01', end_date: null, next_due_date: '2026-08-01', is_active: true },
  ],
  transactions: [],
  loans: [],
  loan_payments: [],
  savings_goals: [],
  goal_contributions: [],
}

function mockSupabaseWith(
  tableData: TableData = BASE_TABLE_DATA,
  user: { id: string } | null = { id: USER_ID },
  throwOnTable?: string,
  tableErrors: TableErrors = {},
) {
  ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(makeSupabase(tableData, user, throwOnTable, tableErrors))
}

function makeRequest(body: unknown): Request {
  return {
    json: () => (typeof body === 'function' ? body() : Promise.resolve(body)),
  } as unknown as Request
}

const genericScenario = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  domain: 'generic',
  input: {
    purchaseName: `Acquisto ${id}`,
    totalPrice: 800,
    paymentMode: 'IMMEDIATE',
    purchaseDate: '2026-08-01',
    ...overrides,
  },
})

const carScenario = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  domain: 'car',
  input: {
    carName: `Auto ${id}`,
    purchasePrice: 20000,
    paymentMode: 'IMMEDIATE',
    purchaseDate: '2026-08-01',
    currency: 'EUR',
    ownershipYears: 5,
    ...overrides,
  },
})

const homeScenario = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  domain: 'home',
  input: {
    simulationName: `Casa ${id}`,
    condition: 'used',
    purpose: 'primary_home',
    askingPrice: 200000,
    agreedPrice: 195000,
    purchaseDate: '2026-08-01',
    currency: 'EUR',
    ownershipYears: 10,
    paymentMode: 'IMMEDIATE',
    ...overrides,
  },
})

const travelScenario = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  domain: 'travel',
  input: {
    simulationName: `Viaggio ${id}`,
    currency: 'EUR',
    travelers: 2,
    bookingDate: '2026-08-01',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
    ...overrides,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockSupabaseWith()
})

describe('POST /api/affordability/compare', () => {
  it('confronta 2 scenari validi e restituisce 200 con un risultato completo', async () => {
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'BALANCED' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.scenarios).toHaveLength(2)
    expect(body.data.ranking).toHaveLength(2)
    expect(body.data.scores).toHaveLength(2)
    expect(body.data.profile).toBe('BALANCED')
    expect(typeof body.data.disclaimer).toBe('string')
  })

  it('confronta 4 scenari validi (uno per dominio) e restituisce 200', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [genericScenario('s1'), carScenario('s2'), homeScenario('s3'), travelScenario('s4')],
        profile: 'PROTECT_LIQUIDITY',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.scenarios).toHaveLength(4)
  })

  it('gestisce un confronto cross-dominio con compatibilità FINANCIAL_ONLY', async () => {
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), homeScenario('s2')], profile: 'BALANCED' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.compatibility.sameType).toBe(false)
    expect(body.data.compatibility.level).toBe('FINANCIAL_ONLY')
  })

  it('rifiuta un body assente restituendo INVALID_BODY', async () => {
    const res = await POST(makeRequest(() => Promise.reject(new Error('no body'))))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_BODY')
  })

  it('rifiuta un JSON non valido restituendo INVALID_BODY', async () => {
    const res = await POST(makeRequest(() => Promise.reject(new SyntaxError('Unexpected token'))))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_BODY')
  })

  it('rifiuta meno di 2 scenari', async () => {
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1')], profile: 'BALANCED' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rifiuta più di 4 scenari', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [genericScenario('s1'), genericScenario('s2'), genericScenario('s3'), genericScenario('s4'), genericScenario('s5')],
        profile: 'BALANCED',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rifiuta ID scenario duplicati', async () => {
    const res = await POST(makeRequest({ scenarios: [genericScenario('dup'), carScenario('dup')], profile: 'BALANCED' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rifiuta un dominio non valido', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [genericScenario('s1'), { id: 's2', domain: 'boat', input: {} }],
        profile: 'BALANCED',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rifiuta un input incompatibile con il dominio dichiarato (adapter incompatibile)', async () => {
    // domain "car" but input shaped like a home scenario
    const res = await POST(
      makeRequest({
        scenarios: [genericScenario('s1'), { id: 's2', domain: 'car', input: homeScenario('x').input }],
        profile: 'BALANCED',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rifiuta una valuta incompatibile tra scenari con CURRENCY_MISMATCH', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [carScenario('s1', { currency: 'EUR' }), carScenario('s2', { currency: 'USD' })],
        profile: 'BALANCED',
      }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('CURRENCY_MISMATCH')
  })

  it('rifiuta un profilo non valido', async () => {
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'NOT_A_PROFILE' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rifiuta il profilo CUSTOM senza pesi personalizzati', async () => {
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'CUSTOM' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rifiuta pesi personalizzati con somma non positiva (INVALID_WEIGHTS)', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [genericScenario('s1'), carScenario('s2')],
        profile: 'CUSTOM',
        customWeights: { initialCashOutflow: 0, totalCashOutflow: 0 },
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_WEIGHTS')
  })

  it('accetta pesi personalizzati validi con il profilo CUSTOM', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [genericScenario('s1'), carScenario('s2')],
        profile: 'CUSTOM',
        customWeights: { initialCashOutflow: 50, residualLiquidity: 50 },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.profile).toBe('CUSTOM')
  })

  it('rifiuta valori NaN/Infinity nello scenario', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [genericScenario('s1', { totalPrice: Number.POSITIVE_INFINITY }), carScenario('s2')],
        profile: 'BALANCED',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rifiuta pesi personalizzati non numerici', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [genericScenario('s1'), carScenario('s2')],
        profile: 'CUSTOM',
        customWeights: { initialCashOutflow: Number.NaN },
      }),
    )
    expect(res.status).toBe(400)
  })

  it('restituisce CALCULATION_FAILED senza esporre dettagli interni in caso di errore inatteso', async () => {
    mockSupabaseWith(BASE_TABLE_DATA, { id: USER_ID }, 'accounts')
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'BALANCED' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('CALCULATION_FAILED')
    const serialized = JSON.stringify(body)
    expect(serialized).not.toMatch(/at .*\.(js|ts):\d+/)
    expect(serialized).not.toContain('boom: simulated internal failure')
  })

  it('richiede autenticazione', async () => {
    mockSupabaseWith(BASE_TABLE_DATA, null)
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'BALANCED' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('rifiuta un accountId non posseduto dall\'utente', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [
          genericScenario('s1', { accountId: '11111111-1111-4111-8111-111111111111' }),
          carScenario('s2'),
        ],
        profile: 'BALANCED',
      }),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('rifiuta un debitAccountId non posseduto dall\'utente', async () => {
    const res = await POST(
      makeRequest({
        scenarios: [
          genericScenario('s1', { paymentMode: 'INSTALLMENTS', installmentAmount: 100, numberOfInstallments: 12, debitAccountId: '22222222-2222-4222-8222-222222222222' }),
          carScenario('s2'),
        ],
        profile: 'BALANCED',
      }),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('gestisce dati mancanti (data: null) dalle query Supabase ripiegando su liste vuote', async () => {
    mockSupabaseWith({ ...BASE_TABLE_DATA, loans: null, goal_contributions: null })
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'BALANCED' }))
    expect(res.status).toBe(200)
  })

  it('non calcola il confronto se una query Supabase restituisce errore', async () => {
    mockSupabaseWith(BASE_TABLE_DATA, { id: USER_ID }, undefined, { transactions: { message: 'permission denied' } })
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'BALANCED' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('CALCULATION_FAILED')
    expect(JSON.stringify(body)).not.toContain('permission denied')
  })

  it('restituisce CALCULATION_FAILED anche quando viene lanciato un valore non Error', async () => {
    mockSupabaseWith(BASE_TABLE_DATA, { id: USER_ID })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn(() => {
        throw 'non-error thrown value'
      }),
    })
    const res = await POST(makeRequest({ scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'BALANCED' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('CALCULATION_FAILED')
  })

  it('non muta gli scenari di input restituiti nel risultato rispetto ai criteri richiesti', async () => {
    const payload = { scenarios: [genericScenario('s1'), carScenario('s2')], profile: 'BALANCED' }
    const originalScenarios = JSON.parse(JSON.stringify(payload.scenarios))
    await POST(makeRequest(payload))
    expect(payload.scenarios).toEqual(originalScenarios)
  })
})

describe('GET /api/affordability/compare', () => {
  it('restituisce METHOD_NOT_ALLOWED', async () => {
    const res = await GET()
    expect(res.status).toBe(405)
    const body = await res.json()
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED')
  })
})
