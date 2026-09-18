import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/00041_goal_linked_sources.sql', 'utf8')

describe('linked goal sources migration', () => {
  it('creates read-only source and snapshot tables with ownership controls', () => {
    expect(sql).toContain('create table if not exists public.goal_linked_sources')
    expect(sql).toContain('create table if not exists public.goal_source_snapshots')
    expect(sql).toContain('alter table public.goal_linked_sources enable row level security')
    expect(sql).toContain('alter table public.goal_source_snapshots enable row level security')
    expect(sql).toContain('auth.uid() = user_id')
  })

  it('keeps snapshots non-negative and exposes one authenticated atomic RPC', () => {
    expect(sql).toContain('goal_source_snapshots_value_non_negative')
    expect(sql).toContain('upsert_goal_linked_source_snapshot')
    expect(sql).toContain('security definer')
    expect(sql).toContain('grant execute on function public.upsert_goal_linked_source_snapshot')
  })

  it('never mutates accounts or transactions', () => {
    expect(sql).not.toContain('update public.accounts')
    expect(sql).not.toContain('insert into public.transactions')
    expect(sql).not.toContain('update public.transactions')
  })
})
