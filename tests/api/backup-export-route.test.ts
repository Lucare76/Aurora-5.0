import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)

const userId = '11111111-1111-4111-8111-111111111111'
const accountId = '22222222-2222-4222-8222-222222222222'
const categoryId = '33333333-3333-4333-8333-333333333333'
const transactionId = '44444444-4444-4444-8444-444444444444'

type TableName =
  | 'profiles'
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'budgets'
  | 'recurring_rules'
  | 'loans'
  | 'loan_payments'
  | 'birthdays'
  | 'birthday_reminder_log'
  | 'audit_logs'

type TableData = Record<TableName, unknown[]>
type QueryCall = {
  table: string
  select?: string
  filters: Array<{ column: string; value: unknown }>
}

async function importRoute() {
  return import('@/app/api/backup/export/route')
}

describe('backup export API route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('restituisce 401 se utente non autenticato', async () => {
    mockSupabase({ authenticated: false })
    const { GET } = await importRoute()

    const response = await GET()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Non autenticato' })
  })

  it('genera un download JSON Backup v1 verificato per utente autenticato', async () => {
    const { calls } = mockSupabase()
    const { GET } = await importRoute()

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="aurora-backup-v1-\d{4}-\d{2}-\d{2}-\d{6}\.json"$/,
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(body.format).toBe('aurora-backup')
    expect(body.schemaVersion).toBe(1)
    expect(body.integrity.checksum).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(body.integrity.recordCounts).toMatchObject({
      accounts: 1,
      categories: 1,
      transactions: 1,
    })
    expect(body.data.accounts[0]).not.toHaveProperty('user_id')
    expect(body.data.transactions[0]).not.toHaveProperty('user_id')
    expect(calls.every((call) => call.filters.some((filter) => filter.value === userId))).toBe(true)
  })

  it('non esegue scritture o RPC durante il backup', async () => {
    const { writes, rpcs } = mockSupabase()
    const { GET } = await importRoute()

    await GET()

    expect(writes).toEqual([])
    expect(rpcs).toEqual([])
  })

  it('supporta utente autenticato senza dati applicativi', async () => {
    mockSupabase({
      data: {
        ...baseTableData(),
        accounts: [],
        categories: [],
        transactions: [],
      },
    })
    const { GET } = await importRoute()

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.integrity.recordCounts.accounts).toBe(0)
    expect(body.integrity.recordCounts.transactions).toBe(0)
  })

  it('restituisce 500 se una query fallisce senza esporre dettagli tecnici', async () => {
    mockSupabase({ errors: { accounts: 'connection failed with private detail' } })
    const { GET } = await importRoute()

    const response = await GET()

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Non è stato possibile creare un backup verificato. Nessun dato è stato modificato.',
    })
  })

  it('blocca il download se il backup generato contiene una relazione orfana', async () => {
    const data = baseTableData()
    data.transactions = [
      {
        ...transactionRow(),
        account_id: '22222222-2222-4222-8222-222222229999',
      },
    ]
    mockSupabase({ data })
    const { GET } = await importRoute()

    const response = await GET()

    expect(response.status).toBe(500)
  })
})

function mockSupabase(options: {
  authenticated?: boolean
  data?: TableData
  errors?: Partial<Record<TableName, string>>
} = {}) {
  const calls: QueryCall[] = []
  const writes: string[] = []
  const rpcs: string[] = []
  const data = options.data ?? baseTableData()
  const errors = options.errors ?? {}

  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.authenticated === false ? null : { id: userId, email: 'luca@example.test' },
        },
        error: null,
      }),
    },
    from: vi.fn((table: TableName) => {
      const call: QueryCall = { table, filters: [] }
      calls.push(call)

      const builder = {
        select: vi.fn((select: string) => {
          call.select = select
          return builder
        }),
        eq: vi.fn((column: string, value: unknown) => {
          call.filters.push({ column, value })
          return builder
        }),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve({
          data: errors[table] ? null : (data[table][0] ?? null),
          error: errors[table] ? { message: errors[table] } : null,
        })),
        insert: vi.fn(() => {
          writes.push(table)
          return builder
        }),
        update: vi.fn(() => {
          writes.push(table)
          return builder
        }),
        delete: vi.fn(() => {
          writes.push(table)
          return builder
        }),
        then: (resolve: (value: unknown) => void) => resolve({
          data: errors[table] ? null : data[table],
          error: errors[table] ? { message: errors[table] } : null,
        }),
      }

      return builder
    }),
    rpc: vi.fn((name: string) => {
      rpcs.push(name)
      return Promise.resolve({ data: null, error: null })
    }),
  } as never)

  return { calls, writes, rpcs }
}

function baseTableData(): TableData {
  return {
    profiles: [profileRow()],
    accounts: [accountRow()],
    categories: [categoryRow()],
    transactions: [transactionRow()],
    budgets: [],
    recurring_rules: [],
    loans: [],
    loan_payments: [],
    birthdays: [],
    birthday_reminder_log: [],
    audit_logs: [],
  }
}

function profileRow() {
  return {
    id: userId,
    display_name: 'Luca',
    avatar_url: null,
    currency: 'EUR',
    locale: 'it-IT',
    timezone: 'Europe/Rome',
    onboarding_done: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  }
}

function accountRow() {
  return {
    id: accountId,
    user_id: userId,
    name: 'Bancoposta',
    type: 'checking',
    color: null,
    icon: null,
    balance: 100,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  }
}

function categoryRow() {
  return {
    id: categoryId,
    user_id: userId,
    name: 'Casa',
    type: 'expense',
    color: null,
    icon: null,
    parent_id: null,
    is_default: true,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function transactionRow() {
  return {
    id: transactionId,
    user_id: userId,
    account_id: accountId,
    category_id: categoryId,
    type: 'expense',
    amount: 10,
    description: 'Spesa',
    notes: null,
    date: '2026-07-17',
    transfer_peer_id: null,
    recurring_id: null,
    receipt_url: null,
    receipt_data: null,
    created_at: '2026-07-17T12:00:00.000Z',
    updated_at: '2026-07-17T12:00:00.000Z',
  }
}
