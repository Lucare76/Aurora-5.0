import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/00012_fix_auth_signup_profile_trigger.sql'),
  'utf8',
)

describe('auth signup trigger fix migration', () => {
  it('replaces handle_new_user with a security definer function and fixed search_path', () => {
    expect(migration).toContain('create or replace function public.handle_new_user()')
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = public, pg_temp')
  })

  it('uses NEW.id and null-safe email/metadata handling', () => {
    expect(migration.toLowerCase()).toContain('new.id')
    expect(migration).toContain("new.raw_user_meta_data ->> 'display_name'")
    expect(migration).toContain("new.raw_user_meta_data ->> 'full_name'")
    expect(migration).toContain("split_part(coalesce(new.email, ''), '@', 1)")
  })

  it('inserts only existing profile columns with explicit defaults', () => {
    for (const column of ['id', 'display_name', 'currency', 'locale', 'timezone', 'onboarding_done']) {
      expect(migration).toContain(column)
    }
    expect(migration).toContain("'EUR'")
    expect(migration).toContain("'it-IT'")
    expect(migration).toContain("'Europe/Rome'")
  })

  it('is idempotent for duplicate profile rows', () => {
    expect(migration.toLowerCase()).toContain('on conflict (id) do update')
  })

  it('recreates the auth.users trigger without disabling it', () => {
    expect(migration).toContain('drop trigger if exists on_auth_user_created on auth.users')
    expect(migration).toContain('create trigger on_auth_user_created')
    expect(migration).toContain('after insert on auth.users')
    expect(migration).toContain('for each row execute function public.handle_new_user()')
  })
})
