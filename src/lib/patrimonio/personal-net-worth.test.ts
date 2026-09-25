import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { personalNetWorthFromAccounts } from './personal-net-worth'

describe('consolidated patrimonio snapshot base', () => {
  it('matches personal active accounts and excludes dependent-only and inactive accounts', () => {
    expect(personalNetWorthFromAccounts([
      { id: 'personal', balance: 183597.23, is_active: true },
      { id: 'dependent', balance: 8091.92, is_active: true },
      { id: 'inactive', balance: 10, is_active: false },
    ], [{ account_id: 'dependent', purpose: 'DEPENDENT_AURORA' }])).toBe(183597.23)
  })

  it('scopes both snapshot queries before using an admin client', () => {
    for (const file of ['src/lib/integrations/scalable-sync.ts', 'src/lib/patrimonio/record-consolidated-snapshot.ts']) {
      const source = readFileSync(file, 'utf8')
      expect(source).toMatch(/\.from\('accounts'\)[\s\S]*?\.eq\('user_id', user\.id\)/)
      expect(source).toMatch(/\.from\('account_purpose_links'\)[\s\S]*?\.eq\('user_id', user\.id\)/)
      expect(source).toContain('personalNetWorthFromAccounts(accountsRes.data ?? [], linksRes.data ?? [])')
    }
  })
})
