import { afterEach, describe, expect, it } from 'vitest'
import {
  canAccessPrivateFinance,
  isPrivateFinanceConfigured,
  requirePrivateFinanceAccess,
} from '@/lib/access/private-finance-access'

const originalAllowedEmail = process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL

afterEach(() => {
  if (originalAllowedEmail === undefined) delete process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL
  else process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = originalAllowedEmail
})

describe('private finance access control', () => {
  it('autorizza email esatta normalizzando maiuscole, minuscole e spazi', () => {
    process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = '  Luca_Renna@Hotmail.com  '

    expect(isPrivateFinanceConfigured()).toBe(true)
    expect(canAccessPrivateFinance(' luca_renna@hotmail.com ')).toBe(true)
    expect(requirePrivateFinanceAccess({ email: 'LUCA_RENNA@HOTMAIL.COM' })).toBe(true)
  })

  it('blocca email diverse, null e undefined', () => {
    process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = 'luca_renna@hotmail.com'

    expect(canAccessPrivateFinance('altro@example.com')).toBe(false)
    expect(canAccessPrivateFinance(null)).toBe(false)
    expect(canAccessPrivateFinance(undefined)).toBe(false)
  })

  it('fallisce chiuso senza configurazione, con valore vuoto o non valido', () => {
    delete process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL
    expect(isPrivateFinanceConfigured()).toBe(false)
    expect(canAccessPrivateFinance('luca_renna@hotmail.com')).toBe(false)

    process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = '   '
    expect(isPrivateFinanceConfigured()).toBe(false)
    expect(canAccessPrivateFinance('luca_renna@hotmail.com')).toBe(false)

    process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = 'non-una-email'
    expect(isPrivateFinanceConfigured()).toBe(false)
    expect(canAccessPrivateFinance('non-una-email')).toBe(false)
  })

  it('non mantiene stato autorizzato tra chiamate diverse', () => {
    process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = 'luca_renna@hotmail.com'

    expect(canAccessPrivateFinance('luca_renna@hotmail.com')).toBe(true)
    expect(canAccessPrivateFinance('altro@example.com')).toBe(false)
  })
})
