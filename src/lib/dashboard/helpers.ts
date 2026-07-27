import type { ComponentScore, FinancialHealthResult, HealthFactor, HealthTrend } from '@/lib/financial-health/types'
import type { DashboardPeriodKey, DashboardWidgetId, FinancialHealthSnapshotSummary } from './types'

export function dashboardPeriodToMonth(period: DashboardPeriodKey, now = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'previous_month') date.setMonth(date.getMonth() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function periodLabel(period: DashboardPeriodKey): string {
  return period === 'previous_month' ? 'Mese precedente' : 'Mese corrente'
}

export function formatPercent(value: number | null | undefined, options: { signed?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n.d.'
  const prefix = options.signed && value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`
}

export function formatTrendLabel(trend?: HealthTrend): string {
  if (!trend || trend.direction === 'UNAVAILABLE' || trend.percentageChange === null) return 'Confronto non disponibile'
  if (trend.direction === 'STABLE') return 'Stabile rispetto al periodo precedente'
  return `${trend.direction === 'UP' ? 'In aumento' : 'In diminuzione'} di ${formatPercent(Math.abs(trend.percentageChange))}`
}

export function trendTone(trend?: HealthTrend): 'positive' | 'negative' | 'neutral' {
  if (!trend || trend.interpretation === 'unavailable') return 'neutral'
  if (trend.interpretation === 'positive') return 'positive'
  if (trend.interpretation === 'negative') return 'negative'
  return 'neutral'
}

export function pickTopFactors(result: FinancialHealthResult, limit = 3): HealthFactor[] {
  return [...result.negativeFactors, ...result.positiveFactors, ...result.neutralFactors].slice(0, limit)
}

export function componentLabel(component: ComponentScore['component']): string {
  const labels: Record<ComponentScore['component'], string> = {
    liquidity: 'Liquidita',
    savings: 'Risparmio',
    budgets: 'Budget',
    debt: 'Debiti',
    deadlines: 'Scadenze',
    goals: 'Obiettivi',
    alerts: 'Avvisi',
  }
  return labels[component]
}

export function componentStatusLabel(status: ComponentScore['status']): string {
  if (status === 'good') return 'In salute'
  if (status === 'watch') return 'Da monitorare'
  if (status === 'risk') return 'A rischio'
  return 'Neutro'
}

export function dedupeByTitle<T extends { title: string }>(items: T[], limit: number): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const key = item.title.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
    if (result.length >= limit) break
  }
  return result
}

export function scoreHistorySeries(snapshots: FinancialHealthSnapshotSummary[]) {
  return snapshots
    .slice()
    .sort((a, b) => a.calculated_at.localeCompare(b.calculated_at))
    .slice(-12)
    .map((snapshot) => ({
      label: snapshot.period_key,
      score: snapshot.total_score,
    }))
}

export function orderedWidgetIds(order: DashboardWidgetId[], visible: DashboardWidgetId[]) {
  const visibleSet = new Set(visible)
  return order.filter((id) => visibleSet.has(id))
}
