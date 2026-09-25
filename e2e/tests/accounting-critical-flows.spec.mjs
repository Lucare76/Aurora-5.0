import { expect, test } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-aurora-e2e-auth': '1',
  },
})

const TEST_USER_ID = '11111111-1111-4111-8111-111111111111'
const ACCOUNT_MAIN = '22222222-2222-4222-8222-222222222222'
const ACCOUNT_SAVINGS = '33333333-3333-4333-8333-333333333333'
const CATEGORY_GROCERIES = '44444444-4444-4444-8444-444444444444'

function account(id, name, balance, type = 'checking') {
  return {
    id,
    user_id: TEST_USER_ID,
    name,
    type,
    balance,
    currency: 'EUR',
    color: null,
    icon: null,
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-09-25T06:00:00.000Z',
    updated_at: '2026-09-25T06:00:00.000Z',
  }
}

function category() {
  return {
    id: CATEGORY_GROCERIES,
    user_id: TEST_USER_ID,
    name: 'Spesa',
    type: 'expense',
    color: null,
    icon: null,
    parent_id: null,
    is_default: false,
    sort_order: 0,
    created_at: '2026-09-25T06:00:00.000Z',
  }
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

async function seedSupabaseSession(page) {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = [
    base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64Url(JSON.stringify({ sub: TEST_USER_ID, aud: 'authenticated', role: 'authenticated', exp: now + 3600 })),
    'e2e-signature',
  ].join('.')

  const user = {
    id: TEST_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@aurora.local',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-09-25T06:00:00.000Z',
  }

  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'e2e-refresh-token',
    user,
  }

  await page.context().addCookies([{
    name: 'sb-127-auth-token',
    value: `base64-${base64Url(JSON.stringify(session))}`,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }])
}

async function installSupabaseMocks(page, state) {
  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: TEST_USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'e2e@aurora.local',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-09-25T06:00:00.000Z',
      }),
    })
  })

  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path.endsWith('/rest/v1/accounts')) {
      state.accountsReads += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-1/2' },
        body: JSON.stringify(state.accounts),
      })
      return
    }

    if (path.endsWith('/rest/v1/account_purpose_links')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return
    }

    if (path.endsWith('/rest/v1/categories')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([category()]),
      })
      return
    }

    if (path.endsWith('/rest/v1/transactions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.transactions),
      })
      return
    }

    if (path.endsWith('/rest/v1/account_reconciliations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.reconciliations ?? []),
      })
      return
    }

    if (path.endsWith('/rest/v1/rpc/create_reconciliation_atomic')) {
      const body = route.request().postDataJSON()
      state.reconciliationRpcBody = body
      const reconciliation = {
        id: '55555555-5555-4555-8555-555555555555',
        user_id: TEST_USER_ID,
        account_id: ACCOUNT_MAIN,
        statement_date: body.p_statement_date,
        bank_balance: Number(body.p_bank_balance),
        app_balance_snapshot: 1000,
        difference: Number(body.p_bank_balance) - 1000,
        status: Number(body.p_bank_balance) === 1000 ? 'reconciled' : 'mismatch',
        source_type: 'manual',
        source_reference: null,
        created_at: '2026-09-25T07:00:00.000Z',
      }
      state.reconciliations = [reconciliation]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reconciliation,
          patrimonio_sync: 'updated',
          observed_at: '2026-09-25T12:00:00.000Z',
        }),
      })
      return
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

function newTransactionRow({ id, accountId, type, amount, description, date, destinationAccountId = null }) {
  return {
    id,
    user_id: TEST_USER_ID,
    account_id: accountId,
    category_id: type === 'transfer' ? null : CATEGORY_GROCERIES,
    type,
    amount,
    description,
    notes: null,
    date,
    transfer_peer_id: destinationAccountId,
    recurring_id: null,
    receipt_url: null,
    receipt_data: null,
    is_neutral: false,
    created_at: '2026-09-25T07:00:00.000Z',
    updated_at: '2026-09-25T07:00:00.000Z',
  }
}

test('movimento -> saldo: una spesa passa dalla UI, aggiorna il saldo e viene riletta', async ({ page }) => {
  const state = {
    accounts: [
      account(ACCOUNT_MAIN, 'Bancoposta', 1000),
      account(ACCOUNT_SAVINGS, 'Risparmio', 250, 'savings'),
    ],
    transactions: [],
    accountsReads: 0,
  }
  await seedSupabaseSession(page)
  await installSupabaseMocks(page, state)

  let postedBody = null
  await page.route('**/api/automation/evaluate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { suggestedChanges: {}, appliedRules: [] } }) })
  })
  await page.route('**/api/transactions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Method not allowed' }) })
      return
    }
    postedBody = route.request().postDataJSON()
    state.accounts[0] = { ...state.accounts[0], balance: 975.5 }
    state.transactions = [
      newTransactionRow({
        id: '66666666-6666-4666-8666-666666666666',
        accountId: ACCOUNT_MAIN,
        type: 'expense',
        amount: 24.5,
        description: 'SPESA TEST E2E',
        date: '2026-09-25',
      }),
    ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: state.transactions[0] }) })
  })

  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Nuovo movimento' }).click()
  await expect(page.getByText('Nuovo movimento', { exact: true }).last()).toBeVisible()
  await page.getByPlaceholder('0,00').last().fill('24,50')
  await page.getByPlaceholder('ES. SPESA SUPERMERCATO').last().fill('SPESA TEST E2E')
  const createForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Salva movimento' }) })
  await createForm.locator('input[type="date"]').fill('2026-09-25')
  await createForm.locator('select').nth(0).selectOption(ACCOUNT_MAIN)
  await createForm.locator('select').nth(1).selectOption(CATEGORY_GROCERIES)
  await page.getByRole('button', { name: 'Salva movimento' }).click()

  await expect(page.getByText('Transazione creata')).toBeVisible()
  await expect(page.getByText('SPESA TEST E2E')).toBeVisible()
  expect(postedBody).toMatchObject({
    account_id: ACCOUNT_MAIN,
    type: 'expense',
    amount: 24.5,
    description: 'SPESA TEST E2E',
    date: '2026-09-25',
  })
  expect(state.accounts[0].balance).toBe(975.5)
  expect(state.accountsReads).toBeGreaterThanOrEqual(2)
})

