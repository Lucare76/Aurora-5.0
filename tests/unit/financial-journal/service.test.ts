import { describe, expect, it } from 'vitest'
import { buildFinancialTimeline, buildJournalInsights, dashboardInsightTone } from '@/lib/financial-journal/service'
import type { FinancialMonthClosure } from '@/lib/financial-journal/types'

describe('financial journal', () => {
  it('classifies dashboard insights consistently', () => {
    expect(dashboardInsightTone('savings_up')).toBe('POSITIVE')
    expect(dashboardInsightTone('budget_warning')).toBe('WARNING')
    expect(dashboardInsightTone('net_worth_down')).toBe('WARNING')
  })

  it('prioritizes stale investments and meaningful monthly changes', () => {
    const insights = buildJournalInsights({
      dashboardInsights: [],
      staleInvestmentCount: 2,
      savings: 800,
      previousSavings: 500,
      consolidatedNetWorth: 102_000,
      previousNetWorth: 100_000,
    })

    expect(insights.map((item) => item.id)).toEqual([
      'stale-investments',
      'patrimony-vs-last-close',
      'savings-vs-last-close',
    ])
    expect(insights[0].href).toBe('/patrimonio')
  })

  it('builds a reverse chronological financial timeline', () => {
    const closure: FinancialMonthClosure = {
      id: 'close-1',
      period_key: '2026-09',
      period_start: '2026-09-01',
      period_end: '2026-09-30',
      income: 2_000,
      expenses: 1_200,
      savings: 800,
      savings_rate: 40,
      account_net_worth: 90_000,
      consolidated_net_worth: 100_000,
      investment_value: 40_000,
      transaction_count: 20,
      top_expense_category: 'Casa',
      top_expense_amount: 600,
      generated_insights: [],
      closed_at: '2026-09-30T20:00:00.000Z',
    }
    const timeline = buildFinancialTimeline([closure], [
      { id: 'p1', consolidated_value: 99_000, observed_at: '2026-09-10T10:00:00.000Z' },
      { id: 'p2', consolidated_value: 100_000, observed_at: '2026-09-20T10:00:00.000Z' },
    ], [{ date: '2026-09-15', type: 'biggest_expense', label: 'Assicurazione', amount: 400 }])

    expect(timeline.map((event) => event.type)).toEqual(['CLOSURE', 'PATRIMONY', 'EXPENSE'])
    expect(timeline[1].amount).toBe(1000)
  })
})
