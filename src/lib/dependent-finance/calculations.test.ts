import { describe, expect, it } from 'vitest'

import {
  buildAuroraScopeSummary,
  classifyTransferDirection,
  filterAccountsByScope,
  filterPersonalAccounts,
  getAccountEffectiveScopes,
  getAuroraTransactionImpact,
} from './calculations'
import type { MinimalAccount, MinimalTransaction } from './types'

const auroraAccount: MinimalAccount = {
  id: 'aurora-account',
  name: 'Aurora',
  balance: 665.1,
  currency: 'EUR',
  is_active: true,
  type: 'savings',
}

const auroraSavings: MinimalAccount = {
  id: 'aurora-savings',
  name: 'Aurora risparmio',
  balance: 334.9,
  currency: 'EUR',
  is_active: true,
  type: 'savings',
}

const personalAccount: MinimalAccount = {
  id: 'personal-account',
  name: 'Personale',
  balance: 334.9,
  currency: 'EUR',
  is_active: true,
  type: 'checking',
}

const links = [
  { account_id: auroraAccount.id, purpose: 'DEPENDENT_AURORA' },
  { account_id: auroraSavings.id, purpose: 'DEPENDENT_AURORA' },
  { account_id: personalAccount.id, purpose: 'PERSONAL' },
]

function transfer(overrides: Partial<MinimalTransaction>): MinimalTransaction {
  return {
    id: 'tx',
    account_id: auroraAccount.id,
    transfer_peer_id: personalAccount.id,
    destination_account_id: personalAccount.id,
    type: 'transfer',
    amount: 334.9,
    date: '2026-09-11',
    description: 'VACANZA PUGLIA',
    ...overrides,
  }
}

describe('dependent finance Aurora transfer calculations', () => {
  it('treats Aurora to personal as negative for Aurora patrimony and recent movement impact', () => {
    const tx = transfer({})
    const summary = buildAuroraScopeSummary({ accounts: [auroraAccount], transactions: [tx], links })

    expect(classifyTransferDirection(auroraAccount.id, personalAccount.id, links)).toBe('AURORA_TO_PERSONAL')
    expect(getAuroraTransactionImpact(tx, links)).toBe(-334.9)
    expect(summary.transfersOut).toBe(334.9)
    expect(summary.periodChange).toBe(-334.9)
    expect(summary.recentTransactions[0].auroraImpact).toBe(-334.9)
    expect(summary.balance).toBe(665.1)
  })

  it('treats personal to Aurora as positive for Aurora patrimony', () => {
    const tx = transfer({
      account_id: personalAccount.id,
      transfer_peer_id: auroraAccount.id,
      destination_account_id: auroraAccount.id,
    })
    const summary = buildAuroraScopeSummary({ accounts: [auroraAccount], transactions: [tx], links })

    expect(classifyTransferDirection(personalAccount.id, auroraAccount.id, links)).toBe('PERSONAL_TO_AURORA')
    expect(getAuroraTransactionImpact(tx, links)).toBe(334.9)
    expect(summary.transfersIn).toBe(334.9)
    expect(summary.periodChange).toBe(334.9)
    expect(summary.recentTransactions[0].auroraImpact).toBe(334.9)
  })

  it('keeps Aurora to Aurora neutral for total Aurora patrimony', () => {
    const tx = transfer({
      account_id: auroraAccount.id,
      transfer_peer_id: auroraSavings.id,
      destination_account_id: auroraSavings.id,
    })
    const summary = buildAuroraScopeSummary({ accounts: [auroraAccount, auroraSavings], transactions: [tx], links })

    expect(classifyTransferDirection(auroraAccount.id, auroraSavings.id, links)).toBe('AURORA_TO_AURORA')
    expect(getAuroraTransactionImpact(tx, links)).toBe(0)
    expect(summary.internalTransfers).toBe(334.9)
    expect(summary.periodChange).toBe(0)
    expect(summary.balance).toBe(1000)
  })

  it('keeps personal to personal neutral for Aurora patrimony', () => {
    const tx = transfer({
      account_id: personalAccount.id,
      transfer_peer_id: 'other-personal-account',
      destination_account_id: 'other-personal-account',
    })
    const summary = buildAuroraScopeSummary({ accounts: [auroraAccount], transactions: [tx], links })

    expect(classifyTransferDirection(personalAccount.id, 'other-personal-account', links)).toBe('PERSONAL_TO_PERSONAL')
    expect(getAuroraTransactionImpact(tx, links)).toBe(0)
    expect(summary.periodChange).toBe(0)
    expect(summary.recentTransactions).toHaveLength(0)
  })
})

