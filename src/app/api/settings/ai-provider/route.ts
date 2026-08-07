import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  aiProviderSettingsInputSchema,
  getSafeAiProviderSettings,
  upsertAiProviderSettings,
} from '@/lib/financial-assistant/providers/personal-settings'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    return json({ data: await getSafeAiProviderSettings(supabase, user.id) }, 200)
  } catch {
    return json({ error: 'AI_SETTINGS_UNAVAILABLE' }, 500)
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }

  const parsed = aiProviderSettingsInputSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'INVALID_AI_PROVIDER_SETTINGS', details: parsed.error.flatten() }, 400)
  }

  try {
    const data = await upsertAiProviderSettings({ supabase, userId: user.id, input: parsed.data })
    return json({ data }, 200)
  } catch (error) {
    return json({
      error: 'AI_SETTINGS_SAVE_FAILED',
      message: error instanceof Error ? error.message : 'Impostazioni AI non salvate.',
    }, 400)
  }
}
