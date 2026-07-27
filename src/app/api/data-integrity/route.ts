import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLatestDataIntegrityScan, listDataIntegrityIssues } from '@/lib/data-integrity/service'
import { DATA_INTEGRITY_CATEGORY_LABELS } from '@/lib/data-integrity/constants'
import { DATA_INTEGRITY_RULES } from '@/lib/data-integrity/registry'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return json({ error: 'UNAUTHORIZED' }, 401)

  const params = new URL(request.url).searchParams
  const { issues, summary, persistenceAvailable } = await listDataIntegrityIssues(supabase, user.id, {
    status: params.get('status') ?? 'all',
    severity: params.get('severity') ?? 'all',
    category: params.get('category') ?? 'all',
    rule: params.get('rule') ?? 'all',
    limit: Number(params.get('limit') ?? 200),
  })
  const latestScan = await getLatestDataIntegrityScan(supabase, user.id)

  return json({
    issues,
    summary,
    latestScan,
    persistenceAvailable,
    categories: DATA_INTEGRITY_CATEGORY_LABELS,
    rules: DATA_INTEGRITY_RULES,
  }, 200)
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
