import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_PREFERENCES, normalizeDashboardPreferences, orderVisibleWidgets, preferencesToRow, resetDashboardPreferences } from '@/lib/dashboard/preferences'
import { DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_REGISTRY, getDashboardWidget, isDashboardWidgetId } from '@/lib/dashboard/widget-registry'

describe('dashboard preferences', () => {
  it('has a unique and ordered widget registry', () => {
    expect(new Set(DASHBOARD_WIDGET_IDS).size).toBe(DASHBOARD_WIDGET_IDS.length)
    expect(DASHBOARD_WIDGET_REGISTRY.every((widget) => widget.label.length > 0 && widget.description.length > 0)).toBe(true)
    expect(DASHBOARD_WIDGET_REGISTRY.map((widget) => widget.defaultOrder)).toEqual(
      [...DASHBOARD_WIDGET_REGISTRY.map((widget) => widget.defaultOrder)].sort((a, b) => a - b),
    )
  })

  it('recognizes only known widget ids', () => {
    expect(isDashboardWidgetId('financial-health')).toBe(true)
    expect(isDashboardWidgetId('unknown-widget')).toBe(false)
    expect(getDashboardWidget('financial-health')?.href).toBe('/financial-health')
  })

  it('normalizes missing preferences to defaults', () => {
    expect(normalizeDashboardPreferences(null)).toEqual(DEFAULT_DASHBOARD_PREFERENCES)
    expect(resetDashboardPreferences()).toEqual(DEFAULT_DASHBOARD_PREFERENCES)
  })

  it('removes duplicated and unknown widgets while preserving known order', () => {
    const preferences = normalizeDashboardPreferences({
      visibleWidgets: ['summary', 'summary', 'unknown-widget' as never, 'goals'],
      widgetOrder: ['goals', 'unknown-widget' as never, 'summary', 'goals'],
      compactMode: true,
      defaultPeriod: 'previous_month',
    })

    expect(preferences.visibleWidgets).toEqual(['summary', 'goals'])
    expect(preferences.widgetOrder.slice(0, 2)).toEqual(['goals', 'summary'])
    expect(preferences.widgetOrder).toHaveLength(DASHBOARD_WIDGET_IDS.length)
    expect(preferences.compactMode).toBe(true)
    expect(preferences.defaultPeriod).toBe('previous_month')
  })

  it('falls back to current month for invalid restored periods', () => {
    const preferences = normalizeDashboardPreferences({
      visible_widgets: ['summary'],
      widget_order: ['summary'],
      compact_mode: false,
      default_period: 'last_12_months',
      user_id: 'user-1',
    })

    expect(preferences.defaultPeriod).toBe('current_month')
  })

  it('serializes preferences for a user-scoped database upsert', () => {
    const row = preferencesToRow('user-1', {
      visibleWidgets: ['summary'],
      widgetOrder: ['summary'],
      compactMode: true,
      defaultPeriod: 'previous_month',
    })

    expect(row).toMatchObject({
      user_id: 'user-1',
      visible_widgets: ['summary'],
      compact_mode: true,
      default_period: 'previous_month',
    })
  })

  it('orders only visible widgets', () => {
    const preferences = normalizeDashboardPreferences({
      visibleWidgets: ['goals', 'summary'],
      widgetOrder: ['summary', 'cash-flow', 'goals'],
    })

    expect(orderVisibleWidgets(preferences)).toEqual(['summary', 'goals'])
  })
})
