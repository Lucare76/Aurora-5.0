import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const userId = '00000000-0000-4000-8000-000000000001'
const accountId = '00000000-0000-4000-8000-0000000000a1'
const destinationAccountId = '00000000-0000-4000-8000-0000000000b2'
const transactionId = '00000000-0000-4000-8000-0000000000c3'
const categoryId = '00000000-0000-4000-8000-0000000000d4'

type RpcCall = {
  name: string
  params: Record<string, unknown>
}

const createClientMock = vi.mocked(createClient)

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/transactions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function makeRawRequest(body: string): Request {
  return new Request('http://localhost/api/transactions', {
    method: 'POST',
    body,
  })
}

function mockSupabase(options?: {
  authenticated?: boolean
  rpcError?: string | null
  rpcData?: unknown
}) {
  const calls: RpcCall[] = []

  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options?.authenticated === false ? null : { id: userId },
        },
      }),
    },
    rpc: vi.fn().mockImplementation((name: string, params: Record<string, unknown>) => {
      calls.push({ name, params })

      if (options?.rpcError) {
        return Promise.resolve({
          data: null,
          error: { message: options.rpcError },
        })
      }

      return Promise.resolve({
        data: options?.rpcData ?? transactionId,
        error: null,
      })
    }),
  } as never)

  return calls
}

async function importRoute() {
  return import('@/app/api/transactions/route')
}

