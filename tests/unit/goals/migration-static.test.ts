import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/00017_savings_goals.sql', 'utf8')

describe('savings goals migration', () => {
  it('creates goals and contributions tables with required constraints', () => {
    expect(sql).toContain('create table if not exists public.savings_goals')
    expect(sql).toContain('create table if not exists public.goal_contributions')
    expect(sql).toContain('check (target_amount > 0)')
    expect(sql).toContain('check (current_amount >= 0)')
    expect(sql).toContain("check (status in ('ACTIVE', 'COMPLETED', 'ARCHIVED'))")
    expect(sql).toContain('check (amount > 0)')
  })

  it('enables RLS and user ownership policies', () => {
    expect(sql).toContain('alter table public.savings_goals enable row level security')
    expect(sql).toContain('alter table public.goal_contributions enable row level security')
    expect(sql).toContain('auth.uid() = user_id')
    expect(sql).toContain('Users can insert own goal contributions')
  })

  it('updates current_amount server-side through contribution triggers', () => {
    expect(sql).toContain('apply_goal_contribution_delta')
    expect(sql).toContain('current_amount = current_amount + new.amount')
    expect(sql).toContain('current_amount = greatest(0, current_amount - old.amount)')
  })
})
