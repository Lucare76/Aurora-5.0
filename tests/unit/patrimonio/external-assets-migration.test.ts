import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/00042_external_assets.sql', 'utf8')

describe('external assets migration', () => {
  it('creates user-owned external assets with RLS', () => {
    expect(sql).toContain('create table if not exists public.external_assets')
    expect(sql).toContain('alter table public.external_assets enable row level security')
    expect(sql).toContain('auth.uid() = user_id')
  })

  it('tracks invested amount and current value without touching accounting tables', () => {
    expect(sql).toContain('invested_amount')
    expect(sql).toContain('current_value')
    expect(sql).toContain('include_in_net_worth')
    expect(sql).not.toContain('update public.accounts')
    expect(sql).not.toContain('insert into public.transactions')
    expect(sql).not.toContain('update public.transactions')
  })

  it('supports manual, screenshot and scalable-labelled sources', () => {
    expect(sql).toContain("'MANUAL', 'SCALABLE', 'SCREENSHOT'")
  })
})
