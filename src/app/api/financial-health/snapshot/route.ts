import { NextResponse } from 'next/server'
import { buildFinancialHealthPayload, FinancialHealthInputError } from '@/lib/financial-health/service'
import { saveFinancialHealthSnapshot } from '@/lib/financial-health/snapshot-service'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const params = new URL(request.url).searchParams
    const result = await buildFinancialHealthPayload(supabase, params, user.id)
    const snapshot = await saveFinancialHealthSnapshot(supabase, user.id, result)
    return NextResponse.json({ snapshot }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof FinancialHealthInputError) {
      return NextResponse.json({ error: err.code }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    console.error('[aurora-financial-health-snapshot]', { name: err instanceof Error ? err.name : 'unknown' })
    return NextResponse.json({ error: 'SNAPSHOT_SAVE_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
