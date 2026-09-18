import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/00044_patrimonio_linked_history.sql', 'utf8')

describe('patrimonio linked history migration', () => {
  it('links external assets to existing Aurora accounts', () => {
    expect(sql).toContain('linked_account_id uuid references public.accounts(id)')
    expect(sql).toContain('idx_external_assets_linked_account')
  })

  it('stores immutable asset and consolidated snapshots', () => {
    expect(sql).toContain('create table if not exists public.external_asset_snapshots')
    expect(sql).toContain('create table if not exists public.patrimonio_snapshots')
    expect(sql).toContain('consolidated_value')
  })

  it('keeps accounting tables read-only', () => {
    expect(sql).not.toContain('update public.accounts')
    expect(sql).not.toContain('insert into public.transactions')
    expect(sql).not.toContain('update public.transactions')
  })
})
