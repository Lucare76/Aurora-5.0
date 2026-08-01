import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { carInputSchemaFull } from '@/lib/affordability/car/validation'
import { runCarAffordabilityEngine } from '@/lib/affordability/car/engine'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { CarInput } from '@/lib/affordability/car/types'
import { filterPersonalAccounts, filterPersonalTransactions, getDependentAccountIds } from '@/lib/dependent-finance/calculations'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'INVALID_BODY' }, 400)
  }

  const parsed = carInputSchemaFull.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'VALIDATION_ERROR', details: parsed.error.issues }, 422)
  }

  const input = parsed.data as CarInput

  // Verify account ownership if provided
  const accountId = input.accountId ?? input.debitAccountId
  if (accountId) {
    const { data: acct } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()
    if (!acct) {
      return json({ error: 'ACCOUNT_NOT_FOUND', message: 'Conto non trovato o non autorizzato.' }, 404)
    }
  }

  // Load user financial data in parallel
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
  const dedicatedAccountIds = getDependentAccountIds(accountPurposeLinks)
  const dbData: AffordabilityDbData = {
    accounts: filterPersonalAccounts((accountsRes.data ?? []) as AffordabilityDbData['accounts'], accountPurposeLinks),
    recurringRules: ((recurringRes.data ?? []) as AffordabilityDbData['recurringRules']).filter((rule) => !rule.account_id || !dedicatedAccountIds.has(rule.account_id)),
    recentTransactions: filterPersonalTransactions((txRes.data ?? []) as AffordabilityDbData['recentTransactions'], accountPurposeLinks),
    loans: (loansRes.data ?? []) as AffordabilityDbData['loans'],
    loanPayments: (loanPaymentsRes.data ?? []) as AffordabilityDbData['loanPayments'],
    goals: (goalsRes.data ?? []) as AffordabilityDbData['goals'],
    goalContributions: (contribRes.data ?? []) as AffordabilityDbData['goalContributions'],
  }

  try {
    const result = runCarAffordabilityEngine(input, dbData, new Date())
    return json({ data: result }, 200)
  } catch (err) {
    console.error('[aurora-affordability] car/calculate', err instanceof Error ? err.message : err)
    return json({
      error: 'CALCULATION_FAILED',
      message: 'Non è stato possibile completare la valutazione. Nessun dato finanziario è stato modificato.',
    }, 500)
  }
}

export async function GET() {
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
}
