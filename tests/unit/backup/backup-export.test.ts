import { describe, expect, it } from 'vitest'

import {
  createAuroraBackupFilename,
  generateAuroraBackup,
  inspectAuroraBackup,
  mapAccount,
  mapAuditLog,
  mapBirthday,
  mapCategory,
  mapProfile,
  mapTransaction,
  type UserBackupData,
} from '@/lib/backup'
import type {
  Account,
  AuditLog,
  Birthday,
  Category,
  Profile,
  Transaction,
} from '@/types/database'

const userId = '11111111-1111-4111-8111-111111111111'
const accountId = '22222222-2222-4222-8222-222222222222'
const accountTwoId = '22222222-2222-4222-8222-222222222223'
const categoryId = '33333333-3333-4333-8333-333333333333'
const txId = '44444444-4444-4444-8444-444444444444'
const txPeerId = '44444444-4444-4444-8444-444444444445'

describe('Aurora Backup v1 export', () => {
  it('crea filename filesystem-safe e deterministico in UTC', () => {
    const filename = createAuroraBackupFilename(new Date('2026-07-17T15:04:05.000Z'))

    expect(filename).toBe('aurora-backup-v1-2026-07-17-150405.json')
    expect(filename).toMatch(/^[a-z0-9.-]+\.json$/)
  })

  it('mappa profilo null con default sicuri', () => {
    expect(mapProfile(null)).toMatchObject({
      currency: 'EUR',
      locale: 'it-IT',
      timezone: 'Europe/Rome',
      onboarding_done: false,
    })
  })

  it('mappa il profilo senza esportare user_id', () => {
    const mapped = mapProfile(profile())

    expect(mapped).toMatchObject({ id: userId, display_name: 'Luca' })
    expect('user_id' in mapped).toBe(false)
  })

  it('mappa conti, categorie e movimenti senza mutare input e senza user_id', () => {
    const account = accountRow()
    const category = categoryRow()
    const transaction = transactionRow()
    const before = JSON.stringify({ account, category, transaction })

    const mappedAccount = mapAccount(account)
    const mappedCategory = mapCategory(category)
    const mappedTransaction = mapTransaction(transaction)

    expect(JSON.stringify({ account, category, transaction })).toBe(before)
    expect(mappedAccount).toMatchObject({ id: accountId, balance: 120.5 })
    expect(mappedCategory).toMatchObject({ id: categoryId, parent_id: null })
    expect(mappedTransaction).toMatchObject({ id: txId, amount: 42.3, date: '2026-07-17' })
    expect('user_id' in mappedAccount).toBe(false)
    expect('user_id' in mappedCategory).toBe(false)
    expect('user_id' in mappedTransaction).toBe(false)
  })

  it('preserva relazioni transfer e dati ricevuta JSON', () => {
    const mapped = mapTransaction(transactionRow({
      id: txPeerId,
      type: 'transfer',
      category_id: null,
      transfer_peer_id: accountTwoId,
      receipt_data: { provider: 'test' },
    }))

    expect(mapped.transfer_peer_id).toBe(accountTwoId)
    expect(mapped.receipt_data).toEqual({ provider: 'test' })
  })

  it('copia reminder compleanno senza condividere array mutabile', () => {
    const birthday = birthdayRow()
    const mapped = mapBirthday(birthday)

    birthday.reminder_days.push(30)

    expect(mapped.reminder_days).toEqual([1, 7])
  })

  it('mappa audit log escludendo ip_address', () => {
    const mapped = mapAuditLog(auditLogRow())

    expect(mapped).toMatchObject({ action: 'CREATE', table_name: 'transactions' })
    expect('ip_address' in mapped).toBe(false)
  })

  it('genera backup completo valido con record counts e checksum verificati', () => {
    const generated = generateAuroraBackup(userBackupData(), {
      createdAt: new Date('2026-07-17T12:00:00.000Z'),
      appVersion: '5.0.0-test',
    })

    expect(generated.backup.format).toBe('aurora-backup')
    expect(generated.backup.schemaVersion).toBe(1)
    expect(generated.backup.integrity.recordCounts).toMatchObject({
      accounts: 2,
      categories: 1,
      transactions: 1,
      auditLogs: 1,
    })
    expect(generated.backup.integrity.checksum).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(generated.inspection.valid).toBe(true)
  })

  it('serializza JSON leggibile e riapribile senza invalidare checksum', () => {
    const generated = generateAuroraBackup(userBackupData(), {
      createdAt: new Date('2026-07-17T12:00:00.000Z'),
      appVersion: '5.0.0-test',
    })
    const parsed = JSON.parse(generated.json) as unknown

    expect(generated.json).toContain('\n  "format": "aurora-backup"')
    expect(inspectAuroraBackup(parsed).valid).toBe(true)
  })

  it('blocca generazione se una relazione interna rende il backup invalido', () => {
    const data = userBackupData()
    data.transactions[0] = transactionRow({ account_id: '22222222-2222-4222-8222-222222229999' })

    expect(() => generateAuroraBackup(data, { appVersion: '5.0.0-test' })).toThrow(
      'Generated Aurora Backup v1 is invalid.',
    )
  })

  it('consente backup utente autenticato senza dati applicativi', () => {
    const data = userBackupData({
      accounts: [],
      categories: [],
      transactions: [],
      auditLogs: [],
    })

    const generated = generateAuroraBackup(data, { appVersion: '5.0.0-test' })

    expect(generated.inspection.valid).toBe(true)
    expect(generated.backup.integrity.recordCounts.accounts).toBe(0)
  })
})

