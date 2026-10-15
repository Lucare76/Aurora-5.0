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
  const dateField = createForm.getByPlaceholder('gg/mm/aaaa')
  await dateField.fill('31/02/2026')
  expect(await dateField.evaluate((input) => input.checkValidity())).toBe(false)
  await page.getByRole('button', { name: 'Salva movimento' }).click()
  expect(postedBody).toBeNull()
  await dateField.fill('25/09/2026')
  await expect(dateField).toHaveValue('25/09/2026')
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
  await expect(page.getByRole('heading', { name: 'Storico riconciliazioni' })).toBeVisible()
  await expect(page.getByText('Nessuna riconciliazione')).toHaveCount(0)
  expect(state.reconciliations).toHaveLength(1)
  expect(state.reconciliations[0]).toMatchObject({
    bank_balance: 1120,
    app_balance_snapshot: 1000,
    difference: 120,
  })
})


test('rate: pianificazione e collegamento di una spesa esistente senza duplicare addebiti', async ({ page }) => {
  const plan = { id: '88888888-8888-4888-8888-888888888888', title: 'Computer a rate', total_installments: 4, created_at: '2026-09-25T06:00:00Z', schedule: null }
  const first = newTransactionRow({ id: '99999999-9999-4999-8999-999999999999', accountId: ACCOUNT_MAIN, type: 'expense', amount: 50, description: 'Computer prima rata', date: '2026-09-25' })
  const second = newTransactionRow({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', accountId: ACCOUNT_MAIN, type: 'expense', amount: 50, description: 'Computer addebito esistente', date: '2026-09-25' })
  const state = { accounts: [account(ACCOUNT_MAIN, 'Bancoposta', 900)], transactions: [first, second], accountsReads: 0 }
  const payments = [{ transaction_id: first.id, plan_id: plan.id, installment_number: 1, transaction: first }]
  await seedSupabaseSession(page)
  await installSupabaseMocks(page, state)
  let transactionWrites = 0
  await page.route('**/api/transactions', async (route) => { transactionWrites++; await route.fulfill({ status: 500, body: '{}' }) })
  await page.route('**/api/installments', async (route) => {
    if (route.request().method() === 'PUT') plan.schedule = route.request().postDataJSON().schedule
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plans: [plan], payments }) })
  })
  await page.route('**/api/installments/link', async (route) => {
    const body = route.request().postDataJSON()
    expect(body).toEqual({ plan_id: plan.id, transaction_id: second.id, installment_number: 2 })
    payments.push({ ...body, transaction: second })
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
  })
  await page.goto('/transactions')
  const panel = page.locator('#piani-rateali')
  await expect(panel.getByText('3 rate ancora aperte su 4', { exact: false })).toBeVisible()
  await panel.getByRole('button', { name: 'Pianifica rate', exact: true }).click()
  await page.getByLabel('Importo di ogni rata (€)').fill('50')
  await page.getByLabel('Prima rata da pianificare').fill('2')
  await page.getByLabel('Scadenza di questa rata').fill('25/10/2026')
  await page.getByRole('button', { name: 'Salva pianificazione', exact: true }).click()
  await expect(panel.getByText('Prossima rata 2:', { exact: false })).toContainText('25/10/2026')
  expect(plan.schedule).toMatchObject({ amount: 50, first_due_date: '2026-10-25', first_installment_number: 2 })
  await panel.getByRole('button', { name: 'Collega addebito', exact: true }).click()
  await page.getByLabel('Spesa nel mese visualizzato').selectOption(second.id)
  await page.getByRole('button', { name: 'Collega senza nuovo addebito' }).click()
  await expect(panel.getByText('2 rate ancora aperte su 4', { exact: false })).toBeVisible()
  await expect(panel.getByText('Prossima rata 3:', { exact: false })).toContainText('25/11/2026')
  expect(state.accounts[0].balance).toBe(900)
  expect(state.transactions).toHaveLength(2)
  expect(transactionWrites).toBe(0)
})


test('piano stagionale: revisione, anteprima e salvataggio senza scritture sui movimenti', async ({ page }) => {
  await seedSupabaseSession(page)
  await installSupabaseMocks(page, { accounts: [account(ACCOUNT_MAIN, 'Bancoposta', 3000)], transactions: [], accountsReads: 0 })
  const months = Array.from({ length: 12 }, (_, i) => ({ month: new Date(Date.UTC(2026, 9 + i, 1)).toISOString().slice(0, 7), kind: 'NONE', amount: 0, day: 27, confidence: 'ESTIMATED', received: false, extra: { amount: 0, day: 27, confidence: 'ESTIMATED', received: false, label: 'Altre entrate' } }))
  const initial = { account_ids: [ACCOUNT_MAIN], reserve: 0, monthly_extra_expenses: 0, reviewed: false, commitments: [], months }
  let savedPlan = null
  let previews = 0
  let transactionWrites = 0
  await page.route('**/api/transactions', async (route) => { transactionWrites++; await route.fulfill({ status: 500, body: '{}' }) })
  await page.route('**/api/seasonal-plan*', async (route) => {
    const method = route.request().method()
    const plan = method === 'GET' ? initial : route.request().postDataJSON()
    const preview = route.request().url().includes('preview=true')
    if (method === 'PUT' && !preview) savedPlan = plan
    if (preview) previews++
    const rows = months.map((m) => ({ month: m.month, confirmedIncome: 0, estimatedIncome: 0, confirmedExpenses: 0, estimatedExpenses: 0, closing: 2000, closingConservative: 1000, belowReserve: false }))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan, saved: Boolean(savedPlan), accounts: [{ id: ACCOUNT_MAIN, name: 'Bancoposta', type: 'checking', balance: 3000 }], automaticCommitments: [], forecast: { from: '2026-10-15', to: '2027-09-30', complete: plan.reviewed, coverage: true, openingBalance: 3000, reserve: plan.reserve, spendableConfirmed: plan.reviewed ? 1000 : null, spendableEstimated: plan.reviewed ? 2000 : null, shortfall: 0, minimumConfirmed: 1000, minimumEstimated: 2000, minimumDate: '2027-02-01', rows, events: [] } }) })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/seasonal-plan')
  await expect(page.getByRole('heading', { name: 'Piano stagionale', exact: true })).toBeVisible()
  const prudent = page.getByRole('heading', { name: 'Spendibile oggi · solo entrate confermate' }).locator('..')
  await expect(prudent).toContainText('Da verificare')
  await page.locator('#kind-0').selectOption('SALARY')
  await page.locator('#amount-0').fill('1750')
  await page.locator('#confidence-0').selectOption('CONFIRMED')
  await page.getByLabel('Riserva minima da non usare (€)').fill('500')
  await page.getByLabel(/Ho verificato tutti i mesi/).check()
  await page.getByRole('button', { name: 'Calcola anteprima', exact: true }).click()
  await expect(prudent).toContainText(/1\.?000,00/)
  expect(previews).toBe(1); expect(savedPlan).toBeNull()
  await page.getByRole('button', { name: 'Salva piano', exact: true }).click()
  await expect(page.getByText('Piano salvato', { exact: true })).toBeVisible()
  expect(savedPlan.months[0]).toMatchObject({ kind: 'SALARY', amount: 1750, confidence: 'CONFIRMED' })
  expect(savedPlan.reserve).toBe(500); expect(transactionWrites).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
