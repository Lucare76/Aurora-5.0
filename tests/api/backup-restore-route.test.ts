import { beforeEach, describe, expect, it, vi } from 'vitest'

import { computeBackupChecksum, type AuroraBackupV1 } from '@/lib/backup'
import { createClient } from '@/lib/supabase/server'
import { cloneBackup, createMinimalBackup } from '../fixtures/backup/backup-fixtures'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const userId = '11111111-1111-4111-8111-111111111111'
const tokenId = '77777777-7777-4777-8777-777777777777'

describe('backup restore prepare/restore API routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.ENABLE_BACKUP_RESTORE_REAL = 'true'
  })

  it('prepare resta disabilitato se il feature flag server non è attivo', async () => {
    process.env.ENABLE_BACKUP_RESTORE_REAL = 'false'
    mockSupabase()
    const { POST } = await import('@/app/api/backup/restore/prepare/route')

    const response = await POST(requestFor(validBackup()))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'RESTORE_DISABLED' })
  })

  it('restore resta disabilitato se il feature flag server non è attivo', async () => {
    process.env.ENABLE_BACKUP_RESTORE_REAL = 'false'
    mockSupabase()
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'RESTORE_DISABLED' })
  })

  it('prepare restituisce 401 se non autenticato', async () => {
    mockSupabase({ authenticated: false })
    const { POST } = await import('@/app/api/backup/restore/prepare/route')

    const response = await POST(requestFor(validBackup()))

    expect(response.status).toBe(401)
  })

  it('prepare genera token monouso per backup ready', async () => {
    const { writes } = mockSupabase()
    const { POST } = await import('@/app/api/backup/restore/prepare/route')

    const response = await POST(requestFor(validBackup()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tokenId).toBe(tokenId)
    expect(body.token).toEqual(expect.any(String))
    expect(body.requiredConfirmation).toBe('RIPRISTINA AURORA')
    expect(writes).toEqual(['backup_restore_tokens'])
  })

  it('prepare blocca backup con warning', async () => {
    mockSupabase()
    const backup = validBackup()
    backup.integrity.recordCounts.unknown = 1
    backup.integrity.checksum = computeBackupChecksum(backup)
    const { POST } = await import('@/app/api/backup/restore/prepare/route')

    const response = await POST(requestFor(backup))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('RESTORE_NOT_READY')
  })

  it('restore richiede conferma esatta', async () => {
    mockSupabase()
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup(), { confirmation: 'sbagliata' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'CONFIRMATION_REQUIRED' })
  })

  it('restore blocca token scaduto', async () => {
    mockSupabase({ token: { expires_at: '2000-01-01T00:00:00.000Z' } })
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: 'TOKEN_EXPIRED' })
  })

  it('restore blocca token già usato', async () => {
    mockSupabase({ token: { used_at: '2026-07-17T12:00:00.000Z' } })
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'TOKEN_ALREADY_USED' })
  })

  it('restore chiama una sola RPC atomica quando tutto è valido', async () => {
    const { rpcs, writes } = mockSupabase()
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('completed')
    expect(rpcs).toEqual(['restore_aurora_backup_v1_empty_account'])
    expect(writes).toEqual([])
  })

  it('restore comunica rollback se RPC fallisce', async () => {
    mockSupabase({ rpcError: 'ACCOUNT_NOT_EMPTY' })
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'ACCOUNT_NOT_EMPTY' })
  })

  // ── FASE 8: UUID remapping ────────────────────────────────────────────────

  it('restore cross-account riesce senza UUID_CONFLICT grazie alla rimappatura', async () => {
    // Simula il caso: backup di src-user ripristinato su dst-user (account vuoto).
    // Con UUID remapping nella RPC, gli UUID del backup vengono rigenerati,
    // quindi non ci sono collisioni anche se src-user esiste ancora nel DB.
    const { rpcs } = mockSupabase()
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('completed')
    expect(rpcs).toEqual(['restore_aurora_backup_v1_empty_account'])
  })

  it('restore restituisce reconciledCategories nel risultato', async () => {
    mockSupabase({ rpcResult: { reconciledCategories: 4 } })
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.restore.reconciledCategories).toBe(4)
  })

  it('restore mappa ACCOUNTING_MISMATCH dalla RPC', async () => {
    mockSupabase({ rpcError: 'ACCOUNTING_MISMATCH' })
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'ACCOUNTING_MISMATCH' })
  })

  it('restore mappa RESTORE_ROLLED_BACK per errori RPC sconosciuti', async () => {
    mockSupabase({ rpcError: 'ERROR: duplicate key value violates unique constraint' })
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'RESTORE_ROLLED_BACK' })
  })

  // ── FASE 5D: hardening ────────────────────────────────────────────────────

  it('restore blocca estensione file non json', async () => {
    mockSupabase()
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup(), { filename: 'aurora-backup.csv' }))

    expect(response.status).toBe(415)
    expect(await response.json()).toEqual({ error: 'INVALID_BACKUP_FILE_TYPE' })
  })

  it('restore restituisce TOKEN_INVALID se il checksum del token non corrisponde al backup', async () => {
    mockSupabase({ token: { backup_checksum: 'sha256-wrong-checksum-does-not-match-backup' } })
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'TOKEN_INVALID' })
  })

  it('restore non espone dettagli SQL grezzi nei log di errore RPC', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({ rpcError: 'ERROR: duplicate key value violates unique constraint "accounts_pkey"' })
    const { POST } = await import('@/app/api/backup/restore/route')

    await POST(restoreRequest(validBackup()))

    const logged = consoleSpy.mock.calls.flat().map(String).join(' ')
    expect(logged).not.toContain('accounts_pkey')
    expect(logged).not.toContain('duplicate key')
    consoleSpy.mockRestore()
  })

  it('restore include conteggi completi e categorie riconciliate nel risultato', async () => {
    mockSupabase({
      rpcResult: {
        counts: { accounts: 3, categories: 12, transactions: 150, budgets: 5 },
        reconciledCategories: 4,
      },
    })
    const { POST } = await import('@/app/api/backup/restore/route')

    const response = await POST(restoreRequest(validBackup()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.restore.counts.accounts).toBe(3)
    expect(body.restore.counts.transactions).toBe(150)
    expect(body.restore.reconciledCategories).toBe(4)
  })
})

