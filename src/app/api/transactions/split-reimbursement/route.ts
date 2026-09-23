import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canAccessPrivateFinance } from '@/lib/access/private-finance-access'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ transaction_id: z.string().uuid(), reimbursed_amount: z.number().finite().positive() }).strict()

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Importo o movimento non valido' }, { status: 400 })

  const { data: transaction, error: lookupError } = await supabase.from('transactions')
    .select('account_id,amount,type,is_neutral,transfer_peer_id')
    .eq('id', parsed.data.transaction_id).eq('user_id', user.id).maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'Movimento non verificabile' }, { status: 500 })
  if (!transaction) return NextResponse.json({ error: 'Movimento non trovato' }, { status: 404 })

  if (!canAccessPrivateFinance(user.email)) {
    const { data: links, error } = await supabase.from('account_purpose_links')
      .select('purpose').eq('user_id', user.id).eq('account_id', transaction.account_id)
    if (error) return NextResponse.json({ error: 'Conto non verificabile' }, { status: 500 })
    if ((links ?? []).some(({ purpose }) => ['DEPENDENT_AURORA', 'DEPENDENT', 'ADI'].includes(purpose))) {
      return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
    }
  }

  const cents = Math.round(parsed.data.reimbursed_amount * 100)
  if (transaction.type !== 'expense' || transaction.is_neutral || transaction.transfer_peer_id
    || Math.abs(parsed.data.reimbursed_amount * 100 - cents) > 0.00001
    || cents >= Math.round(Number(transaction.amount) * 100)) {
    return NextResponse.json({ error: 'Il rimborso deve essere inferiore alla spesa e avere al massimo due decimali' }, { status: 400 })
  }
  const { error } = await supabase.rpc('split_reimbursed_expense', {
    p_transaction_id: parsed.data.transaction_id, p_reimbursed_amount: cents / 100,
  })
  if (error) return NextResponse.json({ error: 'Impossibile suddividere la spesa. Controlla che la migrazione sia applicata.' }, { status: 409 })
  return NextResponse.json({ success: true })
}
