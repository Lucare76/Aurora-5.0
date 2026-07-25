import { describe, expect, it } from 'vitest'
import {
  buildAgendaGroups,
  buildConfidence,
  buildFinancialCalendarPeriod,
  buildInsights,
  computeCalendarForecast,
  generateBudgetEvents,
  generateGoalEvents,
  generateLoanEvents,
  generateRecurringEvents,
} from '@/lib/financial-calendar/calculations'
import type { CalendarAccountInput, CalendarCategoryInput, CalendarRecurringInput, FinancialCalendarEvent } from '@/lib/financial-calendar/types'

const accounts: CalendarAccountInput[] = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Banca', type: 'checking', balance: 1000, currency: 'EUR', is_active: true, is_hidden: false },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'Risparmio', type: 'savings', balance: 500, currency: 'EUR', is_active: true, is_hidden: false },
]

const categories: CalendarCategoryInput[] = [
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', name: 'Stipendio', type: 'income', icon: '💰', parent_id: null },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', name: 'Casa', type: 'expense', icon: '🏠', parent_id: null },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', name: 'Affitto', type: 'expense', icon: '🔑', parent_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' },
]

function rule(overrides: Partial<CalendarRecurringInput>): CalendarRecurringInput {
  return {
    id: 'rule-1',
    account_id: accounts[0].id,
    category_id: categories[2].id,
    type: 'expense',
    amount: 100,
    description: 'Affitto',
    frequency: 'monthly',
    start_date: '2026-01-31',
    end_date: null,
    next_due_date: '2026-01-31',
    last_run_date: null,
    is_active: true,
    auto_create: true,
    ...overrides,
  }
}

