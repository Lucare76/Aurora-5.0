import { expect, test } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-aurora-e2e-auth': '1',
  },
})

test('patrimonio usa il delta dei conti collegati e mostra lo storico 7/30 giorni', async ({ page }) => {
  await page.route('**/api/dashboard/personal-overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        financial: { netWorth: 183570.62 },
      }),
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

  await page.goto('/patrimonio')

  await expect(page.getByRole('heading', { name: 'Patrimonio' })).toBeVisible()
  await expect(page.getByText(/183\.583,51/)).toBeVisible()
  await expect(page.getByText(/\+5,20.*7 giorni/)).toBeVisible()
  await expect(page.getByText(/\+48,70.*30 giorni/)).toBeVisible()

  await expect(page.getByText('Collegato al conto Aurora: Aurora Piano di Accumulo')).toBeVisible()
  await expect(page.getByText('Collegato al conto Aurora: Scalable')).toBeVisible()

  await expect(page.getByText(/\+3,80.*vs 7 giorni fa/)).toBeVisible()
  await expect(page.getByText(/\+27,30.*vs 30 giorni fa/)).toBeVisible()

  await expect(page.getByText(/Adeguamento ai valori attuali/i)).toBeVisible()
  await expect(page.getByText(/\+12,89/)).toBeVisible()

  await expect(page.getByText(/193\.200/)).toHaveCount(0)
})
