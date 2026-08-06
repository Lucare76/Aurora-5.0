import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { homeInputSchema } from '@/lib/affordability/home/validation'
import { runHomeAffordabilityEngine } from '@/lib/affordability/home/engine'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { HomeInput } from '@/lib/affordability/home/types'
import { filterPersonalAccounts, filterPersonalTransactions, getPersonalExcludedAccountIds } from '@/lib/dependent-finance/calculations'

export const dynamic = 'force-dynamic'

const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20
const buckets = new Map<string, { count: number; resetAt: number }>()

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function allowRequest(userId: string, now = Date.now()): boolean {
  const bucket = buckets.get(userId)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count += 1
  return true
}

async function verifyAccountOwnership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, accountIds: string[]) {
  const unique = [...new Set(accountIds.filter(Boolean))]
  for (const accountId of unique) {
    const { data } = await supabase
      .from('accounts')
      .select('id,currency,is_active')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()
    if (!data) return { ok: false as const, status: 404, message: 'Conto non trovato o non autorizzato.' }
    if (data.currency !== 'EUR') return { ok: false as const, status: 422, message: 'La valuta del conto non è compatibile con questa simulazione.' }
    if (data.is_active === false) return { ok: false as const, status: 422, message: 'Il conto selezionato non è disponibile.' }
  }
  return { ok: true as const }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!allowRequest(user.id)) return json({ error: 'RATE_LIMITED', message: 'Troppe simulazioni in poco tempo. Riprova tra un minuto.' }, 429)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'INVALID_BODY' }, 400)
  }

  const parsed = homeInputSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'VALIDATION_ERROR', details: parsed.error.issues }, 422)
  }
  const input = parsed.data as HomeInput

  const ownership = await verifyAccountOwnership(
    supabase,
    user.id,
    [input.accountId, input.debitAccountId].filter((id): id is string => Boolean(id)),
  )
  if (!ownership.ok) return json({ error: 'ACCOUNT_NOT_FOUND', message: ownership.message }, ownership.status)

  const [accountsRes, recurringRes, txRes, loansRes, loanPaymentsRes, goalsRes, contribRes, accountPurposeRes] =
    await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('recurring_rules').select('id,account_id,type,amount,frequency,start_date,end_date,next_due_date,is_active').eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('id,account_id,type,amount,date,transfer_peer_id')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(500),
      supabase.from('loans').select('id,remaining,is_settled,due_date').eq('user_id', user.id),
      supabase.from('loan_payments').select('id,loan_id,amount,paid_at').eq('user_id', user.id),
      supabase.from('savings_goals').select('id,name,target_amount,current_amount,target_date,status,archived').eq('user_id', user.id),
      supabase.from('goal_contributions').select('id,goal_id,amount,date').eq('user_id', user.id),
      supabase.from('account_purpose_links').select('account_id,purpose').eq('user_id', user.id),
    ])

  const accountPurposeLinks = accountPurposeRes.error ? [] : (accountPurposeRes.data ?? []) as Array<{ account_id: string; purpose: string }>
  const rawAccounts = (accountsRes.data ?? []) as AffordabilityDbData['accounts']
  const dedicatedAccountIds = getPersonalExcludedAccountIds(accountPurposeLinks, rawAccounts)
  const dbData: AffordabilityDbData = {
    accounts: filterPersonalAccounts(rawAccounts, accountPurposeLinks),
    recurringRules: ((recurringRes.data ?? []) as AffordabilityDbData['recurringRules']).filter((rule) => !rule.account_id || !dedicatedAccountIds.has(rule.account_id)),
    recentTransactions: filterPersonalTransactions((txRes.data ?? []) as AffordabilityDbData['recentTransactions'], accountPurposeLinks, rawAccounts),
    loans: (loansRes.data ?? []) as AffordabilityDbData['loans'],
    loanPayments: (loanPaymentsRes.data ?? []) as AffordabilityDbData['loanPayments'],
    goals: (goalsRes.data ?? []) as AffordabilityDbData['goals'],
    goalContributions: (contribRes.data ?? []) as AffordabilityDbData['goalContributions'],
  }

  try {
    const result = runHomeAffordabilityEngine(input, dbData, new Date())
    return json({ data: result, engineVersion: result.engineVersion }, 200)
  } catch (err) {
    console.error('[aurora-affordability] home/calculate', err instanceof Error ? err.message : 'calculation failed')
    return json({
      error: 'CALCULATION_FAILED',
      message: 'Non è stato possibile completare la valutazione. Nessun dato finanziario è stato modificato.',
    }, 500)
  }
}

export async function GET() {
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
}
