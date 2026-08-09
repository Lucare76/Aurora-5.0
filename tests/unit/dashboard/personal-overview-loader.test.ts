import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDashboardPayload } from '@/lib/dashboard/service'
import { buildFinancialHealthPayload } from '@/lib/financial-health/service'
import { getLatestDataIntegrityScan, listDataIntegrityIssues } from '@/lib/data-integrity/service'
import { buildPersonalOverviewPayload } from '@/lib/dashboard/personal-overview'

vi.mock('@/lib/dashboard/service', () => ({
  buildDashboardPayload: vi.fn(),
}))

vi.mock('@/lib/financial-health/service', () => ({
  buildFinancialHealthPayload: vi.fn(),
}))

vi.mock('@/lib/data-integrity/service', () => ({
  listDataIntegrityIssues: vi.fn(),
  getLatestDataIntegrityScan: vi.fn(),
}))

const buildDashboardPayloadMock = vi.mocked(buildDashboardPayload)
const buildFinancialHealthPayloadMock = vi.mocked(buildFinancialHealthPayload)
const listDataIntegrityIssuesMock = vi.mocked(listDataIntegrityIssues)
const getLatestDataIntegrityScanMock = vi.mocked(getLatestDataIntegrityScan)

describe('buildPersonalOverviewPayload loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = 'luca@example.test'
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = 'luca@example.test'
    buildDashboardPayloadMock.mockResolvedValue(financialPayload() as any)
    buildFinancialHealthPayloadMock.mockResolvedValue(financialHealthPayload() as any)
    listDataIntegrityIssuesMock.mockResolvedValue({
      issues: [],
      summary: { critical: 1, warning: 0, info: 0, total: 1 },
      persistenceAvailable: true,
    } as any)
    getLatestDataIntegrityScanMock.mockResolvedValue(null)
  })

  it('carica sezioni HR e private finance solo per utente autorizzato', async () => {
    const payload = await buildPersonalOverviewPayload(mockSupabase(), { id: 'user-1', email: 'luca@example.test' } as any)

    expect(payload.access.privateFinance).toBe(true)
    expect(payload.access.privateHr).toBe(true)
    expect(payload.sections.deadlines).toBe('OK')
    expect(payload.sections.leave).toBe('OK')
    expect(payload.privateCards.aurora?.balance).toBe(250)
    expect(payload.privateCards.adi?.balance).toBe(70)
    expect(payload.attention.items[0].source).toBe('data-integrity')
  })

  it('non carica dati HR/private finance per utente non autorizzato', async () => {
    const supabase = mockSupabase()
    const payload = await buildPersonalOverviewPayload(supabase, { id: 'user-1', email: 'other@example.test' } as any)

    expect(payload.sections.deadlines).toBe('HIDDEN')
    expect(payload.sections.leave).toBe('HIDDEN')
    expect(payload.sections.privateFinance).toBe('HIDDEN')
    expect(payload.privateCards.aurora).toBeUndefined()
    expect(supabase.from).not.toHaveBeenCalledWith('personal_deadlines')
    expect(supabase.from).not.toHaveBeenCalledWith('adi_entries')
  })

  it('marca partial failure non finanziario senza bloccare la dashboard', async () => {
    const supabase = mockSupabase({ errors: { personal_deadlines: 'relation failed' } })

    const payload = await buildPersonalOverviewPayload(supabase, { id: 'user-1', email: 'luca@example.test' } as any)

    expect(payload.financial.status).toBe('OK')
    expect(payload.sections.deadlines).toBe('UNAVAILABLE')
  })

  it('fallisce solo se entrambe le fonti finanziarie fondamentali non sono disponibili', async () => {
    buildDashboardPayloadMock.mockRejectedValue(new Error('dashboard failed'))
    buildFinancialHealthPayloadMock.mockRejectedValue(new Error('health failed'))

    await expect(buildPersonalOverviewPayload(mockSupabase(), { id: 'user-1', email: 'luca@example.test' } as any)).rejects.toThrow('PERSONAL_OVERVIEW_FINANCIAL_UNAVAILABLE')
  })
})

function mockSupabase(options: { errors?: Record<string, string> } = {}) {
  const tableData: Record<string, unknown[]> = {
    notifications: [{ id: 'n1', title: 'Notifica importante', severity: 'WARNING', created_at: '2026-07-15T10:00:00.000Z', source_url: '/notifications' }],
    personal_deadlines: [deadline()],
    leave_entries: [{ id: 'l1', user_id: 'user-1', type: 'PERMIT_104', start_date: '2026-07-15', end_date: '2026-07-15', days: null, hours: 2, start_time: null, end_time: null, note: null, created_at: '2026-07-15T10:00:00.000Z', updated_at: '2026-07-15T10:00:00.000Z' }],
    accounts: [{ id: 'a1', name: 'Aurora fondo', type: 'savings', balance: 250, currency: 'EUR', is_active: true, color: null, icon: null }],
    account_purpose_links: [{ account_id: 'a1', purpose: 'DEPENDENT_AURORA' }],
    transactions: [{ id: 't1', account_id: 'a1', type: 'income', amount: '20.257', date: '2026-07-15', description: 'Versamento', category_id: null, transfer_peer_id: null }],
    adi_entries: [
      { entry_type: 'credit', adi_category: null, amount: 100, date: '2026-07-01', reference_period: '2026-07' },
      { entry_type: 'debit', adi_category: 'SUPERMERCATO', amount: 30, date: '2026-07-02', reference_period: '2026-07' },
    ],
  }
  const singleData: Record<string, unknown> = {
    leave_settings: { vacation_days_per_year: 26, permit_104_hours_per_month: 12 },
  }
  const supabase = {
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        in: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve({
          data: options.errors?.[table] ? null : singleData[table] ?? null,
          error: options.errors?.[table] ? { message: options.errors[table] } : null,
        })),
        then: (resolve: (value: unknown) => void) => resolve({
          data: options.errors?.[table] ? null : tableData[table] ?? [],
          error: options.errors?.[table] ? { message: options.errors[table] } : null,
        }),
      }
      return builder
    }),
  }
  return supabase as any
}

function deadline() {
  return {
    id: 'd1',
    user_id: 'user-1',
    title: 'Carta identita',
    description: null,
    category: 'DOCUMENT',
    due_date: '2026-07-15',
    status: 'ACTIVE',
    priority: 'NORMAL',
    recurrence: 'NONE',
    reminder_days_before: 7,
    completed_at: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  }
}

function financialPayload() {
  return {
    netWorth: 1000,
    monthIncome: 500,
    monthExpense: 200,
    monthBalance: 300,
    budgetSummary: { totalBudgets: 1, atRiskCount: 0, exceededCount: 0, topRiskBudgets: [] },
    goalsSummary: { totalGoals: 1, activeGoals: 1, completedGoals: 0, completionPercentage: 25 },
  }
}

function financialHealthPayload() {
  return {
    profile: { displayName: 'Luca' },
    totalScore: 80,
    levelLabel: 'Buona',
    summary: 'Situazione stabile.',
    warnings: [],
    metrics: {
      currentFinancialPosition: 1000,
      monthlyIncome: 500,
      monthlyExpenses: 200,
      monthlyMargin: 300,
    },
  }
}
