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
