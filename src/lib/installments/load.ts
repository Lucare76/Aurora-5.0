import type { SupabaseClient } from '@supabase/supabase-js'
import type { InstallmentPayment, InstallmentPlan } from './schedule'

export const INSTALLMENT_PLAN_SELECT = 'id,title,total_installments,created_at,schedule'

export async function loadInstallments(supabase: SupabaseClient, userId: string) {
  const [plans, payments] = await Promise.all([
    supabase.from('installment_plans').select(INSTALLMENT_PLAN_SELECT).eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('installment_payments')
      .select('transaction_id,plan_id,installment_number,transaction:transactions!inner(account_id,category_id,amount,date,description,recurring_id)')
      .eq('user_id', userId),
  ])
  if (plans.error || payments.error) throw new Error('Impossibile caricare le rate')
  const data = (payments.data ?? []) as unknown as InstallmentPayment[]
  const active = new Set(data.map((p) => p.plan_id))
  return { plans: ((plans.data ?? []) as unknown as InstallmentPlan[]).filter((p) => active.has(p.id)), payments: data }
}
