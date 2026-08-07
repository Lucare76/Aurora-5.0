import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/00031_personal_ai_provider_settings.sql'),
  'utf8',
)

describe('personal AI provider settings migration', () => {
  it('crea tabella privata con chiave cifrata e senza api_key in chiaro', () => {
    expect(migration).toContain('create table if not exists public.ai_provider_settings')
    expect(migration).toContain('encrypted_api_key text')
    expect(migration).toContain('api_key_last4 text')
    expect(migration).not.toMatch(/\n\s*api_key\s+text/i)
  })

  it('limita provider e stato connessione a enum controllati', () => {
    expect(migration).toContain("provider in ('OPENAI', 'ANTHROPIC', 'GEMINI')")
    expect(migration).toContain("connection_status in ('not_configured', 'configured', 'verified', 'error')")
  })

  it('abilita RLS e policy ownership per ogni operazione', () => {
    expect(migration).toContain('alter table public.ai_provider_settings enable row level security')
    for (const action of ['select', 'insert', 'update', 'delete']) {
      expect(migration).toContain(`for ${action}`)
    }
    expect(migration.match(/auth\.uid\(\)\) = user_id/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(migration).not.toContain('using (true)')
  })
})
