import { NextResponse } from 'next/server'
import { buildFinancialHealthPayload, FinancialHealthInputError } from '@/lib/financial-health/service'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const payload = await buildFinancialHealthPayload(supabase, new URL(request.url).searchParams, user.id)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof FinancialHealthInputError) {
      const status = err.code === 'FINANCIAL_HEALTH_CALCULATION_FAILED' ? 500 : 400
      return NextResponse.json({ error: err.code }, { status, headers: { 'Cache-Control': 'no-store' } })
    }
    console.error('[aurora-financial-health]', { name: err instanceof Error ? err.name : 'unknown' })
    return NextResponse.json({ error: 'FINANCIAL_HEALTH_CALCULATION_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
