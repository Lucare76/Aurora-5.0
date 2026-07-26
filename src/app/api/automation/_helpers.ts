import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AutomationError } from '@/lib/automation/service'

export async function automationContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } }) }
  return { supabase, user }
}

export function automationJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function automationError(error: unknown, fallback = 'AUTOMATION_FAILED') {
  if (error instanceof ZodError) {
    return automationJson({ error: 'INVALID_RULE', details: process.env.NODE_ENV !== 'production' ? error.flatten() : undefined }, 400)
  }
  if (error instanceof AutomationError) {
    const status = error.code.includes('NOT_FOUND') ? 404 : error.code.includes('INVALID') ? 400 : error.code.includes('CONFLICT') ? 409 : 500
    return automationJson({ error: error.code }, status)
  }
  console.error('[aurora-automation]', { name: error instanceof Error ? error.name : 'unknown' })
  return automationJson({ error: fallback }, 500)
}
