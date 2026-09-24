import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  if (
    process.env.AURORA_E2E_AUTH_BYPASS === '1'
    && request.headers.get('x-aurora-e2e-auth') === '1'
  ) {
    return NextResponse.next()
  }

  const isPublicPwaAsset =
    request.nextUrl.pathname === '/sw.js'
    || request.nextUrl.pathname === '/offline.html'
    || request.nextUrl.pathname === '/manifest.json'

  if (isPublicPwaAsset) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.svg|icons.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
