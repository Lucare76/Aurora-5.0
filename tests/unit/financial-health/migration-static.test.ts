import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/00022_financial_health_snapshots.sql'), 'utf8')

describe('financial health snapshots migration', () => {
  it('is idempotent for table, policy, trigger and index creation', () => {
    expect(migration).toMatch(/create table if not exists public\.financial_health_snapshots/i)
    expect(migration).toMatch(/add column if not exists/i)
    expect(migration).toMatch(/drop policy if exists "financial_health_snapshots_select_own"/i)
    expect(migration).toMatch(/drop trigger if exists set_updated_at_financial_health_snapshots/i)
    expect(migration).toMatch(/create index if not exists financial_health_snapshots_user_period_idx/i)
  })

  it('protects rows with auth.uid ownership policies', () => {
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i)
    expect(migration).toMatch(/\(select auth\.uid\(\)\) = user_id/i)
  })
})
