import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  buildScalableAuthorizeUrl,
  createPkce,
  registerScalableClient,
} from '@/lib/integrations/scalable'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  if (!process.env.SCALABLE_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL('/patrimonio?scalable=missing-secret', request.url))
  }

  try {
    const url = new URL(request.url)
    const redirectUri = `${url.origin}/api/integrations/scalable/callback`
    const { verifier, challenge, state } = createPkce()
    const clientId = await registerScalableClient(redirectUri)

    const cookieStore = await cookies()
    cookieStore.set('aurora_scalable_oauth', JSON.stringify({
      clientId,
      verifier,
      state,
      redirectUri,
      createdAt: Date.now(),
    }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      path: '/',
      maxAge: 10 * 60,
    })

    return NextResponse.redirect(buildScalableAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      challenge,
    }))
  } catch (error) {
    console.error('[scalable:connect]', error)
    return NextResponse.redirect(new URL('/patrimonio?scalable=connect-error', request.url))
  }
}
