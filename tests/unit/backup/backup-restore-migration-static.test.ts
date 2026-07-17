import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/00011_add_atomic_empty_account_restore.sql'),
  'utf8',
)

describe('Backup restore migration static safety checks', () => {
  it('crea token, run log e RPC atomica', () => {
    expect(migration).toContain('create table if not exists public.backup_restore_tokens')
    expect(migration).toContain('create table if not exists public.backup_restore_runs')
    expect(migration).toContain('create or replace function public.restore_aurora_backup_v1_empty_account')
  })

  it('usa SECURITY DEFINER con search_path fissato e auth.uid obbligatorio', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = public, pg_temp')
    expect(migration).toContain('v_uid uuid := auth.uid()')
    expect(migration).toContain("raise exception 'UNAUTHENTICATED'")
  })

  it('non usa SQL dinamico o input tabella arbitrario', () => {
    expect(migration.toLowerCase()).not.toMatch(/\bexecute\s+(format|immediate|\()/)
    expect(migration).not.toMatch(/p_table|p_sql|p_user_id|p_force|p_merge|p_replace/)
  })

  it('usa token monouso, lock per utente e grant minimo', () => {
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('for update')
    expect(migration).toContain('used_at is null')
    expect(migration).toContain('grant execute on function public.restore_aurora_backup_v1_empty_account')
    expect(migration).toContain('to authenticated')
  })

  it('ricontrolla account vuoto dentro la RPC', () => {
    expect(migration).toContain('exists (select 1 from public.accounts where user_id = v_uid)')
    expect(migration).toContain('exists (select 1 from public.transactions where user_id = v_uid)')
    expect(migration).toContain('ACCOUNT_NOT_EMPTY')
  })

  it('gestisce categorie default tecniche con regola esplicita', () => {
    expect(migration).toContain('delete from public.categories')
    expect(migration).toContain('and is_default is true')
  })

  it('verifica i conteggi finali delle collezioni principali', () => {
    for (const table of [
      'accounts',
      'categories',
      'transactions',
      'budgets',
      'recurring_rules',
      'loans',
      'loan_payments',
      'birthdays',
      'birthday_reminder_log',
    ]) {
      expect(migration).toContain(`from public.${table} where user_id = v_uid`)
    }
  })
})
