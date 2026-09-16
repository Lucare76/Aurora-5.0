import { describe, expect, it } from 'vitest'
import {
  calculateReconciliationDifference,
  daysSinceStatement,
  deriveReconciliationStatus,
  isReconciliationBalanced,
  latestReconciliationByAccount,
  RECONCILIATION_CENT_TOLERANCE,
} from './reconciliation'

describe('reconciliation math — cent-based, never floating point approximate', () => {
  it('1. riconciliazione perfetta: bank = 1000, app = 1000 => difference = 0, stato reconciled', () => {
    const difference = calculateReconciliationDifference(1000, 1000)
    expect(difference).toBe(0)
    expect(isReconciliationBalanced(difference)).toBe(true)
    expect(deriveReconciliationStatus(difference)).toBe('reconciled')
  })

  it('2. mismatch: bank = 993.90, app = 1000 => difference = -6.10, stato mismatch', () => {
    const difference = calculateReconciliationDifference(993.90, 1000)
    expect(difference).toBe(-6.10)
    expect(isReconciliationBalanced(difference)).toBe(false)
    expect(deriveReconciliationStatus(difference)).toBe('mismatch')
  })

  it('treats a difference within the cent tolerance as reconciled (floating point safe)', () => {
    // 0.1 + 0.2 famously isn't exactly 0.3 in IEEE754 — the tolerance must absorb this.
    const difference = calculateReconciliationDifference(1000.3, 1000 + 0.1 + 0.2)
    expect(Math.abs(difference)).toBeLessThanOrEqual(RECONCILIATION_CENT_TOLERANCE)
    expect(deriveReconciliationStatus(difference)).toBe('reconciled')
  })

  it('treats exactly 0.02 as mismatch (just above tolerance)', () => {
    expect(isReconciliationBalanced(0.02)).toBe(false)
  })

  it('picks the most recent reconciliation per account by created_at', () => {
    const rows = [
      { account_id: 'a1', created_at: '2026-01-01T00:00:00Z', v: 'old' },
      { account_id: 'a1', created_at: '2026-02-01T00:00:00Z', v: 'new' },
      { account_id: 'a2', created_at: '2026-01-15T00:00:00Z', v: 'only' },
    ]
    const latest = latestReconciliationByAccount(rows)
    expect(latest.get('a1')?.v).toBe('new')
    expect(latest.get('a2')?.v).toBe('only')
  })

  it('computes days since the statement date', () => {
    expect(daysSinceStatement('2026-01-01', '2026-01-31')).toBe(30)
    expect(daysSinceStatement('2026-01-01', '2026-01-01')).toBe(0)
  })
})
