'use client'

import type { ScenarioEngineResult, ComparisonMetric } from '@/lib/scenarios/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { AlertTriangle, Info } from 'lucide-react'

// ── Single metric row ─────────────────────────────────────────────────────────

function fmtMetric(metric: ComparisonMetric, value: number) {
  if (metric.unit === 'currency') return formatCurrency(value)
  if (metric.unit === 'percent')  return `${value.toFixed(1)}%`
  return String(value)
}

function MetricRow({ metric }: { metric: ComparisonMetric }) {
  const delta = metric.delta
  const deltaAbs = Math.abs(delta)
  const deltaStr =
    metric.unit === 'currency' ? formatCurrency(deltaAbs) :
    metric.unit === 'percent'  ? `${deltaAbs.toFixed(1)}%` :
    String(deltaAbs)

  const arrowCls =
    metric.direction === 'positive' ? 'text-emerald-500' :
    metric.direction === 'negative' ? 'text-red-500' :
    'text-slate-400'

  const arrow =
    metric.direction === 'positive' ? '▲' :
    metric.direction === 'negative' ? '▼' : '—'

  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      {/* Desktop: single row. Mobile: stacked */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        {/* Label + explanation */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{metric.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{metric.explanation}</p>
        </div>

        {/* Numbers: baseline / scenario / delta */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0 mt-1 sm:mt-0">
          <div className="text-right min-w-[70px]">
            <p className="text-xs text-slate-400">Baseline</p>
            <p className="text-sm text-slate-600">{fmtMetric(metric, metric.baseline)}</p>
          </div>
          <div className="text-right min-w-[70px]">
            <p className="text-xs text-slate-400">Scenario</p>
            <p className={cn('text-sm font-bold',
              metric.direction === 'positive' ? 'text-emerald-600' :
              metric.direction === 'negative' ? 'text-red-500' :
              'text-slate-700'
            )}>
              {fmtMetric(metric, metric.scenario)}
            </p>
          </div>
          <div className={cn('text-right w-16 shrink-0', arrowCls)}>
            <p className="text-xs opacity-0 select-none">·</p>
            <p className="text-xs font-semibold">{arrow} {deltaStr}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScenarioResults({ result }: { result: ScenarioEngineResult }) {
  const { comparison, reliability, financialHealth, warnings } = result

  return (
    <div className="space-y-4">
      {/* Summary + reliability banner */}
      <Card className="border-[#e5e7f0] bg-white">
        <CardContent className="p-4 sm:p-5">
          <p className="text-sm sm:text-base text-slate-700 font-medium">{comparison.summary}</p>

          {reliability.level !== 'high' && (
            <div className={cn(
              'mt-3 flex items-start gap-2.5 rounded-xl p-3 text-sm',
              reliability.level === 'limited'
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700',
            )}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs uppercase tracking-wide mb-0.5">
                  {reliability.level === 'limited' ? 'Attendibilità limitata' : 'Attendibilità media'}
                </p>
                {reliability.warnings.map((w, i) => (
                  <p key={i} className="text-xs leading-relaxed">{w}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison metrics */}
      <Card className="border-[#e5e7f0] bg-white">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Confronto con la baseline</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-1 pb-2 sm:px-5">
          {comparison.metrics.map((m) => (
            <MetricRow key={m.key} metric={m} />
          ))}
        </CardContent>
      </Card>

      {/* Financial health simulation */}
      {financialHealth && (
        <Card className="border-[#e5e7f0] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-1.5">
              Salute finanziaria simulata
              <span title={financialHealth.note}>
                <Info className="h-3.5 w-3.5 text-slate-300" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {/* Score row */}
            <div className="flex items-stretch gap-4">
              <div className="flex-1 rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Baseline</p>
                <p className="text-3xl font-bold text-slate-700 tabular-nums">
                  {financialHealth.baseline ?? '—'}
                </p>
                {financialHealth.baselineLevel && (
                  <p className="text-xs text-slate-500 mt-0.5">{financialHealth.baselineLevel}</p>
                )}
              </div>

              <div className="flex items-center justify-center px-1">
                <div className={cn('text-center', financialHealth.delta !== null && financialHealth.delta > 0 ? 'text-emerald-500' : financialHealth.delta !== null && financialHealth.delta < 0 ? 'text-red-500' : 'text-slate-300')}>
                  <p className="text-xs font-semibold">
                    {financialHealth.delta !== null
                      ? `${financialHealth.delta >= 0 ? '+' : ''}${financialHealth.delta}pts`
                      : '—'}
                  </p>
                  <p className="text-lg">{financialHealth.delta !== null && financialHealth.delta >= 0 ? '→' : '→'}</p>
                </div>
              </div>

              <div className="flex-1 rounded-xl bg-indigo-50 p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Scenario</p>
                <p className="text-3xl font-bold text-indigo-600 tabular-nums">
                  {financialHealth.scenario ?? '—'}
                </p>
                {financialHealth.scenarioLevel && (
                  <p className="text-xs text-indigo-500 mt-0.5">{financialHealth.scenarioLevel}</p>
                )}
              </div>
            </div>

            {/* Components impacted */}
            {financialHealth.componentsImpacted.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {financialHealth.componentsImpacted.map((c) => (
                  <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {c}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400 text-center">{financialHealth.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Engine warnings */}
      {warnings.length > 0 && (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
