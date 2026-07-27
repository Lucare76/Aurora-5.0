import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { upsertPreference } from '@/lib/notifications/preferences-service'
import { resolveTypePreference } from '@/lib/notifications/preferences-defaults'
import { TYPE_CONFIG_SCHEMAS } from '@/lib/notifications/preferences-schema'
import type { NotificationType } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

const VALID_TYPES = Object.keys(TYPE_CONFIG_SCHEMAS) as NotificationType[]

const patchSchema = z.object({
  is_enabled: z.boolean().optional(),
  config:     z.record(z.string(), z.unknown()).optional(),
})

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { type } = await params
  if (!VALID_TYPES.includes(type as NotificationType)) {
    return json({ error: 'INVALID_NOTIFICATION_TYPE' }, 400)
  }
  const notificationType = type as NotificationType

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'INVALID_NOTIFICATION_PREFERENCES', details: parsed.error.flatten() }, 400)
  }

  // Validate config against the type's schema
  if (parsed.data.config !== undefined) {
    const configSchema = TYPE_CONFIG_SCHEMAS[notificationType]
    const configParsed = configSchema.safeParse(parsed.data.config)
    if (!configParsed.success) {
      return json({ error: 'INVALID_THRESHOLD', details: configParsed.error.flatten() }, 400)
    }
    parsed.data.config = configParsed.data as Record<string, unknown>
  }

  try {
    const row = await upsertPreference(supabase, user.id, notificationType, parsed.data)
    return json({ data: resolveTypePreference(notificationType, row) }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
