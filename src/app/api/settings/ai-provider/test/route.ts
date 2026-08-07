import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { testAiProviderConnection } from '@/lib/financial-assistant/providers/connection-test'
import { aiProviderSchema, markAiProviderConnectionResult } from '@/lib/financial-assistant/providers/personal-settings'

export const dynamic = 'force-dynamic'

const testSchema = z
  .object({
    provider: aiProviderSchema,
    apiKey: z.string().trim().min(8).max(400),
  })
  .strict()

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }

  const parsed = testSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'INVALID_AI_PROVIDER_TEST', details: parsed.error.flatten() }, 400)
  }

  const result = await testAiProviderConnection(parsed.data)
  await markAiProviderConnectionResult({
    supabase,
    userId: user.id,
    ok: result.ok,
    error: result.ok ? null : result.message,
  })

  return json({
    data: {
      ok: result.ok,
      status: result.status,
      message: result.message,
    },
  }, result.ok ? 200 : 400)
}
