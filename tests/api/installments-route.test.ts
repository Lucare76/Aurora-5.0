import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { buildTransactionPayload } from '@/lib/transactions/form-contract'
import { PATCH } from '@/app/api/installments/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/access/private-finance-access', () => ({
  canAccessPrivateFinance: () => true,
}))

const transactionId = '11111111-1111-4111-8111-111111111111'
const accountId = '22222222-2222-4222-8222-222222222222'
const planId = '33333333-3333-4333-8333-333333333333'
const rpc = vi.fn()

function request(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/installments', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...buildTransactionPayload({
        type: 'expense',
        account_id: accountId,
        amount: '33.04',
        description: 'FARMASAVE',
        date: '2026-10-13',
      }),
      transaction_id: transactionId,
      installment_mode: 'new',
      title: 'FARMASAVE',
      total_installments: 3,
      installment_number: 1,
      ...overrides,
    }),
  })
}

describe('installment transaction editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: transactionId, error: null })
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { account_id: accountId }, error: null }),
    }
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: transactionId } } }) },
      from: vi.fn().mockReturnValue(query),
      rpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  it('links an existing expense to a new three-installment plan with its ISO date', async () => {
    const response = await PATCH(request())
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('update_installment_transaction', expect.objectContaining({
      p_transaction_id: transactionId,
      p_account_id: accountId,
      p_amount: 33.04,
      p_date: '2026-10-13',
      p_title: 'FARMASAVE',
      p_total_installments: 3,
      p_installment_number: 1,
      p_unlink: false,
    }))
  })

  it('updates a payment linked to an existing plan', async () => {
    const response = await PATCH(request({ installment_mode: 'existing', plan_id: planId, installment_number: 2 }))
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('update_installment_transaction', expect.objectContaining({
      p_plan_id: planId,
      p_date: '2026-10-13',
      p_installment_number: 2,
      p_title: null,
    }))
  })

  it('unlinks an installment without rejecting the transaction date', async () => {
    const response = await PATCH(request({ installment_mode: 'none' }))
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('update_installment_transaction', expect.objectContaining({
      p_date: '2026-10-13',
      p_unlink: true,
      p_installment_number: null,
    }))
  })

  it.each(['13/10/2026', '2026-1-13', 'invalid'])('rejects malformed date %s before writing', async (date) => {
    const response = await PATCH(request({ date }))
    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
})
