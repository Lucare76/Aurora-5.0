import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { canAccessPrivateFinance } from '@/lib/access/private-finance-access'

const id = z.string().uuid()
const planFields = z.object({
  plan_id: id.nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  total_installments: z.number().int().min(2).max(360).optional(),
  installment_number: z.number().int().min(1).max(360),
}).refine((value) => Boolean(value.plan_id) || Boolean(value.title && value.total_installments), {
  message: 'Inserisci nome e numero totale delle rate',
})

const createSchema = planFields.and(z.object({
  account_id: id,
  amount: z.number().finite().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1),
  category_id: id.nullable().optional(),
  notes: z.string().nullable().optional(),
  is_neutral: z.boolean().optional(),
}))

const linkSchema = planFields.and(z.object({ transaction_id: id }))
const unlinkSchema = z.object({ transaction_id: id })

async function session() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function allowedAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
  accountId: string,
) {
  if (canAccessPrivateFinance(user.email)) return true
  const { data, error } = await supabase.from('account_purpose_links')
    .select('purpose').eq('user_id', user.id).eq('account_id', accountId)
  return !error && !(data ?? []).some((row) =>
    ['DEPENDENT_AURORA', 'DEPENDENT', 'ADI'].includes(row.purpose ?? ''))
}

function failed(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  const { supabase, user } = await session()
  if (!user) return failed('Non autenticato', 401)
  const [plans, payments] = await Promise.all([
    supabase.from('installment_plans').select('id,title,total_installments,created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('installment_payments').select('transaction_id,plan_id,installment_number')
      .eq('user_id', user.id),
  ])
  if (plans.error || payments.error) return failed('Impossibile caricare le rate', 500)
  return NextResponse.json({ plans: plans.data ?? [], payments: payments.data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, user } = await session()
  if (!user) return failed('Non autenticato', 401)
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return failed('Dati del piano rateale non validi')
  const d = parsed.data
  if (!(await allowedAccount(supabase, user, d.account_id))) return failed('Accesso non autorizzato', 403)
  const { data, error } = await supabase.rpc('create_installment_expense', {
    p_account_id: d.account_id, p_amount: d.amount, p_date: d.date,
    p_description: d.description, p_category_id: d.category_id ?? null,
    p_notes: d.notes ?? null, p_is_neutral: d.is_neutral ?? false,
    p_plan_id: d.plan_id ?? null, p_title: d.title ?? null,
    p_total_installments: d.total_installments ?? null,
    p_installment_number: d.installment_number,
  })
  if (error) {
    const conflict = error.code === '23505'
    return failed(conflict ? 'Questa rata è già registrata nel piano' : 'Impossibile salvare la rata', conflict ? 409 : 400)
  }
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { supabase, user } = await session()
  if (!user) return failed('Non autenticato', 401)
  const parsed = linkSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return failed('Dati del piano rateale non validi')
  const d = parsed.data
  const { data: transaction, error: readError } = await supabase.from('transactions')
    .select('account_id,type').eq('id', d.transaction_id).eq('user_id', user.id).maybeSingle()
  if (readError || !transaction || transaction.type !== 'expense') return failed('Spesa non trovata', 404)
  if (!(await allowedAccount(supabase, user, transaction.account_id))) return failed('Accesso non autorizzato', 403)
  const { error } = await supabase.rpc('link_installment_payment', {
    p_transaction_id: d.transaction_id, p_plan_id: d.plan_id ?? null,
    p_title: d.title ?? null, p_total_installments: d.total_installments ?? null,
    p_installment_number: d.installment_number,
  })
  if (error) return failed(error.code === '23505' ? 'Questa rata è già registrata nel piano' : 'Impossibile collegare la rata', error.code === '23505' ? 409 : 400)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const { supabase, user } = await session()
  if (!user) return failed('Non autenticato', 401)
  const parsed = unlinkSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return failed('Movimento non valido')
  const { data: transaction } = await supabase.from('transactions')
    .select('account_id').eq('id', parsed.data.transaction_id).eq('user_id', user.id).maybeSingle()
  if (!transaction) return failed('Movimento non trovato', 404)
  if (!(await allowedAccount(supabase, user, transaction.account_id))) return failed('Accesso non autorizzato', 403)
  const { error } = await supabase.rpc('unlink_installment_payment', { p_transaction_id: parsed.data.transaction_id })
  if (error) return failed('Impossibile scollegare la rata', 400)
  return NextResponse.json({ success: true })
}
