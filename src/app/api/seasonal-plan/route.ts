import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { seasonalPlanSchema } from '@/lib/seasonal-plan/schema'
import {
  forecastPlan,
  getSeasonalPayload,
  seasonalContext,
} from '@/lib/seasonal-plan/service'
export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
export async function GET() {
  const client = await createClient()
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) return json({ error: 'Non autenticato' }, 401)
  try {
    return json(await getSeasonalPayload(client, user.id))
  } catch {
    return json({ error: 'Piano non disponibile. Riprova tra poco.' }, 500)
  }
}
export async function PUT(request: Request) {
  const client = await createClient()
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) return json({ error: 'Non autenticato' }, 401)
  const parsed = seasonalPlanSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return json({ error: 'Controlla conti, importi e date del piano.' }, 400)
  try {
    const context = await seasonalContext(client, user.id)
    if (
      parsed.data.account_ids.some(
        (id) => !context.accounts.some((a) => a.id === id),
      )
    )
      return json(
        { error: 'Seleziona solo conti personali liquidi in euro e attivi.' },
        400,
      )
    if (
      context.accounts.some(
        (a) =>
          a.type === 'credit' &&
          Number(a.balance) < 0 &&
          !parsed.data.account_ids.includes(a.id),
      )
    )
      return json(
        {
          error:
            'Includi anche le carte con saldo negativo per considerare i debiti.',
        },
        400,
      )
    const payload = forecastPlan(parsed.data, context)
    // Preview and persistence share the same engine. Neither writes financial transactions.
    if (new URL(request.url).searchParams.get('preview') === 'true')
      return json({ plan: parsed.data, saved: false, ...payload })
    const { error: saveError } = await client
      .from('seasonal_cash_plans')
      .upsert(
        {
          user_id: user.id,
          config: parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
    if (saveError) throw saveError
    return json({ plan: parsed.data, saved: true, ...payload })
  } catch {
    return json({ error: 'Impossibile calcolare o salvare il piano.' }, 500)
  }
}