function userBackupData(overrides: Partial<UserBackupData> = {}): UserBackupData {
  return {
    user: { id: userId, email: 'luca@example.test' },
    profile: profile(),
    accounts: [accountRow(), accountRow({ id: accountTwoId, name: 'Contanti' })],
    categories: [categoryRow()],
    transactions: [transactionRow()],
    budgets: [],
    recurringRules: [],
    loans: [],
    loanPayments: [],
    birthdays: [birthdayRow()],
    birthdayReminderLog: [],
    auditLogs: [auditLogRow()],
    ...overrides,
  }
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: userId,
    display_name: 'Luca',
    avatar_url: null,
    currency: 'EUR',
    locale: 'it-IT',
    timezone: 'Europe/Rome',
    onboarding_done: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function accountRow(overrides: Partial<Account> = {}): Account {
  return {
    id: accountId,
    user_id: userId,
    name: 'Bancoposta',
    type: 'checking',
    color: '#6366f1',
    icon: null,
    balance: 120.5,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function categoryRow(overrides: Partial<Category> = {}): Category {
  return {
    id: categoryId,
    user_id: userId,
    name: 'Casa',
    type: 'expense',
    color: '#ef4444',
    icon: '🏠',
    parent_id: null,
    is_default: true,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function transactionRow(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: txId,
    user_id: userId,
    account_id: accountId,
    category_id: categoryId,
    type: 'expense',
    amount: 42.3,
    description: 'Spesa test',
    notes: null,
    date: '2026-07-17',
    transfer_peer_id: null,
    recurring_id: null,
    receipt_url: null,
    receipt_data: null,
    created_at: '2026-07-17T12:00:00.000Z',
    updated_at: '2026-07-17T12:00:00.000Z',
    ...overrides,
  }
}

function birthdayRow(overrides: Partial<Birthday> = {}): Birthday {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    user_id: userId,
    name: 'Anna',
    birth_date: '1990-05-10',
    reminder_days: [1, 7],
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function auditLogRow(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    user_id: userId,
    action: 'CREATE',
    table_name: 'transactions',
    record_id: txId,
    old_data: null,
    new_data: { id: txId },
    ip_address: '127.0.0.1',
    created_at: '2026-07-17T12:00:00.000Z',
    ...overrides,
  }
}
