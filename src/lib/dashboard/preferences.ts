import { z } from 'zod'
import { DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_REGISTRY, isDashboardWidgetId } from './widget-registry'
import type { DashboardPeriodKey, DashboardPreferences, DashboardPreferencesRow, DashboardWidgetId } from './types'

const PERIODS: DashboardPeriodKey[] = ['current_month', 'previous_month']

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  visibleWidgets: DASHBOARD_WIDGET_REGISTRY.filter((widget) => widget.defaultVisible)
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((widget) => widget.id),
  widgetOrder: DASHBOARD_WIDGET_REGISTRY.slice()
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((widget) => widget.id),
  compactMode: false,
  defaultPeriod: 'current_month',
}

export const dashboardPreferencesInputSchema = z.object({
  visibleWidgets: z.array(z.string()).optional(),
  widgetOrder: z.array(z.string()).optional(),
  compactMode: z.boolean().optional(),
  defaultPeriod: z.enum(PERIODS).optional(),
})

function uniqueKnownWidgets(values: unknown, fallback: DashboardWidgetId[]): DashboardWidgetId[] {
  if (!Array.isArray(values)) return fallback
  const seen = new Set<DashboardWidgetId>()
  const result: DashboardWidgetId[] = []
  for (const value of values) {
    if (!isDashboardWidgetId(value) || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result.length > 0 ? result : fallback
}

type DashboardPreferencesInput = {
  visibleWidgets?: unknown
  widgetOrder?: unknown
  compactMode?: unknown
  defaultPeriod?: unknown
}

export function normalizeDashboardPreferences(input: DashboardPreferencesInput | DashboardPreferencesRow | null | undefined): DashboardPreferences {
  if (!input) return DEFAULT_DASHBOARD_PREFERENCES

  const rawVisible = 'visible_widgets' in input ? input.visible_widgets : input.visibleWidgets
  const rawOrder = 'widget_order' in input ? input.widget_order : input.widgetOrder
  const rawCompact = 'compact_mode' in input ? input.compact_mode : input.compactMode
  const rawPeriod = 'default_period' in input ? input.default_period : input.defaultPeriod

  const visibleWidgets = uniqueKnownWidgets(rawVisible, DEFAULT_DASHBOARD_PREFERENCES.visibleWidgets)
  const orderFromInput = uniqueKnownWidgets(rawOrder, DEFAULT_DASHBOARD_PREFERENCES.widgetOrder)
  const missing = DASHBOARD_WIDGET_IDS.filter((id) => !orderFromInput.includes(id))
  const widgetOrder = [...orderFromInput, ...missing]
  const defaultPeriod = PERIODS.includes(rawPeriod as DashboardPeriodKey) ? rawPeriod as DashboardPeriodKey : DEFAULT_DASHBOARD_PREFERENCES.defaultPeriod

  return {
    visibleWidgets,
    widgetOrder,
    compactMode: Boolean(rawCompact),
    defaultPeriod,
  }
}

export function preferencesToRow(userId: string, preferences: DashboardPreferences) {
  const normalized = normalizeDashboardPreferences(preferences)
  return {
    user_id: userId,
    visible_widgets: normalized.visibleWidgets,
    widget_order: normalized.widgetOrder,
    compact_mode: normalized.compactMode,
    default_period: normalized.defaultPeriod,
  }
}

export function orderVisibleWidgets(preferences: DashboardPreferences): DashboardWidgetId[] {
  const visible = new Set(preferences.visibleWidgets)
  return normalizeDashboardPreferences(preferences).widgetOrder.filter((id) => visible.has(id))
}

export function resetDashboardPreferences(): DashboardPreferences {
  return DEFAULT_DASHBOARD_PREFERENCES
}
