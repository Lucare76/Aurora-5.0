'use client'

import { ArrowDown, ArrowUp, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DASHBOARD_WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry'
import type { DashboardPreferences, DashboardWidgetId } from '@/lib/dashboard/types'
import { normalizeDashboardPreferences, resetDashboardPreferences } from '@/lib/dashboard/preferences'

type Props = {
  preferences: DashboardPreferences
  open: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onChange: (preferences: DashboardPreferences) => void
  onSave: () => void
  onReset: () => void
}

function moveWidget(order: DashboardWidgetId[], id: DashboardWidgetId, direction: -1 | 1) {
  const next = [...order]
  const index = next.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) return order
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export function DashboardPreferencesDialog({ preferences, open, saving, onOpenChange, onChange, onSave, onReset }: Props) {
  const normalized = normalizeDashboardPreferences(preferences)
  const visible = new Set(normalized.visibleWidgets)

  const update = (next: Partial<DashboardPreferences>) => {
    onChange(normalizeDashboardPreferences({ ...normalized, ...next }))
  }

  const toggleWidget = (id: DashboardWidgetId) => {
    const visibleWidgets = visible.has(id)
      ? normalized.visibleWidgets.filter((widgetId) => widgetId !== id)
      : [...normalized.visibleWidgets, id]
    update({ visibleWidgets })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" aria-label="Apri impostazioni dashboard">
          <SlidersHorizontal className="h-4 w-4" />
          Personalizza
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>Personalizza dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-semibold text-slate-900">Vista compatta</span>
                <span className="text-sm text-slate-500">Riduce spaziature e altezza delle card.</span>
              </span>
              <input
                type="checkbox"
                checked={normalized.compactMode}
                onChange={(event) => update({ compactMode: event.target.checked })}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div className="space-y-3">
            {normalized.widgetOrder.map((id, index) => {
              const widget = DASHBOARD_WIDGET_REGISTRY.find((item) => item.id === id)
              if (!widget) return null
              return (
                <div key={id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <input
                    type="checkbox"
                    checked={visible.has(id)}
                    onChange={() => toggleWidget(id)}
                    aria-label={`Mostra ${widget.label}`}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-950">{widget.label}</p>
                    <p className="text-sm text-slate-500">{widget.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Sposta su ${widget.label}`} disabled={index === 0} onClick={() => update({ widgetOrder: moveWidget(normalized.widgetOrder, id, -1) })}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Sposta giu ${widget.label}`} disabled={index === normalized.widgetOrder.length - 1} onClick={() => update({ widgetOrder: moveWidget(normalized.widgetOrder, id, 1) })}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" className="gap-2" onClick={() => { onChange(resetDashboardPreferences()); onReset() }}>
              <RotateCcw className="h-4 w-4" />
              Ripristina predefinite
            </Button>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? 'Salvataggio...' : 'Salva preferenze'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
