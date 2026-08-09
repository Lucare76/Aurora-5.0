import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/00035_personal_timeline.sql'), 'utf8').toLowerCase()

describe('personal timeline migration', () => {
  it('crea tabella, constraint principali e indice cronologico', () => {
    expect(migration).toContain('create table if not exists public.personal_timeline_events')
    expect(migration).toContain('personal_timeline_date_range_check')
    expect(migration).toContain("end_date is null or end_date >= event_date")
    expect(migration).toContain('idx_personal_timeline_events_user_event_date')
    expect(migration).toContain('on public.personal_timeline_events(user_id, event_date desc, created_at desc)')
  })

  it('abilita RLS e policy ownership per tutte le operazioni', () => {
    expect(migration).toContain('alter table public.personal_timeline_events enable row level security')
    expect(migration).toContain('personal_timeline_events_select_own')
    expect(migration).toContain('personal_timeline_events_insert_own')
    expect(migration).toContain('personal_timeline_events_update_own')
    expect(migration).toContain('personal_timeline_events_delete_own')
    expect(migration).toContain('(select auth.uid()) = user_id')
  })

  it('usa set_updated_at senza creare funzioni duplicate equivalenti', () => {
    expect(migration).toContain('create or replace function public.set_updated_at()')
    expect(migration).toContain('drop trigger if exists set_updated_at_personal_timeline_events')
    expect(migration).toContain('execute function public.set_updated_at()')
  })
})
