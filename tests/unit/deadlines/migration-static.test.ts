import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(process.cwd(), 'supabase/migrations/00034_personal_deadlines.sql')
const sql = readFileSync(migrationPath, 'utf8')

describe('personal deadlines migration static checks', () => {
  it('enforces completed_at coherently with status', () => {
    expect(sql).toContain('constraint personal_deadlines_completed_at_check check')
    expect(normalizeSql(sql)).toContain(normalizeSql(`
      (status = 'COMPLETED' and completed_at is not null)
      or
      (status <> 'COMPLETED' and completed_at is null)
    `))
    expect(normalizeSql(sql)).not.toContain(normalizeSql(`
      (status = 'COMPLETED' and completed_at is not null)
      or (status <> 'COMPLETED')
    `))
  })

  it.each([
    ['COMPLETED', '2026-08-09T10:00:00.000Z', true],
    ['COMPLETED', null, false],
    ['ACTIVE', null, true],
    ['ACTIVE', '2026-08-09T10:00:00.000Z', false],
    ['CANCELLED', null, true],
    ['CANCELLED', '2026-08-09T10:00:00.000Z', false],
  ])('%s with completed_at=%s validity is %s', (status, completedAt, expected) => {
    expect(satisfiesCompletedAtConstraint(status, completedAt)).toBe(expected)
  })

  it('keeps the existing set_updated_at function unchanged', () => {
    expect(normalizeSql(sql)).toContain(normalizeSql(`
      create or replace function public.set_updated_at()
      returns trigger
      language plpgsql
      set search_path = public
    `))
    expect(sql.match(/create or replace function public\.set_updated_at\(\)/g)).toHaveLength(1)
  })

  it('documents that pre-existing tables are not repaired by ALTER TABLE constraint blocks', () => {
    expect(normalizeSql(sql)).toContain('create table if not exists public.personal_deadlines')
    expect(normalizeSql(sql)).toContain('add column if not exists completed_at timestamptz')
    expect(normalizeSql(sql)).not.toContain('drop constraint if exists personal_deadlines_completed_at_check')
    expect(normalizeSql(sql)).not.toContain('add constraint personal_deadlines_completed_at_check')
  })
})

function satisfiesCompletedAtConstraint(status: string, completedAt: string | null): boolean {
  return (status === 'COMPLETED' && completedAt !== null) || (status !== 'COMPLETED' && completedAt === null)
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}
