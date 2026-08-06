import { NextResponse } from 'next/server'
import { runFinancialAssistantQuery, statusToHttpStatus } from '@/lib/financial-assistant/orchestrator'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const result = await runFinancialAssistantQuery({
    supabase,
    runtime: { user, email: user.email ?? null, now: new Date() },
    body,
  })

  return NextResponse.json(result, { status: statusToHttpStatus(result.status) })
}

