import { describe, expect, it } from 'vitest'

import {
  buildAuroraScopeSummary,
  classifyTransferDirection,
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