describe('multi-scope accounts (an account can carry more than one purpose)', () => {
  const dualAccount: MinimalAccount = {
    id: 'pac-aurora-account',
    name: 'PAC Aurora',
    balance: 500,
    currency: 'EUR',
    is_active: true,
    type: 'investment',
  }

  const auroraOnlyAccount: MinimalAccount = {
    id: 'aurora-only-account',
    name: 'Conto esclusivamente Aurora',
    balance: 200,
    currency: 'EUR',
    is_active: true,
    type: 'savings',
  }

  const plainPersonalAccount: MinimalAccount = {
    id: 'plain-personal-account',
    name: 'Conto personale',
    balance: 100,
    currency: 'EUR',
    is_active: true,
    type: 'checking',
  }

  const dualScopeLinks = [
    { account_id: dualAccount.id, purpose: 'PERSONAL' },
    { account_id: dualAccount.id, purpose: 'DEPENDENT_AURORA' },
    { account_id: auroraOnlyAccount.id, purpose: 'DEPENDENT_AURORA' },
    // plainPersonalAccount has no rows at all -> implicit PERSONAL, same as with 0-1 purpose today
  ]

  it('reports the explicit scopes for a dual-purpose account, and the implicit default for an unlinked one', () => {
    expect(getAccountEffectiveScopes(dualScopeLinks, dualAccount.id)).toEqual(new Set(['PERSONAL', 'DEPENDENT_AURORA']))
    expect(getAccountEffectiveScopes(dualScopeLinks, auroraOnlyAccount.id)).toEqual(new Set(['DEPENDENT_AURORA']))
    expect(getAccountEffectiveScopes(dualScopeLinks, plainPersonalAccount.id)).toEqual(new Set(['PERSONAL']))
  })

  it('lets a dual-purpose account (PAC Aurora) appear in both the personal and the Aurora scoped views', () => {
    const accounts = [dualAccount, auroraOnlyAccount, plainPersonalAccount]

    const personal = filterPersonalAccounts(accounts, dualScopeLinks)
    const aurora = filterAccountsByScope(accounts, dualScopeLinks, 'DEPENDENT_AURORA')

    expect(personal.map((a) => a.id).sort()).toEqual([dualAccount.id, plainPersonalAccount.id].sort())
    expect(aurora.map((a) => a.id).sort()).toEqual([auroraOnlyAccount.id, dualAccount.id].sort())
  })

  it('excludes an Aurora-only account from the personal view, exactly like a single-scope link today', () => {
    const personal = filterPersonalAccounts([auroraOnlyAccount], dualScopeLinks)
    expect(personal).toHaveLength(0)
  })

  it('never double-counts a dual-scope account balance in a combined personal+Aurora total', () => {
    const accounts = [dualAccount, auroraOnlyAccount, plainPersonalAccount]
    const personal = filterPersonalAccounts(accounts, dualScopeLinks)
    const aurora = filterAccountsByScope(accounts, dualScopeLinks, 'DEPENDENT_AURORA')

    const combinedIds = new Set([...personal.map((a) => a.id), ...aurora.map((a) => a.id)])
    const combinedBalance = accounts
      .filter((account) => combinedIds.has(account.id))
      .reduce((sum, account) => sum + account.balance, 0)

    // dualAccount.balance (500) must be counted exactly once, not once per scope (personal+aurora would be 1000+200=1200)
    expect(combinedBalance).toBe(dualAccount.balance + auroraOnlyAccount.balance + plainPersonalAccount.balance)
  })

  it('removing the PERSONAL link leaves DEPENDENT_AURORA scope intact', () => {
    const linksAfterRemovingPersonal = dualScopeLinks.filter(
      (link) => !(link.account_id === dualAccount.id && link.purpose === 'PERSONAL'),
    )

    expect(getAccountEffectiveScopes(linksAfterRemovingPersonal, dualAccount.id)).toEqual(new Set(['DEPENDENT_AURORA']))
    expect(filterPersonalAccounts([dualAccount], linksAfterRemovingPersonal)).toHaveLength(0)
    expect(filterAccountsByScope([dualAccount], linksAfterRemovingPersonal, 'DEPENDENT_AURORA').map((a) => a.id)).toEqual([dualAccount.id])
  })

  it('keeps legacy single-purpose behavior unchanged for accounts with 0 or 1 purpose rows', () => {
    // This mirrors the original single-scope `links` fixture above: every account has 0 or 1 rows.
    expect(getAccountEffectiveScopes(links, auroraAccount.id)).toEqual(new Set(['DEPENDENT_AURORA']))
    expect(getAccountEffectiveScopes(links, personalAccount.id)).toEqual(new Set(['PERSONAL']))
    expect(getAccountEffectiveScopes(links, 'never-linked-account')).toEqual(new Set(['PERSONAL']))
    expect(filterPersonalAccounts([auroraAccount, personalAccount], links).map((a) => a.id)).toEqual([personalAccount.id])
  })
})
