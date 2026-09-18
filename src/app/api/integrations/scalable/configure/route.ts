import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  encryptSecret,
  refreshScalableToken,
} from '@/lib/integrations/scalable'

const schema = z.object({
  clientId: z.string().trim().min(8).max(500),
  refreshToken: z.string().trim().min(16).max(10000),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  if (!process.env.SCALABLE_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'SCALABLE_TOKEN_ENCRYPTION_KEY_MISSING' }, { status: 500 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_SCALABLE_CREDENTIALS' }, { status: 400 })
  }

  try {
    const token = await refreshScalableToken({
      clientId: parsed.data.clientId,
      refreshToken: parsed.data.refreshToken,
    })

    const currentRefreshToken = token.refresh_token ?? parsed.data.refreshToken
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null

    const { error } = await supabase
      .from('scalable_connections')
      .upsert({
        user_id: user.id,
        client_id: parsed.data.clientId,
        access_token_enc: encryptSecret(token.access_token),
        refresh_token_enc: encryptSecret(currentRefreshToken),
        token_type: token.token_type ?? 'Bearer',
        scope: token.scope ?? null,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        last_error: null,
        metadata: {
          resource: 'https://mcp.scalable.capital/mcp',
          access: 'read-only-intended',
          bootstrap: 'loopback',
        },
      }, { onConflict: 'user_id' })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[scalable:configure]', error)
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    return NextResponse.json({
      error: 'SCALABLE_CONFIGURATION_FAILED',
      detail: message,
    }, { status: 502 })
  }
}