describe('transactions API route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('returns 401 when the user is not authenticated', async () => {
      mockSupabase({ authenticated: false })
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody()))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Non autenticato' })
    })

    it('returns 400 when account_id is missing', async () => {
      mockSupabase()
      const { POST } = await importRoute()
      const body = validCreateBody()
      delete (body as { account_id?: string }).account_id

      const response = await POST(makeRequest(body))

      expect(response.status).toBe(400)
    })

    it('returns 400 for invalid transaction type', async () => {
      mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest({ ...validCreateBody(), type: 'bonus' }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for zero amount', async () => {
      mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest({ ...validCreateBody(), amount: 0 }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for negative amount', async () => {
      mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest({ ...validCreateBody(), amount: -1 }))

      expect(response.status).toBe(400)
    })

    it('returns 400 for transfer without destination and does not call the RPC', async () => {
      const calls = mockSupabase()
      const { POST } = await importRoute()
      const body = validCreateBody({ type: 'transfer' })
      delete (body as { category_id?: string }).category_id

      const response = await POST(makeRequest(body))

      expect(response.status).toBe(400)
      expect(calls).toHaveLength(0)
    })

    it('creates a valid income transaction', async () => {
      const calls = mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody({ type: 'income' })))

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({ data: transactionId })
      expect(calls[0]).toMatchObject({
        name: 'create_transaction_atomic',
        params: {
          p_type: 'income',
          p_amount: 120.5,
          p_account_id: accountId,
        },
      })
    })

    it('creates a valid expense transaction', async () => {
      const calls = mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody({ type: 'expense' })))

      expect(response.status).toBe(201)
      expect(calls[0].params.p_type).toBe('expense')
    })

    it('creates a valid transfer transaction', async () => {
      const calls = mockSupabase()
      const { POST } = await importRoute()
      const body = validCreateBody({
        type: 'transfer',
        destination_account_id: destinationAccountId,
      })
      delete (body as { category_id?: string }).category_id

      const response = await POST(makeRequest(body))

      expect(response.status).toBe(201)
      expect(calls[0]).toMatchObject({
        name: 'create_transaction_atomic',
        params: {
          p_type: 'transfer',
          p_destination_account_id: destinationAccountId,
        },
      })
    })

    it('maps not owned RPC errors to 403', async () => {
      mockSupabase({ rpcError: 'Source account not owned by current user' })
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody()))

      expect(response.status).toBe(403)
    })

    it('returns 400 when transfer destination equals source', async () => {
      const calls = mockSupabase()
      const { POST } = await importRoute()
      const body = validCreateBody({
        type: 'transfer',
        destination_account_id: accountId,
      })
      delete (body as { category_id?: string }).category_id

      const response = await POST(makeRequest(body))

      expect(response.status).toBe(400)
      expect(calls).toHaveLength(0)
    })

    it('returns 400 when a transfer includes category_id', async () => {
      const calls = mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(
        makeRequest(
          validCreateBody({
            type: 'transfer',
            destination_account_id: destinationAccountId,
            category_id: categoryId,
          }),
        ),
      )

      expect(response.status).toBe(400)
      expect(calls).toHaveLength(0)
    })

    it('returns 400 when income includes destination_account_id', async () => {
      const calls = mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(
        makeRequest(validCreateBody({ type: 'income', destination_account_id: destinationAccountId })),
      )

      expect(response.status).toBe(400)
      expect(calls).toHaveLength(0)
    })

    it('returns 400 when amount is a string', async () => {
      mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody({ amount: '120.50' })))

      expect(response.status).toBe(400)
    })

    it('returns 400 when amount is not a finite JSON number', async () => {
      mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody({ amount: Number.NaN })))

      expect(response.status).toBe(400)
    })

    it('returns 400 for invalid dates', async () => {
      mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody({ date: '2026-02-31' })))

      expect(response.status).toBe(400)
    })

    it('returns 400 for empty descriptions', async () => {
      mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody({ description: '   ' })))

      expect(response.status).toBe(400)
    })

    it('returns 400 for extra fields including user_id', async () => {
      const calls = mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody({ user_id: userId })))

      expect(response.status).toBe(400)
      expect(calls).toHaveLength(0)
    })

    it('maps constraint RPC errors to 409 with sanitized body', async () => {
      mockSupabase({ rpcError: 'duplicate key value violates unique constraint "secret_idx"' })
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody()))

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({ error: 'Errore nella creazione della transazione' })
    })

    it('maps unknown RPC errors to 500 with sanitized body', async () => {
      mockSupabase({ rpcError: 'database password leaked in internal stack' })
      const { POST } = await importRoute()

      const response = await POST(makeRequest(validCreateBody()))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Errore nella creazione della transazione' })
    })

    it('returns 400 for malformed JSON', async () => {
      mockSupabase()
      const { POST } = await importRoute()

      const response = await POST(makeRawRequest('{not-json'))

      expect(response.status).toBe(400)
    })
  })

  describe('PATCH', () => {
    it('returns 400 when transaction_id is missing', async () => {
      mockSupabase()
      const { PATCH } = await importRoute()
      const body = validPatchBody()
      delete (body as { transaction_id?: string }).transaction_id

      const response = await PATCH(makeRequest(body))

      expect(response.status).toBe(400)
    })

    it('returns 400 for invalid amount', async () => {
      mockSupabase()
      const { PATCH } = await importRoute()

      const response = await PATCH(makeRequest({ ...validPatchBody(), amount: 0 }))

      expect(response.status).toBe(400)
    })

    it('maps ownership errors to 403', async () => {
      mockSupabase({ rpcError: 'Transaction not owned by current user' })
      const { PATCH } = await importRoute()

      const response = await PATCH(makeRequest(validPatchBody()))

      expect(response.status).toBe(403)
    })

    it('updates a valid transaction through the atomic RPC', async () => {
      const calls = mockSupabase()
      const { PATCH } = await importRoute()

      const response = await PATCH(makeRequest(validPatchBody()))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ data: transactionId })
      expect(calls[0]).toMatchObject({
        name: 'update_transaction_atomic',
        params: {
          p_transaction_id: transactionId,
        },
      })
    })
  })

  describe('DELETE', () => {
    it('returns 400 when transaction_id is missing', async () => {
      mockSupabase()
      const { DELETE } = await importRoute()

      const response = await DELETE(makeRequest({}))

      expect(response.status).toBe(400)
    })

    it('maps not found RPC errors to 403', async () => {
      mockSupabase({ rpcError: 'Transaction not found' })
      const { DELETE } = await importRoute()

      const response = await DELETE(makeRequest({ transaction_id: transactionId }))

      expect(response.status).toBe(403)
    })

    it('deletes a valid transaction through the atomic RPC', async () => {
      const calls = mockSupabase({ rpcData: null })
      const { DELETE } = await importRoute()

      const response = await DELETE(makeRequest({ transaction_id: transactionId }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      expect(calls[0]).toMatchObject({
        name: 'delete_transaction_atomic',
        params: {
          p_transaction_id: transactionId,
        },
      })
    })
  })
})

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    account_id: accountId,
    category_id: categoryId,
    amount: 120.5,
    type: 'income',
    description: 'Pagamento test',
    date: '2026-03-10',
    notes: 'Nota test',
    ...overrides,
  }
}

function validPatchBody(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: transactionId,
    account_id: accountId,
    category_id: categoryId,
    amount: 99.9,
    type: 'expense',
    description: 'Transazione aggiornata',
    date: '2026-03-11',
    notes: null,
    destination_account_id: null,
    ...overrides,
  }
}
