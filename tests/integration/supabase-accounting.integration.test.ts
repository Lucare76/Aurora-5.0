import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  calculateExpenseTotal,
  calculateIncomeTotal,
  calculateNetTotal,
  calculateNetWorth,
} from '@/domain/accounting/aggregations'
import { buildTransactionExportRows, buildTransactionsCsv } from '@/domain/accounting/export'
import { adaptTransactionRows } from '@/domain/accounting/transaction-adapter'
import type { Account, Category, Database, Transaction } from '@/types/database'

import {
  sprint5AccountIds,
  sprint5CategoryIds,
  sprint5Expected,
  sprint5OpeningBalances,
  sprint5UserAId,
  sprint5UserBId,
} from './fixtures/supabase-accounting-fixture'

type TestClient = SupabaseClient<Database>

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
const testPrefix = 'SPRINT5_IT_'

describeIntegration('Sprint 5 Supabase accounting integration', () => {
  let admin: TestClient
  let userA: TestClient
  let userB: TestClient

  beforeEach(async () => {
    admin = createClient<Database>(env.url!, env.serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    userA = authenticatedClient(env.userAJwt!)
    userB = authenticatedClient(env.userBJwt!)

    await resetMutableFixtureState(admin)
  })

  it('reads the deterministic fixture for user A only', async () => {
    const { data, error } = await userA
      .from('transactions')
      .select('id,user_id')
      .eq('user_id', sprint5UserAId)

    expect(error).toBeNull()
    expect(data).toHaveLength(sprint5Expected.userATransactionCount)
    expect(data?.every((row) => row.user_id === sprint5UserAId)).toBe(true)
  })

  it('keeps user B fixture isolated by RLS', async () => {
    const { data, error } = await userA
      .from('transactions')
      .select('id,user_id')
      .eq('user_id', sprint5UserBId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('creates income atomically and increases only the selected account', async () => {
    const before = await getAccountBalance(admin, sprint5AccountIds.bank)

    const created = await createTransaction(userA, {
      p_type: 'income',
      p_amount: 125.25,
      p_description: `${testPrefix}income_create`,
      p_category_id: sprint5CategoryIds.salary,
    })

    expect(created.type).toBe('income')
    await expectAccountBalance(admin, sprint5AccountIds.bank, before + 125.25)
  })

  it('creates expense atomically and decreases only the selected account', async () => {
    const before = await getAccountBalance(admin, sprint5AccountIds.bank)

    const created = await createTransaction(userA, {
      p_type: 'expense',
      p_amount: 42.1,
      p_description: `${testPrefix}expense_create`,
      p_category_id: sprint5CategoryIds.grocery,
    })

    expect(created.type).toBe('expense')
    await expectAccountBalance(admin, sprint5AccountIds.bank, before - 42.1)
  })

  it('creates transfer atomically and keeps global net worth neutral', async () => {
    const beforeBank = await getAccountBalance(admin, sprint5AccountIds.bank)
    const beforeSavings = await getAccountBalance(admin, sprint5AccountIds.savings)
    const beforeWorth = await getNetWorth(admin)

    const created = await createTransaction(userA, {
      p_type: 'transfer',
      p_amount: 300,
      p_description: `${testPrefix}transfer_create`,
      p_destination_account_id: sprint5AccountIds.savings,
    })

    expect(created.type).toBe('transfer')
    expect(created.transfer_peer_id).toBe(sprint5AccountIds.savings)
    await expectAccountBalance(admin, sprint5AccountIds.bank, beforeBank - 300)
    await expectAccountBalance(admin, sprint5AccountIds.savings, beforeSavings + 300)
    expect(await getNetWorth(admin)).toBe(beforeWorth)
  })

  it('updates income by reversing old amount and applying new amount', async () => {
    const created = await createTransaction(userA, {
      p_type: 'income',
      p_amount: 100,
      p_description: `${testPrefix}income_update`,
      p_category_id: sprint5CategoryIds.salary,
    })
    const afterCreate = await getAccountBalance(admin, sprint5AccountIds.bank)

    const updated = await updateTransaction(userA, {
      p_transaction_id: created.id,
      p_account_id: sprint5AccountIds.bank,
      p_type: 'income',
      p_amount: 175,
      p_description: `${testPrefix}income_updated`,
      p_category_id: sprint5CategoryIds.salary,
    })

    expect(updated.amount).toBe(175)
    await expectAccountBalance(admin, sprint5AccountIds.bank, afterCreate + 75)
  })

  it('updates expense by reversing old amount and applying new amount', async () => {
    const created = await createTransaction(userA, {
      p_type: 'expense',
      p_amount: 90,
      p_description: `${testPrefix}expense_update`,
      p_category_id: sprint5CategoryIds.grocery,
    })
    const afterCreate = await getAccountBalance(admin, sprint5AccountIds.bank)

    const updated = await updateTransaction(userA, {
      p_transaction_id: created.id,
      p_account_id: sprint5AccountIds.bank,
      p_type: 'expense',
      p_amount: 40,
      p_description: `${testPrefix}expense_updated`,
      p_category_id: sprint5CategoryIds.grocery,
    })

    expect(updated.amount).toBe(40)
    await expectAccountBalance(admin, sprint5AccountIds.bank, afterCreate + 50)
  })

  it('updates transfer destination and amount without changing net worth', async () => {
    const created = await createTransaction(userA, {
      p_type: 'transfer',
      p_amount: 50,
      p_description: `${testPrefix}transfer_update`,
      p_destination_account_id: sprint5AccountIds.savings,
    })
    const worthAfterCreate = await getNetWorth(admin)
    const cardBeforeUpdate = await getAccountBalance(admin, sprint5AccountIds.card)

    const updated = await updateTransaction(userA, {
      p_transaction_id: created.id,
      p_account_id: sprint5AccountIds.bank,
      p_type: 'transfer',
      p_amount: 80,
      p_description: `${testPrefix}transfer_updated`,
      p_destination_account_id: sprint5AccountIds.card,
    })

    expect(updated.transfer_peer_id).toBe(sprint5AccountIds.card)
    await expectAccountBalance(admin, sprint5AccountIds.card, cardBeforeUpdate + 80)
    expect(await getNetWorth(admin)).toBe(worthAfterCreate)
  })

  it('deletes income and rolls back the balance effect', async () => {
    const created = await createTransaction(userA, {
      p_type: 'income',
      p_amount: 77,
      p_description: `${testPrefix}income_delete`,
      p_category_id: sprint5CategoryIds.salary,
    })
    const afterCreate = await getAccountBalance(admin, sprint5AccountIds.bank)

    await deleteTransaction(userA, created.id)

    await expectAccountBalance(admin, sprint5AccountIds.bank, afterCreate - 77)
    await expectTransactionDeleted(admin, created.id)
  })

  it('deletes expense and rolls back the balance effect', async () => {
    const created = await createTransaction(userA, {
      p_type: 'expense',
      p_amount: 33,
      p_description: `${testPrefix}expense_delete`,
      p_category_id: sprint5CategoryIds.grocery,
    })
    const afterCreate = await getAccountBalance(admin, sprint5AccountIds.bank)

    await deleteTransaction(userA, created.id)

    await expectAccountBalance(admin, sprint5AccountIds.bank, afterCreate + 33)
    await expectTransactionDeleted(admin, created.id)
  })

  it('deletes transfer and rolls back both account balances', async () => {
    const created = await createTransaction(userA, {
      p_type: 'transfer',
      p_amount: 150,
      p_description: `${testPrefix}transfer_delete`,
      p_destination_account_id: sprint5AccountIds.savings,
    })
    const bankAfterCreate = await getAccountBalance(admin, sprint5AccountIds.bank)
    const savingsAfterCreate = await getAccountBalance(admin, sprint5AccountIds.savings)

    await deleteTransaction(userA, created.id)

    await expectAccountBalance(admin, sprint5AccountIds.bank, bankAfterCreate + 150)
    await expectAccountBalance(admin, sprint5AccountIds.savings, savingsAfterCreate - 150)
    await expectTransactionDeleted(admin, created.id)
  })

  it('rejects cross-user ownership mutations through RPC', async () => {
    const { error } = await userB.rpc('create_transaction_atomic', {
      p_account_id: sprint5AccountIds.bank,
      p_type: 'expense',
      p_amount: 1,
      p_date: '2026-07-16',
      p_description: `${testPrefix}cross_user`,
      p_category_id: sprint5CategoryIds.grocery,
      p_notes: null,
      p_destination_account_id: null,
      p_recurring_id: null,
    })

    expect(error?.message).toContain('not owned')
  })

  it('matches dashboard and report totals from real Supabase rows', async () => {
    const { accounts, categories, transactions } = await loadUserAFixture(admin)
    const appTransactions = adaptTransactionRows(transactions, {
      accounts,
      peerTransactions: transactions,
    })
    const currentMonth = appTransactions.filter((transaction) => transaction.date >= '2026-07-01' && transaction.date <= '2026-07-31')

    expect(calculateNetWorth(accounts)).toBe(sprint5Expected.netWorthAfterFixture)
    expect(calculateIncomeTotal(currentMonth)).toBe(sprint5Expected.currentMonthIncome)
    expect(calculateExpenseTotal(currentMonth)).toBe(sprint5Expected.currentMonthExpense)
    expect(calculateNetTotal(currentMonth)).toBe(sprint5Expected.currentMonthNet)
    expect(categories.some((category) => category.parent_id === sprint5CategoryIds.food)).toBe(true)
  })

  it('exports real fixture transactions without merging same-date same-amount rows', async () => {
    const { accounts, categories, transactions } = await loadUserAFixture(admin)
    const appTransactions = adaptTransactionRows(transactions, {
      accounts,
      peerTransactions: transactions,
    })
    const rows = buildTransactionExportRows(appTransactions, categories, accounts)
    const csv = buildTransactionsCsv(rows)

    expect(rows.filter((row) => row.importo === '45.00')).toHaveLength(2)
    expect(csv).toContain('Carta importo duplicato A')
    expect(csv).toContain('Carta importo duplicato B')
  })
})

function authenticatedClient(jwt: string): TestClient {
  return createClient<Database>(env.url!, env.anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  })
}

async function resetMutableFixtureState(admin: TestClient): Promise<void> {
  await admin.from('transactions').delete().like('description', `${testPrefix}%`)
  await admin
    .from('accounts')
    .update({ balance: sprint5OpeningBalances.bank })
    .eq('id', sprint5AccountIds.bank)
  await admin
    .from('accounts')
    .update({ balance: sprint5OpeningBalances.savings })
    .eq('id', sprint5AccountIds.savings)
  await admin
    .from('accounts')
    .update({ balance: sprint5OpeningBalances.card })
    .eq('id', sprint5AccountIds.card)
}

async function createTransaction(client: TestClient, params: {
  p_type: 'income' | 'expense' | 'transfer'
  p_amount: number
  p_description: string
  p_category_id?: string | null
  p_destination_account_id?: string | null
}): Promise<Transaction> {
  const { data, error } = await client.rpc('create_transaction_atomic', {
    p_account_id: sprint5AccountIds.bank,
    p_type: params.p_type,
    p_amount: params.p_amount,
    p_date: '2026-07-16',
    p_description: params.p_description,
    p_category_id: params.p_category_id ?? null,
    p_notes: null,
    p_destination_account_id: params.p_destination_account_id ?? null,
    p_recurring_id: null,
  })

  expect(error).toBeNull()
  return data as unknown as Transaction
}

async function updateTransaction(client: TestClient, params: {
  p_transaction_id: string
  p_account_id: string
  p_type: 'income' | 'expense' | 'transfer'
  p_amount: number
  p_description: string
  p_category_id?: string | null
  p_destination_account_id?: string | null
}): Promise<Transaction> {
  const { data, error } = await client.rpc('update_transaction_atomic', {
    p_transaction_id: params.p_transaction_id,
    p_account_id: params.p_account_id,
    p_type: params.p_type,
    p_amount: params.p_amount,
    p_date: '2026-07-16',
    p_description: params.p_description,
    p_category_id: params.p_category_id ?? null,
    p_notes: null,
    p_destination_account_id: params.p_destination_account_id ?? null,
    p_clear_category: params.p_category_id === null,
  })

  expect(error).toBeNull()
  return data as unknown as Transaction
}

async function deleteTransaction(client: TestClient, transactionId: string): Promise<void> {
  const { error } = await client.rpc('delete_transaction_atomic', {
    p_transaction_id: transactionId,
  })

  expect(error).toBeNull()
}

async function getAccountBalance(client: TestClient, accountId: string): Promise<number> {
  const { data, error } = await client
    .from('accounts')
    .select('balance')
    .eq('id', accountId)
    .single()

  expect(error).toBeNull()
  return Number(data?.balance ?? 0)
}

async function expectAccountBalance(client: TestClient, accountId: string, expected: number): Promise<void> {
  expect(await getAccountBalance(client, accountId)).toBeCloseTo(expected, 2)
}

async function getNetWorth(client: TestClient): Promise<number> {
  const { data, error } = await client
    .from('accounts')
    .select('id,balance,is_active')
    .eq('user_id', sprint5UserAId)

  expect(error).toBeNull()
  return calculateNetWorth((data ?? []) as Pick<Account, 'id' | 'balance' | 'is_active'>[])
}

async function expectTransactionDeleted(client: TestClient, transactionId: string): Promise<void> {
  const { data, error } = await client
    .from('transactions')
    .select('id')
    .eq('id', transactionId)

  expect(error).toBeNull()
  expect(data).toEqual([])
}

async function loadUserAFixture(client: TestClient): Promise<{
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
}> {
  const [accounts, categories, transactions] = await Promise.all([
    client.from('accounts').select('*').eq('user_id', sprint5UserAId),
    client.from('categories').select('*').eq('user_id', sprint5UserAId),
    client.from('transactions').select('*').eq('user_id', sprint5UserAId).order('date', { ascending: true }),
  ])

  expect(accounts.error).toBeNull()
  expect(categories.error).toBeNull()
  expect(transactions.error).toBeNull()

  return {
    accounts: (accounts.data ?? []) as Account[],
    categories: (categories.data ?? []) as Category[],
    transactions: (transactions.data ?? []) as Transaction[],
  }
}
