import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/00043_scalable_direct_sync.sql', 'utf8')

describe('Scalable direct sync migration', () => {
  it('stores only encrypted-token payload fields and isolates rows by user', () => {
    expect(sql).toContain('create table if not exists public.scalable_connections')
    expect(sql).toContain('access_token_enc')
    expect(sql).toContain('refresh_token_enc')
    expect(sql).toContain('alter table public.scalable_connections enable row level security')
    expect(sql).toContain('auth.uid() = user_id')
    expect(sql).not.toContain('access_token text')
    expect(sql).not.toContain('refresh_token text')
  })

  it('adds a stable source key for idempotent Scalable asset sync', () => {
    expect(sql).toContain('add column if not exists external_key text')
    expect(sql).toContain('idx_external_assets_user_source_key')
    expect(sql).toContain('user_id, source_type, external_key')
  })

  it('does not mutate accounting balances or transactions', () => {
    expect(sql).not.toContain('update public.accounts')
    expect(sql).not.toContain('insert into public.transactions')
    expect(sql).not.toContain('update public.transactions')
  })
})
