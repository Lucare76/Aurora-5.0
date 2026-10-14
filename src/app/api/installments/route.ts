import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { allowedInstallmentAccount as allowedAccount } from '@/lib/installments/access'
import { loadInstallments } from '@/lib/installments/load'
import { installmentScheduleSchema } from '@/lib/installments/schema'
import { latestPayment } from '@/lib/installments/schedule'

export const dynamic = 'force-dynamic'

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

const editSchema = z.object({
  transaction_id: id,
  account_id: id,
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().finite().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1),
  category_id: id.nullable().optional(),
  notes: z.string().nullable().optional(),
  destination_account_id: id.nullable().optional(),
  clear_category: z.boolean().optional(),
  is_neutral: z.boolean().optional(),
  installment_mode: z.enum(['none', 'new', 'existing']),
  plan_id: id.nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  total_installments: z.number().int().min(2).max(360).optional(),
  installment_number: z.number().int().min(1).max(360).optional(),
}).refine((d) => d.installment_mode === 'none' ||
  d.type === 'expense' && Boolean(d.installment_number) &&
  (d.installment_mode === 'existing' ? Boolean(d.plan_id) : Boolean(d.title && d.total_installments)), {
  message: 'Dati del piano rateale non validi',
})
const unlinkSchema = z.object({ transaction_id: id })

async function session() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function failed(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  const { supabase, user } = await session()
  if (!user) return failed('Non autenticato', 401)
  try {
    const data = await loadInstallments(supabase, user.id)
    const accounts = [...new Set(data.payments.flatMap((p) => p.transaction ? [p.transaction.account_id] : []))]
    const access = await Promise.all(accounts.map(async (account) => [account, await allowedAccount(supabase, user, account)] as const))
    const allowed = new Set(access.filter(([, ok]) => ok).map(([account]) => account))
    const payments = data.payments.filter((p) => p.transaction && allowed.has(p.transaction.account_id))
    const plans = data.plans.filter((plan) => data.payments.filter((p) => p.plan_id === plan.id).every((p) => p.transaction && allowed.has(p.transaction.account_id)))
    const ids = new Set(plans.map((plan) => plan.id))
    return NextResponse.json({ plans, payments: payments.filter((p) => ids.has(p.plan_id)) })
  } catch { return failed('Impossibile caricare le rate', 500) }
}

export async function PUT(request: Request) {
  const { supabase, user } = await session()
  if (!user) return failed('Non autenticato', 401)
  const parsed = z.object({ plan_id: id, schedule: installmentScheduleSchema.nullable() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return failed('Controlla importo, frequenza, data e numero della rata')
  try {
    const data = await loadInstallments(supabase, user.id)
    const plan = data.plans.find((p) => p.id === parsed.data.plan_id)
    const transaction = latestPayment(parsed.data.plan_id, data.payments)?.transaction
    if (!plan || !transaction) return failed('Piano non trovato', 404)
    for (const payment of data.payments.filter((p) => p.plan_id === plan.id)) {
      if (!payment.transaction || !await allowedAccount(supabase, user, payment.transaction.account_id)) return failed('Accesso non autorizzato', 403)
    }
    if (parsed.data.schedule && parsed.data.schedule.first_installment_number > plan.total_installments) return failed('Numero della rata oltre il totale del piano')
    const { error } = await supabase.rpc('update_installment_schedule', { p_plan_id: plan.id, p_schedule: parsed.data.schedule })
    if (error) return failed('Impossibile salvare la pianificazione')
    return NextResponse.json({ success: true })
  } catch { return failed('Impossibile caricare il piano', 500) }
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
  const parsed = editSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return failed('Dati del movimento rateale non validi')
  const d = parsed.data
  const { data: current, error: readError } = await supabase.from('transactions')
    .select('account_id').eq('id', d.transaction_id).eq('user_id', user.id).maybeSingle()
  if (readError || !current) return failed('Movimento non trovato', 404)
  if (!(await allowedAccount(supabase, user, current.account_id)) ||
      !(await allowedAccount(supabase, user, d.account_id)) ||
      (d.destination_account_id && !(await allowedAccount(supabase, user, d.destination_account_id))))
    return failed('Accesso non autorizzato', 403)
  const { data, error } = await supabase.rpc('update_installment_transaction', {
    p_transaction_id: d.transaction_id, p_account_id: d.account_id,
    p_type: d.type, p_amount: d.amount, p_date: d.date, p_description: d.description,
    p_category_id: d.category_id ?? null, p_notes: d.notes ?? null,
    p_destination_account_id: d.destination_account_id ?? null,
    p_clear_category: d.clear_category ?? false, p_is_neutral: d.is_neutral ?? false,
    p_plan_id: d.installment_mode === 'existing' ? d.plan_id : null,
    p_title: d.installment_mode === 'new' ? d.title : null,
    p_total_installments: d.installment_mode === 'new' ? d.total_installments : null,
    p_installment_number: d.installment_mode === 'none' ? null : d.installment_number,
    p_unlink: d.installment_mode === 'none',
  })
  if (error) return failed(error.code === '23505' ? 'Questa rata è già registrata nel piano' : 'Impossibile aggiornare il movimento rateale', error.code === '23505' ? 409 : 400)
  return NextResponse.json({ data })
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