describe('financial calendar calculations', () => {
  it('genera ricorrenze giornaliere, settimanali, mensili e annuali nel periodo', () => {
    const period = buildFinancialCalendarPeriod('2026-07-01', '2026-07-31')
    const events = generateRecurringEvents({
      rules: [
        rule({ id: 'daily', frequency: 'daily', next_due_date: '2026-07-01' }),
        rule({ id: 'weekly', frequency: 'weekly', next_due_date: '2026-07-03' }),
        rule({ id: 'monthly', frequency: 'monthly', next_due_date: '2026-07-15' }),
        rule({ id: 'yearly', frequency: 'yearly', next_due_date: '2026-07-20' }),
      ],
      accounts,
      categories,
      period,
      today: '2026-07-01',
    })
    expect(events.some((event) => event.id.startsWith('recurring:daily'))).toBe(true)
    expect(events.some((event) => event.id.startsWith('recurring:weekly'))).toBe(true)
    expect(events.some((event) => event.id.startsWith('recurring:monthly'))).toBe(true)
    expect(events.some((event) => event.id.startsWith('recurring:yearly'))).toBe(true)
  })

  it('rispetta fine ricorrenza e ricorrenza sospesa', () => {
    const period = buildFinancialCalendarPeriod('2026-07-01', '2026-07-31')
    const events = generateRecurringEvents({
      rules: [
        rule({ id: 'ended', next_due_date: '2026-07-10', end_date: '2026-07-05' }),
        rule({ id: 'paused', next_due_date: '2026-07-10', is_active: false }),
      ],
      accounts,
      categories,
      period,
      today: '2026-07-01',
    })
    expect(events).toEqual([])
  })

  it('gestisce mese corto per ricorrenza al 31', () => {
    const period = buildFinancialCalendarPeriod('2026-02-01', '2026-03-31')
    const events = generateRecurringEvents({
      rules: [rule({ id: 'month-end', next_due_date: '2026-01-31', frequency: 'monthly' })],
      accounts,
      categories,
      period,
      today: '2026-02-01',
    })
    expect(events.map((event) => event.date)).toContain('2026-02-28')
  })

  it('crea scadenze prestiti senza inventare un piano rateale', () => {
    const events = generateLoanEvents({
      loans: [{ id: 'loan-1', counterpart: 'Luca', type: 'received', amount: 500, remaining: 200, description: null, due_date: '2026-07-15', is_settled: false }],
      period: buildFinancialCalendarPeriod('2026-07-01', '2026-07-31'),
      today: '2026-07-01',
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ direction: 'EXPENSE', amount: 200, metadata: { plan: 'Scadenza generale; piano rateale non disponibile' } })
  })

  it('crea eventi obiettivo solo quando la target_date esiste e l’obiettivo non è completato', () => {
    const events = generateGoalEvents({
      goals: [
        { id: 'goal-1', name: 'Viaggio', target_amount: 1000, current_amount: 400, target_date: '2026-07-20', status: 'ACTIVE', archived: false },
        { id: 'goal-2', name: 'Completo', target_amount: 1000, current_amount: 1000, target_date: '2026-07-20', status: 'COMPLETED', archived: false },
      ],
      period: buildFinancialCalendarPeriod('2026-07-01', '2026-07-31'),
      today: '2026-07-01',
    })
    expect(events).toHaveLength(1)
    expect(events[0].metadata.remainingAmount).toBe(600)
  })

  it('crea scadenza budget con residuo calcolato da movimenti reali', () => {
    const events = generateBudgetEvents({
      budgets: [{ id: 'budget-1', category_id: categories[2].id, amount: 700, month: 7, year: 2026 }],
      categories,
      transactions: [{ id: 'tx-1', account_id: accounts[0].id, category_id: categories[2].id, type: 'expense', amount: 500, description: 'Affitto', date: '2026-07-10', transfer_peer_id: null, recurring_id: null }],
      period: buildFinancialCalendarPeriod('2026-07-01', '2026-07-31'),
      today: '2026-07-01',
    })
    expect(events[0].metadata.remaining).toBe(200)
  })

  it('calcola saldo previsionale, soglia e criticità', () => {
    const period = buildFinancialCalendarPeriod('2026-07-01', '2026-07-03')
    const events: FinancialCalendarEvent[] = [
      { id: 'e1', sourceId: 'e1', sourceType: 'RECURRING', eventType: 'EXPECTED_INCOME', title: 'Entrata', description: null, date: '2026-07-01', amount: 200, direction: 'INCOME', accountId: accounts[0].id, accountName: 'Banca', categoryId: null, categoryName: null, status: 'EXPECTED', confidence: 'HIGH', href: '/recurring', metadata: {} },
      { id: 'e2', sourceId: 'e2', sourceType: 'RECURRING', eventType: 'EXPECTED_EXPENSE', title: 'Uscita', description: null, date: '2026-07-02', amount: 1500, direction: 'EXPENSE', accountId: accounts[0].id, accountName: 'Banca', categoryId: null, categoryName: null, status: 'EXPECTED', confidence: 'HIGH', href: '/recurring', metadata: {} },
      { id: 'e3', sourceId: 'e3', sourceType: 'BUDGET', eventType: 'BUDGET_DEADLINE', title: 'Info', description: null, date: '2026-07-02', amount: 999, direction: 'NEUTRAL', accountId: null, accountName: null, categoryId: null, categoryName: null, status: 'INFORMATIONAL', confidence: 'NOT_APPLICABLE', href: '/budgets', metadata: {} },
    ]
    const forecast = computeCalendarForecast({ accounts, events, period, threshold: 100, today: '2026-07-01', month: '2026-07' })
    expect(forecast.summary.openingBalance).toBe(1500)
    expect(forecast.summary.projectedIncome).toBe(200)
    expect(forecast.summary.projectedExpenses).toBe(1500)
    expect(forecast.summary.projectedClosingBalance).toBe(200)
    expect(forecast.criticalDays.some((day) => day.type === 'LARGE_EXPENSE')).toBe(true)
  })

  it('per un mese futuro include eventi ponte prima del periodo nel saldo iniziale', () => {
    const period = buildFinancialCalendarPeriod('2026-08-01', '2026-08-02')
    const events: FinancialCalendarEvent[] = [
      { id: 'bridge', sourceId: 'bridge', sourceType: 'RECURRING', eventType: 'EXPECTED_EXPENSE', title: 'Uscita luglio', description: null, date: '2026-07-28', amount: 300, direction: 'EXPENSE', accountId: accounts[0].id, accountName: 'Banca', categoryId: null, categoryName: null, status: 'EXPECTED', confidence: 'HIGH', href: '/recurring', metadata: {} },
      { id: 'august', sourceId: 'august', sourceType: 'RECURRING', eventType: 'EXPECTED_INCOME', title: 'Entrata agosto', description: null, date: '2026-08-01', amount: 100, direction: 'INCOME', accountId: accounts[0].id, accountName: 'Banca', categoryId: null, categoryName: null, status: 'EXPECTED', confidence: 'HIGH', href: '/recurring', metadata: {} },
    ]
    const forecast = computeCalendarForecast({ accounts, events, period, threshold: 0, today: '2026-07-25', month: '2026-08' })
    expect(forecast.summary.openingBalance).toBe(1200)
    expect(forecast.summary.projectedClosingBalance).toBe(1300)
  })

  it('calcola affidabilità alta, media e bassa da dati incompleti', () => {
    const complete: FinancialCalendarEvent = { id: 'ok', sourceId: 'ok', sourceType: 'RECURRING', eventType: 'EXPECTED_INCOME', title: 'Ok', description: null, date: '2026-07-01', amount: 10, direction: 'INCOME', accountId: accounts[0].id, accountName: 'Banca', categoryId: null, categoryName: null, status: 'EXPECTED', confidence: 'HIGH', href: '/recurring', metadata: {} }
    const missingAccount = { ...complete, id: 'missing-account', accountId: null }
    const missingAmount = { ...complete, id: 'missing-amount', amount: null }
    expect(buildConfidence([complete]).forecastConfidence).toBe('HIGH')
    expect(buildConfidence([complete, missingAccount]).forecastConfidence).toBe('MEDIUM')
    expect(buildConfidence([missingAccount, missingAmount]).forecastConfidence).toBe('LOW')
  })

  it('raggruppa agenda e limita insight a massimo 5 senza duplicati', () => {
    const forecast = computeCalendarForecast({ accounts, events: [], period: buildFinancialCalendarPeriod('2026-07-01', '2026-07-05'), threshold: 0, today: '2026-07-01', month: '2026-07' })
    expect(buildAgendaGroups(forecast.calendarDays, '2026-07-01')).toEqual([])
    const confidence = buildConfidence([])
    const insights = buildInsights({ events: [], criticalDays: forecast.criticalDays, summary: forecast.summary, confidence })
    expect(insights.length).toBeLessThanOrEqual(5)
    expect(new Set(insights.map((item) => item.type)).size).toBe(insights.length)
  })
})
