import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { filterPersonalAccounts } from '@/lib/dependent-finance/calculations'
import {
  generateRecurringEvents,
  buildFinancialCalendarPeriod,
} from '@/lib/financial-calendar/calculations'
import type {
  CalendarAccountInput,
  CalendarRecurringInput,
} from '@/lib/financial-calendar/types'
import { loadInstallments } from '@/lib/installments/load'
import { addInstallmentEvents } from '@/lib/installments/schedule'
import { calculateSeasonalPlan } from './engine'
import {
  emptyPlan,
  monthKeys,
  seasonalPlanSchema,
  type SeasonalPlan,
} from './schema'
export function romeToday(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
}
export async function seasonalContext(
  client: SupabaseClient,
  userId: string,
  today = romeToday(),
) {
  const [accounts, links, recurring, installments, transactions] =
    await Promise.all([
      client
        .from('accounts')
        .select('id,name,type,balance,currency,is_active,is_hidden,updated_at')
        .eq('user_id', userId),
      client
        .from('account_purpose_links')
        .select('account_id,purpose')
        .eq('user_id', userId),
      client
        .from('recurring_rules')
        .select(
          'id,account_id,category_id,type,amount,description,frequency,start_date,end_date,next_due_date,last_run_date,is_active,auto_create',
        )
        .eq('user_id', userId),
      loadInstallments(client, userId),
      client
        .from('transactions')
        .select('recurring_id,date')
        .eq('user_id', userId)
        .gte('date', today)
        .not('recurring_id', 'is', null),
    ])
  if (accounts.error || links.error || recurring.error || transactions.error)
    throw new Error('Lettura previsioni non riuscita')
  const eligible = filterPersonalAccounts(
    (accounts.data ?? []) as Array<
      CalendarAccountInput & { updated_at?: string }
    >,
    links.data ?? [],
  ).filter(
    (a) =>
      a.is_active &&
      ['checking', 'savings', 'cash', 'credit'].includes(a.type) &&
      a.currency === 'EUR',
  )
  const rules = (recurring.data ?? []) as CalendarRecurringInput[]
  return {
    today,
    accounts: eligible,
    rules,
    installments,
    posted: transactions.data ?? [],
  }
}
export type SeasonalContext = Awaited<ReturnType<typeof seasonalContext>>
export function forecastPlan(plan: SeasonalPlan, context: SeasonalContext) {
  const selected = context.accounts.filter((a) =>
    plan.account_ids.includes(a.id),
  )
  const ids = new Set(selected.map((a) => a.id))
  const last = monthKeys(context.today)[11]
  const [y, m] = last.split('-').map(Number)
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const period = buildFinancialCalendarPeriod(context.today, to)
  const recurring = generateRecurringEvents({
    rules: context.rules.filter(
      (r) => ids.has(r.account_id) && r.type === 'expense',
    ),
    accounts: selected,
    categories: [],
    period,
    today: context.today,
  }).filter(
    (e) =>
      !context.posted.some(
        (t) => t.recurring_id === e.sourceId && t.date === e.date,
      ),
  )
  const automatic = addInstallmentEvents({
    ...context.installments,
    events: recurring,
    accounts: selected,
    categories: [],
    from: context.today,
    to,
    today: context.today,
  })
  const forecast = calculateSeasonalPlan({
    plan,
    today: context.today,
    openingBalance: selected.reduce((s, a) => s + Number(a.balance), 0),
    automatic,
    unavailableAccounts:
      selected.length !== plan.account_ids.length ||
      context.accounts.some(
        (a) => a.type === 'credit' && Number(a.balance) < 0 && !ids.has(a.id),
      ),
  })
  return {
    forecast,
    accounts: context.accounts,
    automaticCommitments: automatic
      .filter((e) => e.direction === 'EXPENSE')
      .map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        amount: e.amount,
        source: e.sourceType,
      })),
    updatedAt: new Date().toISOString(),
  }
}
export async function loadSeasonalPlan(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('seasonal_cash_plans')
    .select('config,balance_signature')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error('Lettura piano non riuscita')
  return data
    ? {
        plan: seasonalPlanSchema.parse(data.config),
        signature: data.balance_signature as string | null,
      }
    : null
}
export async function getSeasonalPayload(
  client: SupabaseClient,
  userId: string,
) {
  const [context, saved] = await Promise.all([
    seasonalContext(client, userId),
    loadSeasonalPlan(client, userId),
  ])
  const plan =
    saved?.plan ??
    emptyPlan(
      context.today,
      context.accounts
        .filter(
          (a) => !a.is_hidden || (a.type === 'credit' && Number(a.balance) < 0),
        )
        .map((a) => a.id),
    )
  const { needsReview, plan: checkedPlan } = saved
    ? reviewSavedPlan(plan, saved.signature, context)
    : { needsReview: false, plan }
  return {
    plan: checkedPlan,
    saved: Boolean(saved),
    needsReview,
    reviewSignature: balanceSignature(plan, context),
    ...forecastPlan(checkedPlan, context),
  }
}

export function balanceSignature(plan: SeasonalPlan, context: SeasonalContext) {
  const selected = context.accounts
    .filter((a) => plan.account_ids.includes(a.id))
    .map((a) => [a.id, String(a.balance), a.updated_at ?? ''])
    .sort((a, b) => a[0].localeCompare(b[0]))
  return createHash('sha256').update(JSON.stringify(selected)).digest('hex')
}

export function reviewSavedPlan(
  plan: SeasonalPlan,
  savedSignature: string | null,
  context: SeasonalContext,
) {
  const needsReview =
    plan.reviewed && savedSignature !== balanceSignature(plan, context)
  return {
    needsReview,
    plan: needsReview ? { ...plan, reviewed: false } : plan,
  }
}
