import { NextResponse } from 'next/server'
import { listFinancialHealthSnapshots } from '@/lib/financial-health/snapshot-service'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const snapshots = await listFinancialHealthSnapshots(supabase, user.id)
    return NextResponse.json({ snapshots }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[aurora-financial-health-history]', { name: err instanceof Error ? err.name : 'unknown' })
    return NextResponse.json({ error: 'SNAPSHOT_NOT_FOUND' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
