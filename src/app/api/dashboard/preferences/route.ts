import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dashboardPreferencesInputSchema, DEFAULT_DASHBOARD_PREFERENCES, normalizeDashboardPreferences, preferencesToRow } from '@/lib/dashboard/preferences'

export const dynamic = 'force-dynamic'

function noStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...init?.headers, 'Cache-Control': 'no-store' },
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return noStore({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error: queryError } = await supabase
    .from('dashboard_preferences')
    .select('user_id,visible_widgets,widget_order,compact_mode,default_period,created_at,updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (queryError) {
    console.warn('[dashboard-preferences:get]', { code: queryError.code })
    return noStore({ preferences: DEFAULT_DASHBOARD_PREFERENCES, source: 'default' })
  }

  return noStore({ preferences: normalizeDashboardPreferences(data), source: data ? 'database' : 'default' })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return noStore({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = dashboardPreferencesInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return noStore({ error: 'INVALID_PREFERENCES' }, { status: 400 })

  const preferences = normalizeDashboardPreferences(parsed.data)
  const { data, error: upsertError } = await supabase
    .from('dashboard_preferences')
    .upsert(preferencesToRow(user.id, preferences), { onConflict: 'user_id' })
    .select('user_id,visible_widgets,widget_order,compact_mode,default_period,created_at,updated_at')
    .single()

  if (upsertError) {
    console.error('[dashboard-preferences:put]', { code: upsertError.code })
    return noStore({ error: 'PREFERENCES_SAVE_FAILED' }, { status: 500 })
  }

  return noStore({ preferences: normalizeDashboardPreferences(data), source: 'database' })
}
