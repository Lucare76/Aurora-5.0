import type { AuroraBackupV1 } from '@/lib/backup'

export const ids = {
  user: '00000000-0000-4000-8000-000000000001',
  account: '10000000-0000-4000-8000-000000000001',
  savings: '10000000-0000-4000-8000-000000000002',
  categoryIncome: '20000000-0000-4000-8000-000000000001',
  categoryExpense: '20000000-0000-4000-8000-000000000002',
  categoryChild: '20000000-0000-4000-8000-000000000003',
  transaction: '30000000-0000-4000-8000-000000000001',
  transfer: '30000000-0000-4000-8000-000000000002',
  budget: '40000000-0000-4000-8000-000000000001',
  recurring: '50000000-0000-4000-8000-000000000001',
  loan: '60000000-0000-4000-8000-000000000001',
  payment: '70000000-0000-4000-8000-000000000001',
  birthday: '80000000-0000-4000-8000-000000000001',
  reminder: '90000000-0000-4000-8000-000000000001',
  audit: 'a0000000-0000-4000-8000-000000000001',
}

export function createMinimalBackup(overrides: Partial<AuroraBackupV1> = {}): AuroraBackupV1 {
  const backup: AuroraBackupV1 = {
    format: 'aurora-backup',
    schemaVersion: 1,
    appVersion: '5.0.0',
    createdAt: '2026-07-17T12:00:00.000Z',
    exportedBy: {
      userId: ids.user,
      displayName: 'Demo',
      emailHash: 'sha256:demo',
    },
    defaultCurrency: 'EUR',
    metadata: {
      source: 'test',
      locale: 'it-IT',
      timezone: 'Europe/Rome',
    },
    data: {
      profile: {
        currency: 'EUR',
        locale: 'it-IT',
        timezone: 'Europe/Rome',
        onboarding_done: true,
      },
      accounts: [
        {
          id: ids.account,
          user_id: ids.user,
          name: 'Conto demo',
          type: 'checking',
          balance: 1000,
          currency: 'EUR',
          is_active: true,
          is_hidden: false,
          sort_order: 0,
        },
      ],
      categories: [
        {
          id: ids.categoryIncome,
          user_id: ids.user,
          name: 'Stipendio',
          type: 'income',
          parent_id: null,
          is_default: true,
          sort_order: 1,
        },
      ],
      transactions: [],
      budgets: [],
      recurringRules: [],
      loans: [],
      loanPayments: [],
      birthdays: [],
      birthdayReminderLog: [],
      auditLogs: [],
    },
    integrity: {
      recordCounts: {
        accounts: 1,
        categories: 1,
        transactions: 0,
        budgets: 0,
        recurringRules: 0,
        loans: 0,
        loanPayments: 0,
        birthdays: 0,
        birthdayReminderLog: 0,
        auditLogs: 0,
      },
      checksum: null,
    },
  }
  return deepMerge(backup, overrides) as AuroraBackupV1
}

export function createCompleteBackup(): AuroraBackupV1 {
  return createMinimalBackup({
    data: {
      ...createMinimalBackup().data,
      accounts: [
        ...createMinimalBackup().data.accounts,
        {
          id: ids.savings,
          user_id: ids.user,
          name: 'Risparmio',
          type: 'savings',
          balance: 500,
          currency: 'EUR',
          is_active: true,
          is_hidden: false,
          sort_order: 1,
        },
      ],
      categories: [
        ...createMinimalBackup().data.categories,
        {
          id: ids.categoryExpense,
          user_id: ids.user,
          name: 'Casa',
          type: 'expense',
          parent_id: null,
          is_default: false,
          sort_order: 2,
        },
        {
          id: ids.categoryChild,
          user_id: ids.user,
          name: 'Affitto',
          type: 'expense',
          parent_id: ids.categoryExpense,
          is_default: false,
          sort_order: 3,
        },
      ],
      transactions: [
        {
          id: ids.transaction,
          user_id: ids.user,
          account_id: ids.account,
          category_id: ids.categoryIncome,
          type: 'income',
          amount: 1000,
          description: 'Entrata demo',
          notes: null,
          date: '2026-07-01',
          transfer_peer_id: null,
        },
        {
          id: ids.transfer,
          user_id: ids.user,
          account_id: ids.account,
          category_id: null,
          type: 'transfer',
          amount: 100,
          date: '2026-07-02',
          transfer_peer_id: ids.savings,
        },
      ],
      budgets: [{
        id: ids.budget,
        user_id: ids.user,
        category_id: ids.categoryExpense,
        amount: 500,
        month: 7,
        year: 2026,
      }],
      recurringRules: [{
        id: ids.recurring,
        user_id: ids.user,
        account_id: ids.account,
        category_id: ids.categoryChild,
        type: 'expense',
        amount: 50,
        description: 'Ricorrenza demo',
        frequency: 'monthly',
        start_date: '2026-07-01',
        end_date: null,
        next_due_date: '2026-08-01',
        last_run_date: null,
        is_active: true,
        auto_create: false,
      }],
      loans: [{
        id: ids.loan,
        user_id: ids.user,
        counterpart: 'Persona demo',
        type: 'given',
        amount: 200,
        remaining: 150,
        description: null,
        due_date: '2026-12-31',
        is_settled: false,
      }],
      loanPayments: [{
        id: ids.payment,
        user_id: ids.user,
        loan_id: ids.loan,
        amount: 50,
        paid_at: '2026-07-10T12:00:00.000Z',
        notes: null,
      }],
      birthdays: [{
        id: ids.birthday,
        user_id: ids.user,
        name: 'Compleanno demo',
        birth_date: '1990-07-17',
        reminder_days: [7],
        notes: null,
      }],
      birthdayReminderLog: [{
        id: ids.reminder,
        user_id: ids.user,
        birthday_id: ids.birthday,
        days_before: 7,
        year: 2026,
        sent_at: '2026-07-10T12:00:00.000Z',
      }],
      auditLogs: [{
        id: ids.audit,
        user_id: ids.user,
        action: 'CREATE',
        table_name: 'accounts',
        record_id: ids.account,
        old_data: null,
        new_data: null,
        created_at: '2026-07-17T12:00:00.000Z',
      }],
    },
    integrity: {
      recordCounts: {
        accounts: 2,
        categories: 3,
        transactions: 2,
        budgets: 1,
        recurringRules: 1,
        loans: 1,
        loanPayments: 1,
        birthdays: 1,
        birthdayReminderLog: 1,
        auditLogs: 1,
      },
      checksum: null,
    },
  })
}

export function cloneBackup<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function deepMerge(base: unknown, overrides: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(overrides)) return overrides ?? base
  const output: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    output[key] = key in output ? deepMerge(output[key], value) : value
  }
  return output
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
