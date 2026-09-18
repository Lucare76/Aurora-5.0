import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret, exchangeScalableCode } from '@/lib/integrations/scalable'

type OAuthCookie = {
  clientId: string
  verifier: string
  state: string
  redirectUri: string
  createdAt: number
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const cookieStore = await cookies()
  const raw = cookieStore.get('aurora_scalable_oauth')?.value
  cookieStore.delete('aurora_scalable_oauth')

  if (oauthError) {
    console.error('[scalable:callback:oauth]', oauthError, url.searchParams.get('error_description'))
    return NextResponse.redirect(new URL('/patrimonio?scalable=denied', request.url))
  }

  if (!raw || !code || !state) {
    return NextResponse.redirect(new URL('/patrimonio?scalable=invalid-callback', request.url))
  }

  try {
    const pending = JSON.parse(raw) as OAuthCookie
    const expired = Date.now() - Number(pending.createdAt) > 10 * 60 * 1000
    if (expired || pending.state !== state) {
      return NextResponse.redirect(new URL('/patrimonio?scalable=invalid-state', request.url))
    }

    const token = await exchangeScalableCode({
      clientId: pending.clientId,
      code,
      verifier: pending.verifier,
      redirectUri: pending.redirectUri,
    })

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null

    const { error } = await supabase
      .from('scalable_connections')
      .upsert({
        user_id: user.id,
        client_id: pending.clientId,
        access_token_enc: encryptSecret(token.access_token),
        refresh_token_enc: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        token_type: token.token_type ?? 'Bearer',
        scope: token.scope ?? null,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        last_error: null,
        metadata: { resource: 'https://mcp.scalable.capital/mcp', access: 'read-only-intended' },
      }, { onConflict: 'user_id' })

    if (error) throw error

    return NextResponse.redirect(new URL('/patrimonio?scalable=connected', request.url))
  } catch (error) {
    console.error('[scalable:callback]', error)
    return NextResponse.redirect(new URL('/patrimonio?scalable=callback-error', request.url))
  }
}
