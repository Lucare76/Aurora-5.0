import { NextRequest, NextResponse } from 'next/server'
import { observability } from '@/lib/observability/logger'

export const runtime = 'nodejs'

function text(value: unknown, max = 500): string | null {
  return typeof value === 'string' ? value.slice(0, max) : null
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ ok: false }, { status: 403 })
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  observability.error('client_runtime_error', undefined, {
    name: text(body.name, 100),
    message: text(body.message),
    digest: text(body.digest, 150),
    path: text(body.path, 250),
  })

  return NextResponse.json({ ok: true }, { status: 202 })
}
