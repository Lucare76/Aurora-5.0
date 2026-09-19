import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/00047_financial_month_closures.sql', 'utf8')

describe('financial month closures migration', () => {
  it('keeps one protected closure per user and month', () => {
    expect(migration).toContain('financial_month_closures_unique_period unique (user_id, period_key)')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('auth.uid() = user_id')
    expect(migration).toContain('grant select, insert, update on public.financial_month_closures to authenticated')
  })
})
