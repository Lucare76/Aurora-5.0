import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/00045_poste_external_assets.sql', 'utf8')
const importRoute = readFileSync('src/app/api/integrations/poste/import/route.ts', 'utf8')
const manualRoute = readFileSync('src/app/api/integrations/poste/manual/route.ts', 'utf8')

describe('Poste patrimonio integration safety', () => {
  it('adds POSTE as an external source', () => {
    expect(migration).toContain("'POSTE'")
    expect(migration).toContain('external_assets_source_type_check')
  })

  it('never mutates Aurora account balances or transactions', () => {
    for (const source of [importRoute, manualRoute]) {
      expect(source).not.toContain("from('accounts').update")
      expect(source).not.toContain("from('transactions').insert")
      expect(source).not.toContain('adjust_account_balance')
      expect(source).not.toContain('create_transaction_atomic')
    }
  })

  it('links imported/manual assets to existing Aurora accounts', () => {
    expect(importRoute).toContain('linked_account_id')
    expect(manualRoute).toContain('linked_account_id')
    expect(importRoute).toContain("source_type: 'POSTE'")
    expect(manualRoute).toContain("source_type: 'POSTE'")
  })
})
