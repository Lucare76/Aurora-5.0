import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/00048_reconciliation_patrimonio_atomic.sql', 'utf8')
const service = readFileSync('src/lib/reconciliation/service.ts', 'utf8')
const page = readFileSync('src/app/(app)/reconciliation/page.tsx', 'utf8')
const snapshotRoute = readFileSync('src/app/api/patrimonio/snapshot/route.ts', 'utf8')

describe('reconciliation patrimonio hardening', () => {
  it('uses one authenticated RPC for reconciliation and 1:1 asset snapshot updates', () => {
    expect(migration).toContain('create or replace function public.create_reconciliation_atomic')
    expect(migration).toContain('for update')
    expect(migration).toContain('insert into public.account_reconciliations')
    expect(migration).toContain('update public.external_assets')
    expect(migration).toContain('insert into public.external_asset_snapshots')
    expect(migration).toContain('grant execute on function public.create_reconciliation_atomic')
    expect(service).toContain("supabase.rpc('create_reconciliation_atomic'")
  })

  it('never mutates accounts.balance during reconciliation', () => {
    expect(migration).not.toMatch(/update\s+public\.accounts\s+set\s+balance/i)
  })

  it('syncs only an exactly-one linked asset and skips multi-holding accounts', () => {
    expect(migration).toContain('limit 2')
    expect(migration).toContain('if v_asset_count = 1 then')
    expect(migration).toContain("v_patrimonio_sync := 'skipped'")
  })

  it('records consolidated patrimonio history after an actual 1:1 value update', () => {
    expect(page).toContain("result.patrimonioSync === 'updated'")
    expect(page).toContain("fetch('/api/patrimonio/snapshot'")
    expect(snapshotRoute).toContain('recordConsolidatedPatrimonioSnapshot')
  })

  it('surfaces consolidated snapshot failure instead of silently hiding it', () => {
    expect(page).toContain('consolidatedSnapshotOk')
    expect(page).toContain("toast.warning('Riconciliazione salvata e Patrimonio aggiornato, ma lo storico consolidato non è stato registrato.')")
  })
})
