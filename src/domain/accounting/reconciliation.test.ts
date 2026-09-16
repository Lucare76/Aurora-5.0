import { describe, expect, it } from 'vitest'
import {
  calculateReconciliationDifference,
  compareReconciliationRecency,
  daysSinceStatement,
  deriveReconciliationStatus,
  isReconciliationBalanced,
  latestReconciliationByAccount,
} from './reconciliation'

describe('reconciliation math — cent-based, never floating point approximate, no tolerance band', () => {
  it('1. riconciliazione perfetta: bank = 1000, app = 1000 => difference = 0.00, stato reconciled', () => {
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

  it('+0.01 di differenza è già mismatch: non esiste una banda di tolleranza oltre l\'arrotondamento', () => {
    expect(isReconciliationBalanced(0.01)).toBe(false)
    expect(deriveReconciliationStatus(0.01)).toBe('mismatch')
  })

  it('-0.01 di differenza è già mismatch', () => {
    expect(isReconciliationBalanced(-0.01)).toBe(false)
    expect(deriveReconciliationStatus(-0.01)).toBe('mismatch')
  })

  it('un residuo di floating point che arrotonda a 0.00 resta reconciled (sicurezza floating point, non tolleranza)', () => {
    // 0.1 + 0.2 famously isn't exactly 0.3 in IEEE754 (it's 0.30000000000000004);
    // the raw difference is a tiny non-zero float, but rounding to cents must
    // still land on exactly 0.00, not merely "close to zero".
    const difference = calculateReconciliationDifference(1000.3, 1000 + 0.1 + 0.2)
    expect(difference).toBe(0)
    expect(isReconciliationBalanced(difference)).toBe(true)
    expect(deriveReconciliationStatus(difference)).toBe('reconciled')
  })

  it('picks the most recent reconciliation per account by statement_date, not created_at', () => {
    const rows = [
      { account_id: 'a1', statement_date: '2026-01-31', created_at: '2026-01-01T00:00:00Z', v: 'old' },
      { account_id: 'a1', statement_date: '2026-02-28', created_at: '2026-02-01T00:00:00Z', v: 'new' },
      { account_id: 'a2', statement_date: '2026-01-15', created_at: '2026-01-15T00:00:00Z', v: 'only' },
    ]
    const latest = latestReconciliationByAccount(rows)
    expect(latest.get('a1')?.v).toBe('new')
    expect(latest.get('a2')?.v).toBe('only')
  })

  it('caso obbligatorio: un inserimento retroattivo (statement_date più vecchia, created_at più recente) non deve mai diventare la riconciliazione corrente', () => {
    const current = { account_id: 'a1', statement_date: '2026-09-15', created_at: '2026-09-15T09:00:00Z', v: 'settembre' }
    const retroactive = { account_id: 'a1', statement_date: '2026-08-31', created_at: '2026-09-16T09:00:00Z', v: 'agosto-retroattiva' }

    // Inserted in either order, the current one must always win.
    expect(latestReconciliationByAccount([current, retroactive]).get('a1')?.v).toBe('settembre')
    expect(latestReconciliationByAccount([retroactive, current]).get('a1')?.v).toBe('settembre')
    expect(compareReconciliationRecency(current, retroactive)).toBeLessThan(0)
    expect(compareReconciliationRecency(retroactive, current)).toBeGreaterThan(0)
  })

  it('a parità di statement_date, il tie-breaker è created_at DESC', () => {
    const earlier = { account_id: 'a1', statement_date: '2026-09-15', created_at: '2026-09-15T09:00:00Z', v: 'prima' }
    const later = { account_id: 'a1', statement_date: '2026-09-15', created_at: '2026-09-15T18:00:00Z', v: 'dopo' }
    expect(latestReconciliationByAccount([earlier, later]).get('a1')?.v).toBe('dopo')
  })

  it('computes days since the statement date', () => {
    expect(daysSinceStatement('2026-01-01', '2026-01-31')).toBe(30)
    expect(daysSinceStatement('2026-01-01', '2026-01-01')).toBe(0)
  })
})
