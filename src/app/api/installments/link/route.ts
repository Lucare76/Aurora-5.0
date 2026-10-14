import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { allowedInstallmentAccount } from '@/lib/installments/access'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const parsed = z.object({ transaction_id: z.string().uuid(), plan_id: z.string().uuid(), installment_number: z.number().int().min(1).max(360) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Rata non valida' }, { status: 400 })
  const { data: transaction } = await supabase.from('transactions').select('account_id,type,transfer_peer_id').eq('id', parsed.data.transaction_id).eq('user_id', user.id).maybeSingle()
  if (!transaction || transaction.type !== 'expense' || transaction.transfer_peer_id) return NextResponse.json({ error: 'Spesa non trovata' }, { status: 404 })
  if (!await allowedInstallmentAccount(supabase, user, transaction.account_id)) return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  const { error } = await supabase.rpc('link_installment_payment', { p_transaction_id: parsed.data.transaction_id, p_plan_id: parsed.data.plan_id, p_installment_number: parsed.data.installment_number })
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Questa rata è già collegata a un movimento' : 'Impossibile collegare la rata' }, { status: error.code === '23505' ? 409 : 400 })
  return NextResponse.json({ success: true })
}
