import { expect, test } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-aurora-e2e-auth': '1',
  },
})

async function mockPatrimonio(page) {
  await page.route('**/api/dashboard/personal-overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ financial: { netWorth: 183570.62 } }),
    })
  })

  await page.route('**/api/patrimonio', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'ishares',
            name: 'iShares Core MSCI World (Acc)',
            provider: 'Scalable Capital',
            asset_type: 'investment',
            instrument: 'iShares Core MSCI World (Acc)',
            invested_amount: 5571.6,
            current_value: 5577.5,
            currency: 'EUR',
            source_type: 'SCALABLE',
            include_in_net_worth: true,
            notes: null,
            observed_at: '2026-09-18T12:00:00.000Z',
            linked_account_id: 'aurora-pac',
            linked_account_name: 'Aurora Piano di Accumulo',
            linked_account_balance: 5571.6,
            net_worth_contribution: 5.9,
            change_7d: 3.8,
            change_30d: 21.4,
          },
          {
            id: 'vanguard',
            name: 'Vanguard FTSE All-World (Acc)',
            provider: 'Scalable Capital',
            asset_type: 'investment',
            instrument: 'Vanguard FTSE All-World (Acc)',
            invested_amount: 4046.08,
            current_value: 4052.35,
            currency: 'EUR',
            source_type: 'SCALABLE',
            include_in_net_worth: true,
            notes: null,
            observed_at: '2026-09-18T12:00:00.000Z',
            linked_account_id: 'scalable',
            linked_account_name: 'Scalable',
            linked_account_balance: 4045.36,
            net_worth_contribution: 6.99,
            change_7d: 1.4,
            change_30d: 27.3,
          },
        ],
        summary: {
          externalValue: 9629.85,
          investedAmount: 9617.68,
          gainLoss: 12.17,
          netWorthAdjustment: 12.89,
          includedAssets: 2,
          historyBaseline7d: 183578.31,
          historyBaseline30d: 183534.81,
        },
      }),
    })
  })

  await page.route('**/api/integrations/scalable', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: true,
        configured: true,
        connection: {
          connected_at: '2026-09-18T08:00:00.000Z',
          last_synced_at: '2026-09-18T12:00:00.000Z',
          last_error: null,
          scope: 'read-only',
          expires_at: null,
          metadata: {
            portfolio_ids: ['p1'],
            available_tools: [],
            holdings_count: 2,
            savings_plans_count: 2,
          },
        },
      }),
    })
  })

  await page.route('**/api/integrations/poste/manual', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'poste-1', name: 'Buono Ordinario', type: 'savings', balance: 15713.35, currency: 'EUR' },
        ],
      }),
    })
  })
}

async function expectNoHorizontalPageOverflow(page) {
  await expect.poll(async () => page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))).toEqual(await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.clientWidth,
  })))
}

for (const width of [320, 360, 390, 430]) {
  test(`patrimonio resta usabile a ${width}px senza overflow pagina`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockPatrimonio(page)
    await page.goto('/patrimonio')

    await expect(page.getByRole('heading', { name: 'Patrimonio' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aggiungi investimento' })).toBeVisible()
    await expectNoHorizontalPageOverflow(page)

    const firstAsset = page.getByText('iShares Core MSCI World (Acc)', { exact: true }).first()
    await expect(firstAsset).toBeVisible()
    await expect(page.getByText('Collegato al conto Aurora: Aurora Piano di Accumulo')).toBeVisible()

    if (width === 320) {
      await expect(page.getByRole('button', { name: 'Apri menu' })).toBeVisible()
      await page.getByRole('button', { name: 'Aggiungi investimento' }).click()
      await expect(page.getByText('Aggiungi investimento', { exact: true }).last()).toBeVisible()
      await expectNoHorizontalPageOverflow(page)
      await page.keyboard.press('Escape')
    }
  })
}

test('reflow equivalente a desktop 1280px con zoom 200%', async ({ page }) => {
  // A 200% browser zoom, una finestra desktop larga 1280px offre circa 640 CSS px.
  await page.setViewportSize({ width: 640, height: 900 })
  await mockPatrimonio(page)
  await page.goto('/patrimonio')

  await expect(page.getByRole('heading', { name: 'Patrimonio' })).toBeVisible()
  await expectNoHorizontalPageOverflow(page)

  await page.getByRole('button', { name: 'Apri menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible()
  await expectNoHorizontalPageOverflow(page)
})

test('navigazione inferiore non forza overflow a 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await mockPatrimonio(page)
  await page.goto('/patrimonio')

  await expectNoHorizontalPageOverflow(page)
  await expect(page.getByRole('button', { name: 'Apri altro' })).toBeVisible()
  await page.getByRole('button', { name: 'Apri altro' }).click()
  await expect(page.getByText('Tutte le sezioni')).toBeVisible()
  await expectNoHorizontalPageOverflow(page)
})
