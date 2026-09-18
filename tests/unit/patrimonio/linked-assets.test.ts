import { describe, expect, it } from 'vitest'
import {
  assetNetWorthContribution,
  historicalChange,
  resolveScalableLinkedAccount,
} from '@/lib/patrimonio/linked-assets'

describe('linked patrimonio assets', () => {
  const accounts = [
    { id: 'aurora-pac', name: 'Aurora Piano di Accumulo', balance: 5500 },
    { id: 'scalable', name: 'Scalable', balance: 4000 },
  ]

  it('maps the two Scalable holdings to their Aurora accounts', () => {
    expect(resolveScalableLinkedAccount('iShares Core MSCI World (Acc)', accounts)?.id).toBe('aurora-pac')
    expect(resolveScalableLinkedAccount('Vanguard FTSE All-World (Acc)', accounts)?.id).toBe('scalable')
  })

  it('adds only the market-value delta when the capital is already in Aurora', () => {
    expect(assetNetWorthContribution({
      id: 'a',
      name: 'iShares',
      current_value: 5577.5,
      include_in_net_worth: true,
      linked_account_id: 'aurora-pac',
    }, 5500)).toBeCloseTo(77.5, 2)
  })

  it('keeps unlinked external assets as full additions', () => {
    expect(assetNetWorthContribution({
      id: 'b',
      name: 'Other',
      current_value: 1000,
      include_in_net_worth: true,
      linked_account_id: null,
    }, null)).toBe(1000)
  })

  it('does not contribute excluded assets even when linked', () => {
    expect(assetNetWorthContribution({
      id: 'excluded',
      name: 'Excluded',
      current_value: 1200,
      include_in_net_worth: false,
      linked_account_id: 'scalable',
    }, 1000)).toBe(0)
  })

  it('compares with the latest snapshot at or before the requested lookback', () => {
    const now = new Date('2026-09-18T12:00:00.000Z')
    const snapshots = [
      { asset_id: 'a', current_value: 100, observed_at: '2026-09-10T12:00:00.000Z' },
      { asset_id: 'a', current_value: 90, observed_at: '2026-08-18T12:00:00.000Z' },
    ]
    expect(historicalChange(105, snapshots, 7, now)).toBe(5)
    expect(historicalChange(105, snapshots, 30, now)).toBe(15)
  })

  it('returns null until enough history exists and ignores future snapshots', () => {
    const now = new Date('2026-09-18T12:00:00.000Z')
    const snapshots = [
      { asset_id: 'a', current_value: 999, observed_at: '2026-09-19T12:00:00.000Z' },
      { asset_id: 'a', current_value: 100, observed_at: '2026-09-15T12:00:00.000Z' },
    ]

    expect(historicalChange(105, snapshots, 7, now)).toBeNull()
    expect(historicalChange(105, snapshots, 1, now)).toBe(5)
  })
})
