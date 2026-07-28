import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runTravelAffordabilityEngine } from '@/lib/affordability/travel/engine'
import { travelInputSchema } from '@/lib/affordability/travel/validation'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { TravelInput } from '@/lib/affordability/travel/types'

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

  const parsed = travelInputSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'VALIDATION_ERROR', details: parsed.error.issues }, 422)
  }
  const input = parsed.data as TravelInput

  const [accountsRes, recurringRes, txRes, loansRes, loanPaymentsRes, goalsRes, contribRes] =
    await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('recurring_rules').select('id,type,amount,frequency,start_date,end_date,next_due_date,is_active').eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('id,type,amount,date,transfer_peer_id')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(500),
      supabase.from('loans').select('id,remaining,is_settled,due_date').eq('user_id', user.id),
      supabase.from('loan_payments').select('id,loan_id,amount,paid_at').eq('user_id', user.id),
      supabase.from('savings_goals').select('id,name,target_amount,current_amount,target_date,status,archived').eq('user_id', user.id),
      supabase.from('goal_contributions').select('id,goal_id,amount,date').eq('user_id', user.id),
    ])

  const dbData: AffordabilityDbData = {
    accounts: (accountsRes.data ?? []) as AffordabilityDbData['accounts'],
    recurringRules: (recurringRes.data ?? []) as AffordabilityDbData['recurringRules'],
    recentTransactions: (txRes.data ?? []) as AffordabilityDbData['recentTransactions'],
    loans: (loansRes.data ?? []) as AffordabilityDbData['loans'],
    loanPayments: (loanPaymentsRes.data ?? []) as AffordabilityDbData['loanPayments'],
    goals: (goalsRes.data ?? []) as AffordabilityDbData['goals'],
    goalContributions: (contribRes.data ?? []) as AffordabilityDbData['goalContributions'],
  }

  try {
    const result = runTravelAffordabilityEngine(input, dbData, new Date())
    return json({ data: result, engineVersion: result.engineVersion }, 200)
  } catch (err) {
    console.error('[aurora-affordability] travel/calculate', err instanceof Error ? err.message : 'calculation failed')
    return json({
      error: 'CALCULATION_FAILED',
      message: 'Non è stato possibile completare la valutazione. Nessun dato finanziario è stato modificato.',
    }, 500)
  }
}

export async function GET() {
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
}
