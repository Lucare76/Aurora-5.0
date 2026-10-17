import { describe, expect, it } from 'vitest'
import { assetNetWorthContribution, resolveAssetLinkedAccount, resolveScalableLinkedAccount } from './linked-assets'

const accounts = [
  { id: 'world', name: 'iShares Core MSCI World', balance: 4564 },
  { id: 'all-world', name: 'Vanguard FTSE All-World', balance: 4000 },
]

describe('Scalable positions already represented by Aurora accounts', () => {
  it('links the current account names and subtracts their balances once', () => {
    const holdings = [
      { name: 'iShares Core MSCI World (Acc)', current_value: 5622.19, accountId: 'world' },
      { name: 'Vanguard FTSE All-World (Acc)', current_value: 4086.85, accountId: 'all-world' },
    ]
    const contributions = holdings.map((holding) => {
      const linked = resolveAssetLinkedAccount({ name: holding.name, source_type: 'SCALABLE' }, accounts)
      expect(linked?.id).toBe(holding.accountId)
      return assetNetWorthContribution({
        id: holding.accountId, name: holding.name, current_value: holding.current_value,
        include_in_net_worth: true, linked_account_id: linked?.id,
      }, linked?.balance ?? null)
    })
    expect(contributions.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1145.04, 2)
    expect(212836.30 - accounts.reduce((sum, account) => sum + account.balance, 0)).toBeCloseTo(204272.30, 2)
  })

  it('retains older account names and never guesses a link for unrelated investments', () => {
    expect(resolveScalableLinkedAccount('iShares Core MSCI World (Acc)', [
      { id: 'old', name: 'Aurora Piano di Accumulo', balance: 100 },
    ])?.id).toBe('old')
    expect(resolveScalableLinkedAccount('Vanguard FTSE All-World (Acc)', [
      { id: 'old', name: 'Scalable', balance: 100 },
    ])?.id).toBe('old')
    expect(resolveAssetLinkedAccount({ name: 'iShares Digital Security (Acc)', source_type: 'SCALABLE' }, accounts)).toBeNull()
  })
})


describe('Scalable ETF account reconciliation', () => {
  it('counts Digital Security and Small Cap once, including negative returns', () => {
    const linkedAccounts = [
      { id: 'digital', name: 'iShares Digital Security', balance: 700 },
      { id: 'small-cap', name: 'iShares MSCI World Small Cap', balance: 100 },
    ]
    const holdings = [
      { id: 'digital-position', name: 'iShares Digital Security (Acc)', current_value: 677.56, expected: 'digital' },
      { id: 'small-position', name: 'iShares MSCI World Small Cap (Acc)', current_value: 99.58, expected: 'small-cap' },
    ]
    const adjustments = holdings.map((holding) => {
      const linked = resolveAssetLinkedAccount({ ...holding, source_type: 'SCALABLE' }, linkedAccounts)
      expect(linked?.id).toBe(holding.expected)
      return assetNetWorthContribution({ ...holding, include_in_net_worth: true, linked_account_id: linked?.id }, linked?.balance ?? null)
    })
    expect(adjustments[0]).toBeCloseTo(-22.44, 2)
    expect(adjustments[1]).toBeCloseTo(-0.42, 2)
    expect(800 + adjustments.reduce((sum, value) => sum + value, 0)).toBeCloseTo(777.14, 2)
  })

  it('resolves stable links for every sync without overriding an explicit account', () => {
    const linkedAccounts = [{ id: 'digital', name: ' iShares Digital Security ', balance: 700 }]
    expect(resolveScalableLinkedAccount('ISHARES DIGITAL SECURITY (ACC)', linkedAccounts)?.id).toBe('digital')
    expect(resolveScalableLinkedAccount('iShares Digital Security (Acc)', linkedAccounts)?.id).toBe('digital')
    expect(resolveAssetLinkedAccount({ name: 'iShares Digital Security (Acc)', source_type: 'SCALABLE', linked_account_id: 'custom' }, [...linkedAccounts, { id: 'custom', name: 'Scelto manualmente', balance: 1 }])?.id).toBe('custom')
    expect(resolveAssetLinkedAccount({ name: 'iShares Digital Security (Acc)', source_type: 'MANUAL' }, linkedAccounts)).toBeNull()
  })
})
