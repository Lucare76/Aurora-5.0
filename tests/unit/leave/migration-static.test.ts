import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/00033_leave_and_104_permissions.sql'), 'utf8')

describe('leave and 104 permissions migration', () => {
  it('crea solo tabelle HR dedicate e abilita RLS ownership', () => {
    expect(migration).toContain('create table if not exists public.leave_settings')
    expect(migration).toContain('create table if not exists public.leave_entries')
    expect(migration).toContain('alter table public.leave_settings enable row level security')
    expect(migration).toContain('alter table public.leave_entries enable row level security')
    expect(migration.match(/\(select auth\.uid\(\)\) = user_id/g)?.length).toBeGreaterThanOrEqual(7)
  })

  it('mantiene default, vincoli e update trigger idempotenti', () => {
    expect(migration).toContain('vacation_days_per_year numeric not null default 30')
    expect(migration).toContain('permit_104_hours_per_month numeric not null default 24')
    expect(migration).toContain("type in ('VACATION', 'PERMIT_104')")
    expect(migration).toContain('drop trigger if exists set_updated_at_leave_settings')
    expect(migration).toContain('drop trigger if exists set_updated_at_leave_entries')
  })

  it('non modifica tabelle contabili o funzioni finanziarie', () => {
    expect(migration).not.toMatch(/alter table public\.(accounts|transactions|budgets|loans|recurring_rules)/i)
    expect(migration).not.toContain('adjust_account_balance')
    expect(migration).not.toContain('create_transaction_atomic')
  })
})
