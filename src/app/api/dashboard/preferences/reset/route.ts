import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_DASHBOARD_PREFERENCES, normalizeDashboardPreferences, preferencesToRow } from '@/lib/dashboard/preferences'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const { data, error: upsertError } = await supabase
    .from('dashboard_preferences')
    .upsert(preferencesToRow(user.id, DEFAULT_DASHBOARD_PREFERENCES), { onConflict: 'user_id' })
    .select('user_id,visible_widgets,widget_order,compact_mode,default_period,created_at,updated_at')
    .single()

  if (upsertError) {
    console.error('[dashboard-preferences:reset]', { code: upsertError.code })
    return NextResponse.json({ error: 'PREFERENCES_RESET_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json({ preferences: normalizeDashboardPreferences(data), source: 'database' }, { headers: { 'Cache-Control': 'no-store' } })
}
