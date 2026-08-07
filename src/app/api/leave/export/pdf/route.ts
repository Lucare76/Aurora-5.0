import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePrivateHrAccess } from '@/lib/access/private-finance-access'
import { buildLeavePdf } from '@/lib/leave/pdf'
import type { LeaveEntry, LeaveSettings } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!requirePrivateHrAccess(user)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const url = new URL(request.url)
  const kind = url.searchParams.get('kind')
  const year = Number(url.searchParams.get('year') ?? new Date().getFullYear())
  const month = Number(url.searchParams.get('month') ?? new Date().getMonth() + 1)
  if (kind !== 'vacation' && kind !== 'permits' && kind !== 'summary') {
    return NextResponse.json({ error: 'INVALID_PDF_KIND' }, { status: 400 })
  }

  const [settingsRes, entriesRes] = await Promise.all([
    supabase
      .from('leave_settings')
      .select('id,user_id,vacation_days_per_year,permit_104_hours_per_month,timezone,created_at,updated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('leave_entries')
      .select('id,user_id,type,start_date,end_date,days,hours,start_time,end_time,note,created_at,updated_at')
      .eq('user_id', user.id)
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', `${year}-12-31`)
      .order('start_date', { ascending: true }),
  ])
  if (settingsRes.error || entriesRes.error || !settingsRes.data) {
    return NextResponse.json({ error: 'LEAVE_PDF_UNAVAILABLE' }, { status: 500 })
  }

  const pdf = buildLeavePdf({
    kind,
    year,
    month,
    settings: settingsRes.data as LeaveSettings,
    entries: (entriesRes.data ?? []) as LeaveEntry[],
  })
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="aurora-ferie-permessi-${kind}-${year}.pdf"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
