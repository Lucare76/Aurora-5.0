import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { loadInstallments } from '@/lib/installments/load'
import { allowedInstallmentAccount } from '@/lib/installments/access'
import { PUT } from '@/app/api/installments/route'
import { POST as link } from '@/app/api/installments/link/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/installments/load', () => ({ loadInstallments: vi.fn() }))
vi.mock('@/lib/installments/access', () => ({ allowedInstallmentAccount: vi.fn() }))
const planId = '11111111-1111-4111-8111-111111111111'
const transactionId = '22222222-2222-4222-8222-222222222222'
const accountId = '33333333-3333-4333-8333-333333333333'
const schedule = { amount: 33.04, frequency: 'monthly', interval: 1, first_due_date: '2026-11-13', first_installment_number: 2, paused: false }
const rpc = vi.fn()
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() }
const client = { auth: { getUser: vi.fn() }, from: vi.fn(() => query), rpc }
function request(body: unknown) { return new Request('http://localhost/api/installments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }

beforeEach(() => {
  vi.clearAllMocks()
  client.auth.getUser.mockResolvedValue({ data: { user: { id: 'owner' } } })
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  vi.mocked(allowedInstallmentAccount).mockResolvedValue(true)
  vi.mocked(loadInstallments).mockResolvedValue({ plans: [{ id: planId, title: 'FARMASAVE', total_installments: 3, created_at: '' }], payments: [{ transaction_id: transactionId, plan_id: planId, installment_number: 1, transaction: { account_id: accountId, category_id: null, amount: 33.04, date: '2026-10-13', description: 'FARMASAVE', recurring_id: null } }] })
  query.maybeSingle.mockResolvedValue({ data: { account_id: accountId, type: 'expense', transfer_peer_id: null } })
  rpc.mockResolvedValue({ data: null, error: null })
})

describe('installment planning API', () => {
  it('saves, pauses, and removes forecasts using only the metadata RPC', async () => {
    for (const value of [schedule, { ...schedule, paused: true }, null]) {
      expect((await PUT(request({ plan_id: planId, schedule: value }))).status).toBe(200)
      expect(rpc).toHaveBeenLastCalledWith('update_installment_schedule', { p_plan_id: planId, p_schedule: value })
    }
    expect(rpc.mock.calls.every(([name]) => name === 'update_installment_schedule')).toBe(true)
  })
  it('rejects invalid dates, numbers outside the plan, and another user’s plan', async () => {
    expect((await PUT(request({ plan_id: planId, schedule: { ...schedule, first_due_date: '2026-02-31' } }))).status).toBe(400)
    expect((await PUT(request({ plan_id: planId, schedule: { ...schedule, first_installment_number: 4 } }))).status).toBe(400)
    vi.mocked(loadInstallments).mockResolvedValue({ plans: [], payments: [] })
    expect((await PUT(request({ plan_id: planId, schedule }))).status).toBe(404)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('blocks unauthenticated and inaccessible accounts without writing', async () => {
    vi.mocked(allowedInstallmentAccount).mockResolvedValue(false)
    expect((await PUT(request({ plan_id: planId, schedule }))).status).toBe(403)
    client.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect((await PUT(request({ plan_id: planId, schedule }))).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('links an existing expense without invoking any transaction or balance write', async () => {
    expect((await link(request({ plan_id: planId, transaction_id: transactionId, installment_number: 2 }))).status).toBe(200)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('link_installment_payment', { p_plan_id: planId, p_transaction_id: transactionId, p_installment_number: 2 })
  })
  it('rejects duplicate installments and nonexpense links', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505' } })
    expect((await link(request({ plan_id: planId, transaction_id: transactionId, installment_number: 2 }))).status).toBe(409)
    rpc.mockClear()
    query.maybeSingle.mockResolvedValue({ data: { account_id: accountId, type: 'transfer' } })
    expect((await link(request({ plan_id: planId, transaction_id: transactionId, installment_number: 2 }))).status).toBe(404)
    expect(rpc).not.toHaveBeenCalled()
  })
})
