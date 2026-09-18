import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  crons?: Array<{ path: string; schedule: string }>
}
const route = readFileSync('src/app/api/integrations/scalable/daily-sync/route.ts', 'utf8')
const manualRoute = readFileSync('src/app/api/integrations/scalable/sync/route.ts', 'utf8')
const service = readFileSync('src/lib/integrations/scalable-sync.ts', 'utf8')

describe('Scalable daily sync cron', () => {
  it('runs once a day at 05:00 UTC (07:00 in Italy during CEST)', () => {
    expect(vercel.crons).toContainEqual({
      path: '/api/integrations/scalable/daily-sync',
      schedule: '0 5 * * *',
    })
  })

  it('requires CRON_SECRET and uses the admin client only in the cron route', () => {
    expect(route).toContain("process.env.CRON_SECRET")
    expect(route).toContain("request.headers.get('authorization')")
    expect(route).toContain('createAdminClient()')
    expect(manualRoute).not.toContain('createAdminClient')
  })

  it('shares the same read-only sync service between manual and cron flows', () => {
    expect(route).toContain('syncScalableForUser')
    expect(manualRoute).toContain('syncScalableForUser')
    expect(service).toContain("from('external_assets')")
    expect(service).toContain("from('external_asset_snapshots')")
    expect(service).toContain("from('patrimonio_snapshots')")
    expect(service).not.toContain("from('transactions').insert")
    expect(service).not.toContain("from('accounts').update")
  })
})
