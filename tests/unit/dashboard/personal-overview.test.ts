import { beforeEach, describe, expect, it } from 'vitest'
import { buildPersonalOverviewViewModel, type PersonalOverviewPayload } from '@/lib/dashboard/personal-overview'

const privateEmail = 'luca@example.test'
const now = new Date('2026-07-15T10:00:00.000Z')

describe('personal overview dashboard view model', () => {
  beforeEach(() => {
    delete process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL
    delete process.env.PRIVATE_HR_ACCOUNT_EMAIL
  })

  it('mostra empty state quando non ci sono elementi urgenti', () => {
    const payload = buildOverview()

    expect(payload.attention.items).toEqual([])
    expect(payload.todaySection.emptyMessage).toBe('Nulla richiede attenzione oggi.')
    expect(payload.financial.netWorth).toBe(1000)
  })

  it('porta deadline scadute e di oggi nelle priorità e nella sezione oggi', () => {
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = privateEmail
    const payload = buildOverview({
      userEmail: privateEmail,
      deadlines: [
        deadline('d-overdue', 'Assicurazione auto', '2026-07-10'),
        deadline('d-today', 'Visita medica', '2026-07-15'),
      ],
    })

    expect(payload.attention.items.map((item) => item.title)).toEqual(['Assicurazione auto', 'Visita medica'])
    expect(payload.todaySection.items.map((item) => item.title)).toEqual(['Assicurazione auto', 'Visita medica'])
    expect(payload.month.metrics.deadlines?.overdue).toBe(1)
    expect(payload.month.metrics.deadlines?.today).toBe(1)
  })

  it('mette le deadline della settimana nella sezione Questa settimana', () => {
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = privateEmail
    const payload = buildOverview({
      userEmail: privateEmail,
      deadlines: [deadline('d-week', 'Bollo auto', '2026-07-20')],
    })

    expect(payload.week.items).toHaveLength(1)
    expect(payload.week.items[0].title).toBe('Bollo auto')
    expect(payload.month.metrics.deadlines?.next7).toBe(1)
  })

  it('ordina Data Integrity Critical prima dei warning e limita a 5 elementi', () => {
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = privateEmail
    const payload = buildOverview({
      userEmail: privateEmail,
      dataIntegrity: { critical: 2, warning: 1 },
      deadlines: [
        deadline('d1', 'Scadenza 1', '2026-07-14'),
        deadline('d2', 'Scadenza 2', '2026-07-15'),
        deadline('d3', 'Scadenza 3', '2026-07-16'),
        deadline('d4', 'Scadenza 4', '2026-07-17'),
      ],
      budgetRisks: [
        { categoryName: 'Ristoranti', percentage: 110, status: 'exceeded' },
        { categoryName: 'Casa', percentage: 92, status: 'critical' },
      ],
    })

    expect(payload.attention.items).toHaveLength(5)
    expect(payload.attention.items[0].source).toBe('data-integrity')
    expect(payload.attention.items[0].tone).toBe('critical')
  })

  it('usa il summary globale Data Integrity anche quando la lista visuale e limitata', () => {
    const payload = buildOverview({
      dataIntegrity: { critical: 0, warning: 8, info: 1 },
    })

    expect(payload.attention.items.find((item) => item.id === 'data-integrity-warning')?.description).toBe('8 segnalazioni warning aperte.')
    expect(payload.attention.items).toHaveLength(1)
  })

  it('riassume permessi quasi esauriti e ferie residue senza duplicare formule', () => {
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = privateEmail
    const payload = buildOverview({
      userEmail: privateEmail,
      leave: {
        entries: [],
        vacationAllowance: 26,
        vacationUsed: 10,
        vacationRemaining: 16,
        permitAllowance: 12,
        permitUsed: 10,
        permitRemaining: 2,
        permitUsagePercentage: 83.33,
      },
    })

    expect(payload.month.metrics.leave?.vacationRemaining).toBe(16)
    expect(payload.month.metrics.leave?.permitRemaining).toBe(2)
    expect(payload.attention.items.some((item) => item.source === 'leave')).toBe(true)
  })

  it('esclude sezioni private per utente non autorizzato', () => {
    process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = privateEmail
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = privateEmail
    const payload = buildOverview({ userEmail: 'other@example.test' })

    expect(payload.access.privateFinance).toBe(false)
    expect(payload.access.privateHr).toBe(false)
    expect(payload.sections.privateFinance).toBe('HIDDEN')
    expect(payload.sections.deadlines).toBe('HIDDEN')
    expect(payload.privateCards.aurora).toBeUndefined()
    expect(payload.privateCards.adi).toBeUndefined()
  })

  it('mantiene Aurora e ADI separati dal patrimonio personale', () => {
    process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = privateEmail
    const payload = buildOverview({
      userEmail: privateEmail,
      aurora: { balance: 5000, activeAccounts: 2 },
      adi: { balance: 300, received: 1000, spent: 700 },
    })

    expect(payload.financial.netWorth).toBe(1000)
    expect(payload.privateCards.aurora?.balance).toBe(5000)
    expect(payload.privateCards.adi?.balance).toBe(300)
  })

  it('segnala una sezione non disponibile senza bloccare il payload', () => {
    const payload = buildOverview({ unavailable: { deadlines: true } })

    expect(payload.sections.deadlines).toBe('UNAVAILABLE')
    expect(payload.financial.status).toBe('OK')
  })

  it('rispetta il boundary date-only per oggi', () => {
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = privateEmail
    const payload = buildOverview({
      userEmail: privateEmail,
      deadlines: [deadline('date-only', 'Passaporto', '2026-07-15')],
    })

    expect(payload.today).toBe('2026-07-15')
    expect(payload.month.metrics.deadlines?.today).toBe(1)
  })

  it('include notifiche importanti e warning Financial Health nelle priorità', () => {
    const payload = buildOverview({
      notifications: [
        { id: 'n1', title: 'Backup da controllare', severity: 'CRITICAL', created_at: '2026-07-15T10:00:00.000Z', source_url: '/notifications' },
      ],
      healthWarnings: ['Margine mensile negativo.'],
    })

    expect(payload.attention.items.some((item) => item.source === 'notification')).toBe(true)
    expect(payload.attention.items.some((item) => item.source === 'financial-health')).toBe(true)
    expect(payload.todaySection.items.some((item) => item.title === 'Backup da controllare')).toBe(true)
  })

  it('mostra ferie in corso oggi e ferie che continuano nella settimana', () => {
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = privateEmail
    const payload = buildOverview({
      userEmail: privateEmail,
      leave: {
        entries: [
          { id: 'vac-today', type: 'VACATION', start_date: '2026-07-14', end_date: '2026-07-16', days: 3, hours: null, note: 'Viaggio' },
          { id: 'vac-week', type: 'VACATION', start_date: '2026-07-10', end_date: '2026-07-18', days: 9, hours: null, note: null },
        ],
        vacationAllowance: 26,
        vacationUsed: 3,
        vacationRemaining: 23,
      },
    })

    expect(payload.todaySection.items.some((item) => item.title === 'Ferie in corso')).toBe(true)
    expect(payload.week.items.some((item) => item.title === 'Ferie')).toBe(true)
  })

  it('usa Financial Health come fallback se il payload dashboard non è disponibile', () => {
    const payload = buildOverview({ withoutFinancialPayload: true })

    expect(payload.financial.netWorth).toBe(1000)
    expect(payload.financial.income).toBe(300)
    expect(payload.financial.expenses).toBe(100)
    expect(payload.financial.balance).toBe(200)
  })
})