test('giroconto: la UI invia sorgente/destinazione e ricarica entrambi i saldi senza cambiare il totale', async ({ page }) => {
  const state = {
    accounts: [
      account(ACCOUNT_MAIN, 'Bancoposta', 1000),
      account(ACCOUNT_SAVINGS, 'Risparmio', 250, 'savings'),
    ],
    transactions: [],
    accountsReads: 0,
  }
  await seedSupabaseSession(page)
  await installSupabaseMocks(page, state)

  let postedBody = null
  await page.route('**/api/automation/evaluate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { suggestedChanges: {}, appliedRules: [] } }) })
  })
  await page.route('**/api/transactions', async (route) => {
    postedBody = route.request().postDataJSON()
    state.accounts = [
      { ...state.accounts[0], balance: 900 },
      { ...state.accounts[1], balance: 350 },
    ]
    state.transactions = [
      newTransactionRow({
        id: '77777777-7777-4777-8777-777777777777',
        accountId: ACCOUNT_MAIN,
        type: 'transfer',
        amount: 100,
        description: 'GIROCONTO TEST E2E',
        date: '2026-09-25',
        destinationAccountId: ACCOUNT_SAVINGS,
      }),
    ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: state.transactions[0] }) })
  })

  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Nuovo movimento' }).click()
  await expect(page.getByText('Nuovo movimento', { exact: true }).last()).toBeVisible()
  await page.getByRole('button', { name: 'Trasferimento' }).last().click()
  await page.getByPlaceholder('0,00').last().fill('100')
  await page.getByPlaceholder('ES. SPESA SUPERMERCATO').last().fill('GIROCONTO TEST E2E')
  const createForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Salva movimento' }) })
  await createForm.locator('input[type="date"]').fill('2026-09-25')
  await createForm.locator('select').nth(0).selectOption(ACCOUNT_MAIN)
  await createForm.locator('select').nth(1).selectOption(ACCOUNT_SAVINGS)
  await page.getByRole('button', { name: 'Salva movimento' }).click()

  await expect(page.getByText('Transazione creata')).toBeVisible()
  await expect(page.getByText('GIROCONTO TEST E2E')).toBeVisible()
  expect(postedBody).toMatchObject({
    account_id: ACCOUNT_MAIN,
    destination_account_id: ACCOUNT_SAVINGS,
    type: 'transfer',
    amount: 100,
  })
  expect(state.accounts[0].balance + state.accounts[1].balance).toBe(1250)
  expect(state.accountsReads).toBeGreaterThanOrEqual(2)
})

test('riconciliazione -> Patrimonio: RPC atomica e snapshot consolidato vengono eseguiti in sequenza', async ({ page }) => {
  const state = {
    accounts: [
      account(ACCOUNT_MAIN, 'Portafoglio test', 1000, 'investment'),
      account(ACCOUNT_SAVINGS, 'Risparmio', 250, 'savings'),
    ],
    transactions: [],
    reconciliations: [],
    accountsReads: 0,
    reconciliationRpcBody: null,
  }
  await seedSupabaseSession(page)
  await installSupabaseMocks(page, state)

  let snapshotBody = null
  await page.route('**/api/patrimonio/snapshot', async (route) => {
    snapshotBody = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.goto('/reconciliation?account=' + ACCOUNT_MAIN)
  await expect(page.getByRole('heading', { name: 'Riconciliazione conto' })).toBeVisible()
  const accountSelect = page.locator('select').first()
  await expect(accountSelect.locator(`option[value="${ACCOUNT_MAIN}"]`)).toHaveCount(1)
  await accountSelect.selectOption(ACCOUNT_MAIN)
  await expect(page.getByText(/Se questo conto è collegato 1:1/)).toBeVisible()

  await page.locator('input[inputmode="decimal"]').fill('1120')
  await page.getByRole('button', { name: 'Salva riconciliazione' }).click()

  await expect(page.getByText('Riconciliazione salvata: differenza rilevata')).toBeVisible()
  expect(state.reconciliationRpcBody).toMatchObject({
    p_account_id: ACCOUNT_MAIN,
    p_bank_balance: 1120,
    p_source_type: 'manual',
  })
  expect(snapshotBody).toEqual({ observedAt: '2026-09-25T12:00:00.000Z' })
  await expect(page.getByText(/Banca 1\.120,00/)).toBeVisible()
  await expect(page.getByText(/Aurora 1\.000,00/)).toBeVisible()
})
