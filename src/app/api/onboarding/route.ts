import { NextResponse } from 'next/server'

import type { OnboardingStatus } from '@/lib/onboarding'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const [profileResult, accountsResult, categoriesResult, transactionsResult, budgetsResult] = await Promise.all([
    supabase.from('profiles').select('onboarding_done').eq('id', user.id).single(),
    supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const firstError = [profileResult.error, accountsResult.error, categoriesResult.error, transactionsResult.error, budgetsResult.error].find(Boolean)
  if (firstError) {
    console.error('[onboarding] load failed', { code: firstError.code })
    return NextResponse.json({ error: 'ONBOARDING_LOAD_FAILED' }, { status: 500 })
  }

  const status: OnboardingStatus = {
    onboardingDone: Boolean(profileResult.data?.onboarding_done),
    hasAccount: (accountsResult.count ?? 0) > 0,
    hasCategory: (categoriesResult.count ?? 0) > 0,
    hasMovement: (transactionsResult.count ?? 0) > 0,
    hasBudget: (budgetsResult.count ?? 0) > 0,
  }

  return NextResponse.json(status)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || !('done' in body) || typeof (body as { done?: unknown }).done !== 'boolean') {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_done: (body as { done: boolean }).done })
    .eq('id', user.id)

  if (error) {
    console.error('[onboarding] update failed', { code: error.code })
    return NextResponse.json({ error: 'ONBOARDING_UPDATE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
