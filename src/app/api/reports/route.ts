import { NextResponse } from 'next/server'
import { buildReportPayload } from '@/lib/reports/service'
import { ReportInputError } from '@/lib/reports/types'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const payload = await buildReportPayload(supabase, new URL(request.url).searchParams)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof ReportInputError) {
      const status = error.code === 'REPORT_FAILED' ? 500 : 400
      return NextResponse.json({ error: error.code }, { status, headers: { 'Cache-Control': 'no-store' } })
    }
    console.error('[aurora-reports]', { name: error instanceof Error ? error.name : 'unknown' })
    return NextResponse.json({ error: 'REPORT_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
