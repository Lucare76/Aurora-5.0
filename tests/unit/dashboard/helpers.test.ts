import { describe, expect, it } from 'vitest'
import { componentLabel, componentStatusLabel, dashboardPeriodToMonth, dedupeByTitle, formatPercent, formatTrendLabel, orderedWidgetIds, periodLabel, pickTopFactors, scoreHistorySeries, trendTone } from '@/lib/dashboard/helpers'

describe('dashboard helpers', () => {
  it('maps supported dashboard periods to Financial Health month keys', () => {
    const now = new Date(2026, 6, 15)
    expect(dashboardPeriodToMonth('current_month', now)).toBe('2026-07')
    expect(dashboardPeriodToMonth('previous_month', now)).toBe('2026-06')
    expect(periodLabel('current_month')).toBe('Mese corrente')
    expect(periodLabel('previous_month')).toBe('Mese precedente')
  })

  it('formats percentages with safe unavailable state', () => {
    expect(formatPercent(null)).toBe('n.d.')
    expect(formatPercent(12.345)).toBe('12,3%')
    expect(formatPercent(5, { signed: true })).toBe('+5%')
  })

  it('formats trend labels without leaking raw metric details', () => {
    expect(formatTrendLabel()).toBe('Confronto non disponibile')
    expect(formatTrendLabel({
      metric: 'monthlyIncome',
      direction: 'STABLE',
      interpretation: 'neutral',
      currentValue: 100,
      previousValue: 100,
      absoluteChange: 0,
      percentageChange: 0,
    })).toBe('Stabile rispetto al periodo precedente')
    expect(formatTrendLabel({
      metric: 'monthlyExpenses',
      direction: 'DOWN',
      interpretation: 'positive',
      currentValue: 90,
      previousValue: 100,
      absoluteChange: -10,
      percentageChange: -10,
    })).toContain('In diminuzione')
    expect(formatTrendLabel({
      metric: 'monthlyIncome',
      direction: 'UP',
      interpretation: 'positive',
      currentValue: 110,
      previousValue: 100,
      absoluteChange: 10,
      percentageChange: 10,
    })).toContain('In aumento')
  })

  it('maps trend tone from interpretation', () => {
    expect(trendTone({ metric: 'monthlyExpenses', direction: 'UP', interpretation: 'negative', currentValue: 2, previousValue: 1, absoluteChange: 1, percentageChange: 100 })).toBe('negative')
    expect(trendTone({ metric: 'monthlyIncome', direction: 'UP', interpretation: 'positive', currentValue: 2, previousValue: 1, absoluteChange: 1, percentageChange: 100 })).toBe('positive')
    expect(trendTone()).toBe('neutral')
  })

  it('deduplicates titled lists preserving priority order', () => {
    expect(dedupeByTitle([
      { title: 'Budget superati', value: 1 },
      { title: 'budget superati', value: 2 },
      { title: 'Liquidita', value: 3 },
    ], 3)).toEqual([
      { title: 'Budget superati', value: 1 },
      { title: 'Liquidita', value: 3 },
    ])
  })

  it('labels score components and statuses for the UI', () => {
    expect(componentLabel('liquidity')).toBe('Liquidita')
    expect(componentLabel('alerts')).toBe('Avvisi')
    expect(componentStatusLabel('good')).toBe('In salute')
    expect(componentStatusLabel('watch')).toBe('Da monitorare')
    expect(componentStatusLabel('risk')).toBe('A rischio')
    expect(componentStatusLabel('neutral')).toBe('Neutro')
  })

  it('selects top factors and orders visible widgets', () => {
    const factors = pickTopFactors({
      negativeFactors: [{ id: 'n', title: 'N', description: 'N', impact: 'NEGATIVE', severity: 'WARNING', component: 'alerts' }],
      positiveFactors: [{ id: 'p', title: 'P', description: 'P', impact: 'POSITIVE', severity: 'INFO', component: 'liquidity' }],
      neutralFactors: [{ id: 'u', title: 'U', description: 'U', impact: 'NEUTRAL', severity: 'INFO', component: 'goals' }],
    } as never, 2)

    expect(factors.map((factor) => factor.id)).toEqual(['n', 'p'])
    expect(orderedWidgetIds(['goals', 'summary', 'cash-flow'], ['summary', 'goals'])).toEqual(['goals', 'summary'])
  })

  it('builds a compact score history series ordered by calculation date', () => {
    const series = scoreHistorySeries([
      { id: '2', period_key: '2026-07', total_score: 70, level: 'GOOD', calculated_at: '2026-07-01T00:00:00.000Z', created_at: '2026-07-01T00:00:00.000Z' },
      { id: '1', period_key: '2026-06', total_score: 60, level: 'FAIR', calculated_at: '2026-06-01T00:00:00.000Z', created_at: '2026-06-01T00:00:00.000Z' },
    ])
    expect(series).toEqual([{ label: '2026-06', score: 60 }, { label: '2026-07', score: 70 }])
  })
})
