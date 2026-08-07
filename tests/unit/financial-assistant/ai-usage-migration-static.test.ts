import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/00032_ai_usage_tracking.sql'),
  'utf8',
)
const sqlWithoutComments = migration
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

describe('AI usage tracking migration', () => {
  it('crea tabella aggregata senza payload sensibili', () => {
    expect(migration).toContain('create table if not exists public.ai_usage_daily')
    for (const column of ['request_count', 'input_tokens', 'output_tokens', 'total_tokens', 'estimated_cost_usd']) {
      expect(migration).toContain(column)
    }
    expect(sqlWithoutComments).not.toMatch(/prompt|response|api_key|email|account_id|transaction_id/i)
  })

  it('usa unique per utente provider modello giorno', () => {
    expect(migration).toContain('unique (user_id, provider, model, usage_date)')
  })

  it('abilita RLS e policy ownership', () => {
    expect(migration).toContain('alter table public.ai_usage_daily enable row level security')
    expect(migration.match(/auth\.uid\(\)\) = user_id/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(migration).not.toContain('using (true)')
  })

  it('fornisce RPC atomica di incremento', () => {
    expect(migration).toContain('create or replace function public.increment_ai_usage_daily')
    expect(migration).toContain('on conflict (user_id, provider, model, usage_date)')
    expect(migration).toContain('request_count = public.ai_usage_daily.request_count + 1')
    expect(migration).toContain('grant execute on function public.increment_ai_usage_daily')
  })
})
