import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Contract test for the /transactions isolation fix: the page must never fetch
 * transactions or accounts belonging to Aurora/DEPENDENT purposes without applying
 * the canonical PERSONAL scope rule from dependent-finance/calculations.
 */

const page = readFileSync('src/app/(app)/transactions/page.tsx', 'utf8')
const useTransactionsHook = readFileSync('src/hooks/use-transactions.ts', 'utf8')
const useAccountsHook = readFileSync('src/hooks/use-accounts.ts', 'utf8')

describe('/transactions page scope isolation', () => {
  it('imports and uses the canonical PERSONAL exclusion rule', () => {
    expect(page).toContain("getPersonalExcludedAccountIds } from '@/lib/dependent-finance/calculations'")
    expect(page).toContain('getPersonalExcludedAccountIds(purposeLinks, scopeAccounts)')
  })

  it('excludes DEPENDENT/Aurora accounts at the query level (not only client-side)', () => {
    expect(page).toContain("query.not('account_id', 'in'")
  })

  it('derives the exclusion list from account_purpose_links, not from heuristics on name/category', () => {
    expect(page).toContain("from('account_purpose_links')")
  })

  it('uses the already scope-filtered useAccounts() hook for the account filter dropdown', () => {
    expect(page).toContain("from '@/hooks/use-accounts'")
    expect(useAccountsHook).toContain('filterPersonalAccounts')
  })
})

describe('use-transactions hook scope isolation', () => {
  it('applies the same canonical PERSONAL exclusion rule', () => {
    expect(useTransactionsHook).toContain("getPersonalExcludedAccountIds } from '@/lib/dependent-finance/calculations'")
    expect(useTransactionsHook).toContain("query.not('account_id', 'in'")
  })
})
