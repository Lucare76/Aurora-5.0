import { beforeEach, describe, expect, it, vi } from 'vitest'

import { computeBackupChecksum, type AuroraBackupV1 } from '@/lib/backup'
import { createClient } from '@/lib/supabase/server'
import { cloneBackup, createMinimalBackup, ids } from '../fixtures/backup/backup-fixtures'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const userId = '11111111-1111-4111-8111-111111111111'

type TableName =
  | 'profiles'
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'budgets'
  | 'recurring_rules'
  | 'loans'
  | 'loan_payments'
  | 'birthdays'
  | 'birthday_reminder_log'
  | 'audit_logs'

type SnapshotData = Record<TableName, unknown[]>

async function importRoute() {
  return import('@/app/api/backup/restore/dry-run/route')
}

describe('backup restore dry-run API route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('restituisce 405 per metodo non supportato', async () => {
    mockSupabase()
    const { GET } = await importRoute()

    const response = await GET()

    expect(response.status).toBe(405)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('restituisce 401 per utente non autenticato', async () => {
    mockSupabase({ authenticated: false })
    const { POST } = await importRoute()

    const response = await POST(requestFor(validBackup()))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Non autenticato' })
  })

  it('rifiuta JSON richiesta malformato', async () => {
    mockSupabase()
    const { POST } = await importRoute()

    const response = await POST(new Request('http://localhost/api/backup/restore/dry-run', {
      method: 'POST',
      body: '{bad-json',
    }))

    expect(response.status).toBe(400)
  })

  it('rifiuta file non JSON', async () => {
    mockSupabase()
    const { POST } = await importRoute()

    const response = await POST(requestFor(validBackup(), { filename: 'backup.txt' }))

    expect(response.status).toBe(415)
  })

  it('rifiuta payload oltre limite', async () => {
    mockSupabase()
    const { POST } = await importRoute()

    const response = await POST(new Request('http://localhost/api/backup/restore/dry-run', {
      method: 'POST',
      body: JSON.stringify({ filename: 'backup.json', content: 'x'.repeat(10 * 1024 * 1024 + 1) }),
    }))

    expect(response.status).toBe(413)
  })

  it('restituisce report blocked per formato errato senza leggere snapshot', async () => {
    const { calls } = mockSupabase()
    const { POST } = await importRoute()

    const response = await POST(requestFor({ format: 'bad' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.readiness).toBe('blocked')
    expect(calls).toEqual([])
  })

  it('restituisce ready per backup valido e snapshot vuoto', async () => {
    const { writes, rpcs } = mockSupabase()
    const { POST } = await importRoute()

    const response = await POST(requestFor(validBackup()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(body.readiness).toBe('ready')
    expect(body.backup.checksumValid).toBe(true)
    expect(body.currentState.isEmpty).toBe(true)
    expect(body.summary.backupRecords).toBeGreaterThan(0)
    expect(writes).toEqual([])
    expect(rpcs).toEqual([])
  })

  it('restituisce blocked se account corrente non è vuoto', async () => {
    mockSupabase({
      snapshot: {
        ...emptySnapshotData(),
        accounts: [{ id: '99999999-9999-4999-8999-999999999999', name: 'Esistente', type: 'checking' }],
      },
    })
    const { POST } = await importRoute()

    const response = await POST(requestFor(validBackup()))
    const body = await response.json()

    expect(body.readiness).toBe('blocked')
    expect(body.currentState.isEmpty).toBe(false)
  })

  it('restituisce blocked per checksum errato', async () => {
    mockSupabase()
    const backup = validBackup()
    backup.integrity.checksum = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    const { POST } = await importRoute()

    const response = await POST(requestFor(backup))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.readiness).toBe('blocked')
    expect(body.summary.blockingErrors).toBeGreaterThan(0)
  })

  it('restituisce 500 se lettura snapshot fallisce senza dettagli tecnici', async () => {
    mockSupabase({ errors: { accounts: 'private db detail' } })
    const { POST } = await importRoute()

    const response = await POST(requestFor(validBackup()))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Non è stato possibile verificare il backup. Nessun dato è stato modificato.',
    })
  })
})

function validBackup(): AuroraBackupV1 {
  const backup = cloneBackup(createMinimalBackup())
  stripUserIds(backup)
  backup.integrity.checksum = computeBackupChecksum(backup)
  return backup
}

function stripUserIds(backup: AuroraBackupV1) {
  delete backup.data.profile.user_id
  for (const collection of [
    backup.data.accounts,
    backup.data.categories,
    backup.data.transactions,
    backup.data.budgets,
    backup.data.recurringRules,
    backup.data.loans,
    backup.data.loanPayments,
    backup.data.birthdays,
    backup.data.birthdayReminderLog,
    backup.data.auditLogs,
  ]) {
    for (const record of collection) {
      delete record.user_id
    }
  }
}

function requestFor(payload: unknown, options: { filename?: string } = {}) {
  return new Request('http://localhost/api/backup/restore/dry-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: options.filename ?? 'aurora-backup-v1.json',
      content: JSON.stringify(payload),
    }),
  })
}

function mockSupabase(options: {
  authenticated?: boolean
  snapshot?: SnapshotData
  errors?: Partial<Record<TableName, string>>
} = {}) {
  const calls: string[] = []
  const writes: string[] = []
  const rpcs: string[] = []
  const snapshot = options.snapshot ?? emptySnapshotData()
  const errors = options.errors ?? {}

  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.authenticated === false ? null : { id: userId, email: 'luca@example.test' },
        },
        error: null,
      }),
    },
    from: vi.fn((table: TableName) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve({
          data: errors[table] ? null : (snapshot[table][0] ?? null),
          error: errors[table] ? { message: errors[table] } : null,
        })),
        insert: vi.fn(() => {
          writes.push(table)
          return builder
        }),
        update: vi.fn(() => {
          writes.push(table)
          return builder
        }),
        delete: vi.fn(() => {
          writes.push(table)
          return builder
        }),
        then: (resolve: (value: unknown) => void) => {
          calls.push(table)
          resolve({
            data: errors[table] ? null : snapshot[table],
            error: errors[table] ? { message: errors[table] } : null,
          })
        },
      }
      return builder
    }),
    rpc: vi.fn((name: string) => {
      rpcs.push(name)
      return Promise.resolve({ data: null, error: null })
    }),
  } as never)

  return { calls, writes, rpcs }
}

function emptySnapshotData(): SnapshotData {
  return {
    profiles: [],
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurring_rules: [],
    loans: [],
    loan_payments: [],
    birthdays: [],
    birthday_reminder_log: [],
    audit_logs: [],
  }
}
