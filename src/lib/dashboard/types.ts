import type { FinancialHealthResult } from '@/lib/financial-health/types'

export type DashboardPeriodKey = 'current_month' | 'previous_month'

export type DashboardWidgetId =
  | 'summary'
  | 'financial-health'
  | 'data-integrity'
  | 'score-components'
  | 'projected-balance'
  | 'cash-flow'
  | 'expense-coverage'
  | 'budgets'
  | 'deadlines'
  | 'loans'
  | 'goals'
  | 'recommendations'
  | 'priority-alerts'
  | 'score-history'
  | 'scenarios'

export type DashboardWidgetDefinition = {
  id: DashboardWidgetId
  label: string
  description: string
  defaultVisible: boolean
  defaultOrder: number
  minimumData: string
  mobilePriority: number
  href?: string
}

export type DashboardPreferences = {
  visibleWidgets: DashboardWidgetId[]
  widgetOrder: DashboardWidgetId[]
  compactMode: boolean
  defaultPeriod: DashboardPeriodKey
}

export type DashboardPreferencesRow = {
  user_id: string
  visible_widgets: DashboardWidgetId[] | unknown
  widget_order: DashboardWidgetId[] | unknown
  compact_mode: boolean | null
  default_period: string | null
  created_at?: string
  updated_at?: string
}

export type FinancialHealthSnapshotSummary = {
  id: string
  total_score: number | null
  level: string
  period_key: string
  calculated_at: string
  created_at: string
}

export type DataIntegrityDashboardSummary = {
  latestScanAt: string | null
  critical: number
  warning: number
  statusLabel: string
  issues: Array<{
    id?: string
    title: string
    severity: 'CRITICAL' | 'WARNING' | 'INFO'
    category: string
    sourcePath?: string
  }>
}

export type DashboardPayload = FinancialHealthResult
