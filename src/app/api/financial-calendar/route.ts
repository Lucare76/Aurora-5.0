import { NextResponse } from 'next/server'
import { buildFinancialCalendarPayload } from '@/lib/financial-calendar/service'
import { FinancialCalendarInputError } from '@/lib/financial-calendar/types'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const payload = await buildFinancialCalendarPayload(supabase, new URL(request.url).searchParams, user.id)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof FinancialCalendarInputError) {
      return NextResponse.json({ error: err.code }, { status: err.code === 'CALENDAR_FAILED' ? 500 : 400, headers: { 'Cache-Control': 'no-store' } })
    }
    console.error('[aurora-financial-calendar]', { name: err instanceof Error ? err.name : 'unknown' })
    return NextResponse.json({ error: 'CALENDAR_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
