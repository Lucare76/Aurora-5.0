import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'

import { sprint5UserAId, sprint5UserBId } from './fixtures/supabase-accounting-fixture'

type TestClient = SupabaseClient

const env = {
  url: process.env.SUPABASE_TEST_URL,
  anonKey: process.env.SUPABASE_TEST_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
  userAJwt: process.env.SUPABASE_TEST_USER_A_JWT,
  userBJwt: process.env.SUPABASE_TEST_USER_B_JWT,
}

const hasIntegrationEnv = Boolean(
  env.url &&
  env.anonKey &&
  env.serviceRoleKey &&
  env.userAJwt &&
  env.userBJwt,
)

const describeIntegration = hasIntegrationEnv ? describe : describe.skip
const counterpart = 'LOAN_HARDENING_IT'

describeIntegration('Loan accounting hardening integration', () => {
  let admin: TestClient
  let userA: TestClient
  let userB: TestClient

  beforeEach(async () => {
    admin = createClient(env.url!, env.serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    userA = authenticatedClient(env.userAJwt!)
    userB = authenticatedClient(env.userBJwt!)

    await admin.from('loans').delete().eq('counterpart', counterpart)
  })

  it('records a payment atomically and updates the remaining principal', async () => {
    const loan = await createLoan(userA, 100)

    const { data, error } = await userA.rpc('record_loan_payment_atomic', {
      p_loan_id: loan.id,
      p_amount: 40,
      p_paid_at: '2026-09-17T10:00:00Z',
      p_notes: 'prima rata',
    })

    expect(error).toBeNull()
    expect(Number((data as { loan: { remaining: number } }).loan.remaining)).toBe(60)

    const refreshed = await getLoan(admin, loan.id)
    expect(Number(refreshed.remaining)).toBe(60)
    expect(refreshed.is_settled).toBe(false)

    const { count, error: countError } = await admin
      .from('loan_payments')
      .select('id', { count: 'exact', head: true })
      .eq('loan_id', loan.id)

    expect(countError).toBeNull()
    expect(count).toBe(1)
  })

  it('rejects an overpayment without changing loan state', async () => {
    const loan = await createLoan(userA, 100)

    const first = await userA.rpc('record_loan_payment_atomic', {
      p_loan_id: loan.id,
      p_amount: 70,
      p_paid_at: '2026-09-17T10:00:00Z',
      p_notes: null,
    })
    expect(first.error).toBeNull()

    const overpay = await userA.rpc('record_loan_payment_atomic', {
      p_loan_id: loan.id,
      p_amount: 31,
      p_paid_at: '2026-09-17T11:00:00Z',
      p_notes: null,
    })

    expect(overpay.error?.message).toContain('exceeds outstanding principal')
    const refreshed = await getLoan(admin, loan.id)
    expect(Number(refreshed.remaining)).toBe(30)
  })

  it('keeps the legacy direct insert path coherent through database triggers', async () => {
    const loan = await createLoan(userA, 120)

    const { data: payment, error } = await userA
      .from('loan_payments')
      .insert({
        loan_id: loan.id,
        user_id: sprint5UserAId,
        amount: 25,
        paid_at: '2026-09-17T10:00:00Z',
        notes: 'legacy client path',
      })
      .select('id')
      .single()

    expect(error).toBeNull()
    expect(Number((await getLoan(admin, loan.id)).remaining)).toBe(95)

    const { error: updateError } = await userA
      .from('loan_payments')
      .update({ amount: 30 })
      .eq('id', payment!.id)
    expect(updateError).toBeNull()
    expect(Number((await getLoan(admin, loan.id)).remaining)).toBe(90)

    const { error: deleteError } = await userA
      .from('loan_payments')
      .delete()
      .eq('id', payment!.id)
    expect(deleteError).toBeNull()
    expect(Number((await getLoan(admin, loan.id)).remaining)).toBe(120)
  })

  it('rejects reducing the original principal below payments already registered', async () => {
    const loan = await createLoan(userA, 100)

    const payment = await userA.rpc('record_loan_payment_atomic', {
      p_loan_id: loan.id,
      p_amount: 60,
      p_paid_at: '2026-09-17T10:00:00Z',
      p_notes: null,
    })
    expect(payment.error).toBeNull()

    const { error } = await userA
      .from('loans')
      .update({ amount: 50, remaining: 0 })
      .eq('id', loan.id)

    expect(error?.message).toContain('cannot be lower than payments already registered')
    const refreshed = await getLoan(admin, loan.id)
    expect(Number(refreshed.amount)).toBe(100)
    expect(Number(refreshed.remaining)).toBe(40)
  })

  it('recomputes remaining principal when the original amount changes', async () => {
    const loan = await createLoan(userA, 100)
    const payment = await userA.rpc('record_loan_payment_atomic', {
      p_loan_id: loan.id,
      p_amount: 25,
      p_paid_at: '2026-09-17T10:00:00Z',
      p_notes: null,
    })
    expect(payment.error).toBeNull()

    const { error } = await userA
      .from('loans')
      .update({ amount: 150, remaining: 150 })
      .eq('id', loan.id)
    expect(error).toBeNull()

    const refreshed = await getLoan(admin, loan.id)
    expect(Number(refreshed.amount)).toBe(150)
    expect(Number(refreshed.remaining)).toBe(125)
  })

  it('rejects cross-user payment attempts', async () => {
    const loan = await createLoan(userA, 100)

    const { error } = await userB.rpc('record_loan_payment_atomic', {
      p_loan_id: loan.id,
      p_amount: 10,
      p_paid_at: '2026-09-17T10:00:00Z',
      p_notes: null,
    })

    expect(error?.message).toContain('not owned')
    expect(Number((await getLoan(admin, loan.id)).remaining)).toBe(100)
  })
})

function authenticatedClient(jwt: string): TestClient {
  return createClient(env.url!, env.anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  })
}

async function createLoan(client: TestClient, amount: number) {
  const { data, error } = await client
    .from('loans')
    .insert({
      user_id: sprint5UserAId,
      counterpart,
      type: 'given',
      amount,
      remaining: amount,
      description: 'integration test',
      due_date: null,
      is_settled: false,
      settled_at: null,
    })
    .select('*')
    .single()

  expect(error).toBeNull()
  return data!
}

async function getLoan(client: TestClient, loanId: string) {
  const { data, error } = await client
    .from('loans')
    .select('id,user_id,amount,remaining,is_settled,settled_at')
    .eq('id', loanId)
    .single()

  expect(error).toBeNull()
  return data!
}

void sprint5UserBId
