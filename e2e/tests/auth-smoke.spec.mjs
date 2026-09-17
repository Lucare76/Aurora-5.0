import { expect, test } from '@playwright/test'

test('login renders and validates required fields', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Aurora' })).toBeVisible()
  await expect(page.getByText('Accedi al tuo spazio finanziario personale.')).toBeVisible()

  await page.getByRole('button', { name: 'Accedi' }).click()

  await expect(page.getByText('Inserisci un indirizzo email valido.')).toBeVisible()
  await expect(page.getByText('Inserisci la password.')).toBeVisible()
})

test('registration page is reachable from login and validates password mismatch', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Registrati' }).click()

  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByText('Crea il tuo sistema finanziario personale.')).toBeVisible()

  await page.getByLabel('Nome').fill('Luca')
  await page.getByLabel('Email').fill('luca@example.com')
  await page.getByLabel('Password', { exact: true }).fill('abcdef')
  await page.getByLabel('Conferma password').fill('abcdeg')
  await page.getByRole('button', { name: 'Registrati' }).click()

  await expect(page.getByText('Le password non corrispondono.')).toBeVisible()
})

test('unauthenticated protected route redirects to login', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible()
})
