import { NextResponse } from 'next/server'
import { buildFinancialJournalPayload, saveFinancialMonthClosure } from '@/lib/financial-journal/service'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function authenticatedClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

export async function GET() {
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

  try {
    const payload = await buildFinancialJournalPayload(supabase, user.id)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[financial-journal:get]', { name: error instanceof Error ? error.name : 'unknown' })
    return NextResponse.json({ error: 'FINANCIAL_JOURNAL_LOAD_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST() {
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

  try {
    const payload = await buildFinancialJournalPayload(supabase, user.id)
    const closure = await saveFinancialMonthClosure(supabase, user.id, payload.preview)
    return NextResponse.json({ closure }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[financial-journal:post]', { name: error instanceof Error ? error.name : 'unknown' })
    return NextResponse.json({ error: 'FINANCIAL_CLOSURE_SAVE_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