function buildOverview(overrides: {
  userEmail?: string
  deadlines?: any[]
  dataIntegrity?: { critical: number; warning: number; info?: number }
  notifications?: Array<{ id: string; title: string; severity: 'CRITICAL' | 'WARNING' | 'INFO'; created_at: string; source_url: string | null }>
  healthWarnings?: string[]
  budgetRisks?: Array<{ categoryName: string; percentage: number; status: 'safe' | 'warning' | 'critical' | 'exceeded' }>
  leave?: Partial<PersonalOverviewPayload['month']['metrics']['leave']> & { entries: any[] }
  aurora?: { balance: number; activeAccounts: number }
  adi?: { balance: number; received: number; spent: number }
  unavailable?: Record<string, true>
  withoutFinancialPayload?: boolean
} = {}) {
  return buildPersonalOverviewViewModel({
    now,
    user: { email: overrides.userEmail ?? 'user@example.test' },
    data: {
      financialPayload: overrides.withoutFinancialPayload ? undefined : {
        netWorth: 1000,
        monthIncome: 300,
        monthExpense: 100,
        monthBalance: 200,
        budgetSummary: {
          totalBudgets: 3,
          atRiskCount: overrides.budgetRisks?.length ?? 0,
          exceededCount: overrides.budgetRisks?.filter((item) => item.status === 'exceeded').length ?? 0,
          topRiskBudgets: overrides.budgetRisks ?? [],
        },
        goalsSummary: { totalGoals: 2, activeGoals: 1, completedGoals: 1, completionPercentage: 50 },
      } as any,
      financialHealth: {
        profile: { displayName: 'Luca' },
        totalScore: 80,
        levelLabel: 'Buona',
        summary: 'Indicatori principali positivi.',
        warnings: overrides.healthWarnings ?? [],
        metrics: {
          currentFinancialPosition: 1000,
          monthlyIncome: 300,
          monthlyExpenses: 100,
          monthlyMargin: 200,
        },
      } as any,
      dataIntegrity: overrides.dataIntegrity ? {
        issues: [],
        summary: {
          critical: overrides.dataIntegrity.critical,
          warning: overrides.dataIntegrity.warning,
          info: overrides.dataIntegrity.info ?? 0,
          total: overrides.dataIntegrity.critical + overrides.dataIntegrity.warning + (overrides.dataIntegrity.info ?? 0),
          open: overrides.dataIntegrity.critical + overrides.dataIntegrity.warning + (overrides.dataIntegrity.info ?? 0),
          acknowledged: 0,
          ignored: 0,
          resolved: 0,
          stale: 0,
          statusLabel: overrides.dataIntegrity.critical > 0 ? 'Attenzione urgente' : overrides.dataIntegrity.warning > 0 ? 'Da controllare' : 'Buono',
        },
        persistenceAvailable: true,
        latestScan: null,
      } as any : undefined,
      notifications: overrides.notifications ?? [],
      deadlines: overrides.deadlines,
      leave: overrides.leave ? {
        settings: {},
        entries: overrides.leave.entries,
        vacationAllowance: overrides.leave.vacationAllowance ?? 0,
        vacationUsed: overrides.leave.vacationUsed ?? 0,
        vacationRemaining: overrides.leave.vacationRemaining ?? 0,
        permitAllowance: overrides.leave.permitAllowance ?? 0,
        permitUsed: overrides.leave.permitUsed ?? 0,
        permitRemaining: overrides.leave.permitRemaining ?? 0,
        permitUsagePercentage: overrides.leave.permitUsagePercentage ?? 0,
      } as any : undefined,
      aurora: overrides.aurora,
      adi: overrides.adi,
      unavailable: overrides.unavailable ?? {},
    },
  })
}

function deadline(id: string, title: string, dueDate: string) {
  return {
    id,
    user_id: 'u1',
    title,
    description: null,
    category: 'DOCUMENT',
    due_date: dueDate,
    status: 'ACTIVE',
    priority: 'NORMAL',
    recurrence: 'NONE',
    reminder_days_before: 7,
    completed_at: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  }
}