function validBackup(): AuroraBackupV1 {
  const backup = cloneBackup(createMinimalBackup())
  backup.integrity.checksum = computeBackupChecksum(backup)
  return backup
}

function requestFor(payload: unknown) {
  return new Request('http://localhost/api/backup/restore/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'aurora-backup.json', content: JSON.stringify(payload) }),
  })
}

function restoreRequest(payload: unknown, overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/backup/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'aurora-backup.json',
      content: JSON.stringify(payload),
      tokenId,
      token: 'secret-restore-token-with-enough-length',
      confirmation: 'RIPRISTINA AURORA',
      ...overrides,
    }),
  })
}

function mockSupabase(options: {
  authenticated?: boolean
  token?: Record<string, unknown>
  rpcError?: string
  rpcResult?: Record<string, unknown>
} = {}) {
  const writes: string[] = []
  const rpcs: string[] = []
  const backup = validBackup()
  const token = {
    id: tokenId,
    backup_checksum: backup.integrity.checksum,
    schema_version: 1,
    mode: 'empty_account_restore',
    readiness: 'ready',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used_at: null,
    ...options.token,
  }

  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.authenticated === false ? null : { id: userId, email: 'luca@example.test' },
        },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        insert: vi.fn(() => {
          writes.push(table)
          return builder
        }),
        single: vi.fn(() => Promise.resolve({ data: { id: tokenId, expires_at: token.expires_at }, error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({
          data: table === 'backup_restore_tokens' ? token : null,
          error: null,
        })),
        order: vi.fn(() => builder),
        then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
      }
      return builder
    }),
    rpc: vi.fn((name: string) => {
      rpcs.push(name)
      if (options.rpcError) {
        return Promise.resolve({ data: null, error: { message: options.rpcError } })
      }
      return Promise.resolve({
        data: {
          restoreId: '88888888-8888-4888-8888-888888888888',
          status: 'completed',
          counts: { accounts: 1, transactions: 0 },
          reconciledCategories: 0,
          verified: true,
          ...options.rpcResult,
        },
        error: null,
      })
    }),
  } as never)

  return { writes, rpcs }
}
