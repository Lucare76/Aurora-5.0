import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/data-integrity/service', () => ({
  getDataIntegrityIssue: vi.fn(),
  updateDataIntegrityIssueStatus: vi.fn(),
  DataIntegrityError: class DataIntegrityError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message)
      this.name = 'DataIntegrityError'
    }
  },
}))

import { createClient } from '@/lib/supabase/server'
import { getDataIntegrityIssue, updateDataIntegrityIssueStatus } from '@/lib/data-integrity/service'

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.test' }
const txA = '22222222-2222-4222-8222-222222222222'
const txB = '33333333-3333-4333-8333-333333333333'
const txOther = '44444444-4444-4444-8444-444444444444'

describe('Data Integrity duplicate issue route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.mocked(getDataIntegrityIssue).mockResolvedValue(issue() as any)
    vi.mocked(updateDataIntegrityIssueStatus).mockResolvedValue({ ...issue(), status: 'resolved' } as any)
  })

  it('GET restituisce confronto per exact duplicate con due movimenti', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await GET(new Request('http://localhost/api/data-integrity/issues/i1/duplicate'), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.movements).toHaveLength(2)
    expect(body.movements[0]).toMatchObject({ id: txA, accountName: 'Bancoposta', categoryName: 'Metro', sourceFingerprint: 'source-a' })
  })

  it('GET mostra possibile duplicato con categoria diversa', async () => {
    vi.mocked(getDataIntegrityIssue).mockResolvedValue(issue('TRANSACTION_POSSIBLE_DUPLICATE') as any)
    mockSupabase({ categoryB: 'Commissioni Banca' })
    const { GET } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await GET(new Request('http://localhost/api/data-integrity/issues/i1/duplicate'), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.movements.map((movement: any) => movement.categoryName)).toEqual(['Metro', 'Commissioni Banca'])
  })

  it('blocca utente non autenticato', async () => {
    mockSupabase({ user: null })
    const { GET } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await GET(new Request('http://localhost/api/data-integrity/issues/i1/duplicate'), params())

    expect(response.status).toBe(401)
  })

  it('DELETE rifiuta issue non open', async () => {
    vi.mocked(getDataIntegrityIssue).mockResolvedValue({ ...issue(), status: 'resolved' } as any)
    mockSupabase()
    const { DELETE } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await DELETE(request({ transaction_id: txA }), params())

    expect(response.status).toBe(409)
  })

  it('DELETE rifiuta entity non appartenente alla issue', async () => {
    mockSupabase()
    const { DELETE } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await DELETE(request({ transaction_id: txOther }), params())

    expect(response.status).toBe(400)
  })

  it('DELETE rifiuta movimento mancante', async () => {
    mockSupabase({ transactions: [transaction(txA)] })
    const { DELETE } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await DELETE(request({ transaction_id: txB }), params())

    expect(response.status).toBe(404)
  })

  it('DELETE rifiuta transfer e ricorrenze', async () => {
    mockSupabase({ transactions: [transaction(txA, { type: 'transfer' }), transaction(txB)] })
    const { DELETE } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await DELETE(request({ transaction_id: txA }), params())

    expect(response.status).toBe(409)
  })

  it('DELETE Movimento A usa RPC atomica e marca la issue resolved', async () => {
    const calls: unknown[] = []
    mockSupabase({ calls })
    const { DELETE } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await DELETE(request({ transaction_id: txA }), params())

    expect(response.status).toBe(200)
    expect(calls).toContainEqual({ name: 'delete_transaction_atomic', params: { p_transaction_id: txA } })
    expect(updateDataIntegrityIssueStatus).toHaveBeenCalledWith(expect.anything(), user.id, 'issue-1', 'resolved', null)
  })

  it('DELETE Movimento B usa RPC atomica', async () => {
    const calls: unknown[] = []
    mockSupabase({ calls })
    const { DELETE } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await DELETE(request({ transaction_id: txB }), params())

    expect(response.status).toBe(200)
    expect(calls).toContainEqual({ name: 'delete_transaction_atomic', params: { p_transaction_id: txB } })
  })

  it('DELETE sanitizza errore RPC senza modificare lo stato issue', async () => {
    mockSupabase({ rpcError: true })
    const { DELETE } = await import('@/app/api/data-integrity/issues/[id]/duplicate/route')

    const response = await DELETE(request({ transaction_id: txA }), params())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('TRANSACTION_DELETE_FAILED')
    expect(updateDataIntegrityIssueStatus).not.toHaveBeenCalled()
  })

  it('Non e un duplicato usa lo status endpoint senza modificare movimenti', async () => {
    mockSupabase()
    const { POST } = await import('@/app/api/data-integrity/issues/[id]/status/route')

    const response = await POST(request({ status: 'ignored', reason: 'Operazioni distinte' }), params())

    expect(response.status).toBe(200)
    expect(updateDataIntegrityIssueStatus).toHaveBeenCalledWith(expect.anything(), user.id, 'issue-1', 'ignored', 'Operazioni distinte')
  })
})

function params() {
  return { params: Promise.resolve({ id: 'issue-1' }) }
}

function request(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

function issue(ruleCode = 'TRANSACTION_EXACT_DUPLICATE') {
  return {
    id: 'issue-1',
    userId: user.id,
    fingerprint: 'fp-1',
    rulesetVersion: 'test',
    ruleCode,
    category: 'transactions',
    severity: 'WARNING',
    status: 'open',
    title: 'Duplicato probabile',
    description: 'Descrizione',
    explanation: 'Spiegazione',
    impact: 'Impatto',
    recommendation: 'Raccomandazione',
    confidence: 'medium',
    entityType: 'transaction',
    entityIds: [txA, txB],
    evidence: [],
    allowedActions: [],
    sourcePath: '/transactions',
  }
}

function transaction(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: user.id,
    account_id: '55555555-5555-4555-8555-555555555555',
    category_id: id === txB ? '77777777-7777-4777-8777-777777777777' : '66666666-6666-4666-8666-666666666666',
    type: 'expense',
    amount: 3,
    description: 'UNICOCAMPANIA',
    date: '2026-04-21',
    transfer_peer_id: null,
    recurring_id: null,
    receipt_data: { import_fingerprint: id === txA ? 'source-a' : 'source-b' },
    created_at: '2026-07-14T12:00:49.612142+00:00',
    updated_at: '2026-07-14T12:00:49.612142+00:00',
    ...overrides,
  }
}

function mockSupabase(options: {
  user?: typeof user | null
  transactions?: any[]
  categoryB?: string
  rpcError?: boolean
  calls?: unknown[]
} = {}) {
  const calls = options.calls ?? []
  const tableRows: Record<string, unknown[]> = {
    transactions: options.transactions ?? [transaction(txA), transaction(txB)],
    accounts: [{ id: '55555555-5555-4555-8555-555555555555', name: 'Bancoposta' }],
    categories: [
      { id: '66666666-6666-4666-8666-666666666666', name: 'Metro' },
      { id: '77777777-7777-4777-8777-777777777777', name: options.categoryB ?? 'Metro' },
    ],
  }
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === undefined ? user : options.user }, error: null }) },
    rpc: vi.fn((name: string, params: unknown) => {
      calls.push({ name, params })
      return Promise.resolve({ data: null, error: options.rpcError ? { message: 'raw database failure' } : null })
    }),
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        then: (resolve: (value: unknown) => void) => resolve({ data: tableRows[table] ?? [], error: null }),
      }
      return builder
    }),
  } as any)
}
