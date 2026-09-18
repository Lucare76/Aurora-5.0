import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const api = readFileSync('src/app/api/patrimonio/route.ts', 'utf8')
const page = readFileSync('src/app/(app)/patrimonio/page.tsx', 'utf8')

describe('patrimonio history visualization', () => {
  it('loads enough snapshots and exposes 90-day asset and consolidated history', () => {
    expect(api).toContain('Date.now() - 95 * 86_400_000')
    expect(api).toContain('change_90d: historicalChange(current, snapshots, 90)')
    expect(api).toContain('historyBaseline90d: historyBaseline(patrimonioSnapshots, 90)')
    expect(api).toContain('history: snapshots')
    expect(api).toContain('history: patrimonioSnapshots')
  })

  it('offers 7/30/90-day charts with percentage, minimum and maximum', () => {
    expect(page).toContain('type HistoryPeriod = 7 | 30 | 90')
    expect(page).toContain('Andamento del patrimonio')
    expect(page).toContain('Storico {historyPeriod} giorni')
    expect(page).toContain('Percentuale')
    expect(page).toContain('Minimo')
    expect(page).toContain('Massimo')
  })
})
