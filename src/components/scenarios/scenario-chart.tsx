'use client'

import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ScenarioProjectionResult } from '@/lib/scenarios/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function fmtEur(v: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)
}

function fmtAxis(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`
  return `€${v}`
}

export function ScenarioChart({ projection }: { projection: ScenarioProjectionResult }) {
  const data = projection.months.map((m) => ({
    label: m.period.label,
    baseline: m.baselineClosingBalance,
    scenario: m.scenarioClosingBalance,
  }))

  // Show fewer X-axis ticks on small horizons vs. large ones
  const tickEvery = data.length <= 12 ? 1 : data.length <= 24 ? 2 : 3

  return (
    <Card className="border-[#e5e7f0] bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Evoluzione del saldo</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-5">
        {/* Fixed height — tall enough on mobile to be readable */}
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradBaseline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradScenario" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                interval={tickEvery - 1}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtAxis}
                width={60}
              />

              <Tooltip
                formatter={(value, name) => [
                  fmtEur(Number(value)),
                  name === 'baseline' ? 'Baseline' : 'Scenario',
                ]}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
                labelStyle={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}
              />

              <Legend
                formatter={(name) => name === 'baseline' ? 'Baseline' : 'Scenario'}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />

              {/* Baseline — dashed grey */}
              <Area
                type="monotone"
                dataKey="baseline"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                fill="url(#gradBaseline)"
                dot={false}
                activeDot={{ r: 3 }}
              />
              {/* Scenario — solid indigo */}
              <Area
                type="monotone"
                dataKey="scenario"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gradScenario)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
