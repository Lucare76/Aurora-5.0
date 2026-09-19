import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDashboardPayload, type DashboardInsight } from '@/lib/dashboard/service'
import type {
  FinancialClosurePreview,
  FinancialJournalPayload,
  FinancialMonthClosure,
  FinancialTimelineEvent,
  JournalInsight,
  JournalInsightTone,
} from './types'

type PatrimonioSnapshotRow = {
  id: string
  consolidated_value: number | string
  observed_at: string
}

type ExternalAssetRow = {
  id: string
  name: string
  current_value: number | string
  include_in_net_worth: boolean
  updated_at: string
  last_synced_at: string | null
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function dashboardInsightTone(type: DashboardInsight['type']): JournalInsightTone {
  if (['category_down', 'savings_up', 'best_month', 'net_worth_up', 'daily_avg_down'].includes(type)) return 'POSITIVE'
  if (['category_up', 'savings_down', 'worst_month', 'net_worth_down', 'budget_warning', 'daily_avg_up'].includes(type)) return 'WARNING'
  return 'INFO'
}

export function buildJournalInsights(params: {
  dashboardInsights: DashboardInsight[]
  staleInvestmentCount: number
  savings: number
  previousSavings: number | null
  consolidatedNetWorth: number
  previousNetWorth: number | null
}): JournalInsight[] {
  const insights: JournalInsight[] = params.dashboardInsights.map((item, index) => ({
    id: `dashboard-${item.type}-${index}`,
    tone: dashboardInsightTone(item.type),
    title: item.type === 'budget_warning' ? 'Budget da controllare' : 'Andamento del mese',
    message: item.message,
    href: item.type === 'budget_warning' ? '/budgets' : '/dashboard',
  }))

  if (params.previousSavings !== null) {
    const difference = round2(params.savings - params.previousSavings)
    if (Math.abs(difference) >= 50) {
      insights.unshift({
        id: 'savings-vs-last-close',
        tone: difference > 0 ? 'POSITIVE' : 'WARNING',
        title: difference > 0 ? 'Risparmio in miglioramento' : 'Risparmio in calo',
        message: `Il margine è ${Math.abs(difference).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} ${difference > 0 ? 'più alto' : 'più basso'} dell’ultima chiusura.`,
        href: '/reports?type=MONTHLY',
      })
    }
  }

  if (params.previousNetWorth !== null && params.previousNetWorth > 0) {
    const change = ((params.consolidatedNetWorth - params.previousNetWorth) / params.previousNetWorth) * 100
    if (Math.abs(change) >= 0.5) {
      insights.unshift({
        id: 'patrimony-vs-last-close',
        tone: change > 0 ? 'POSITIVE' : 'WARNING',
        title: change > 0 ? 'Patrimonio in crescita' : 'Patrimonio in diminuzione',
        message: `Variazione del ${Math.abs(change).toFixed(1).replace('.', ',')}% rispetto all’ultima chiusura mensile.`,
        href: '/patrimonio',
      })
    }
  }

  if (params.staleInvestmentCount > 0) {
    insights.unshift({
      id: 'stale-investments',
      tone: 'WARNING',
      title: 'Investimenti da aggiornare',
      message: `${params.staleInvestmentCount} ${params.staleInvestmentCount === 1 ? 'investimento non è aggiornato' : 'investimenti non sono aggiornati'} da più di 7 giorni.`,
      href: '/patrimonio',
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'all-quiet',
      tone: 'INFO',
      title: 'Nessuna anomalia rilevante',
      message: 'I dati del mese non mostrano variazioni che richiedono attenzione.',
      href: '/dashboard',
    })
  }

  return insights.slice(0, 8)
}

function normalizeClosure(row: Record<string, unknown>): FinancialMonthClosure {
  return {
    id: String(row.id),
    period_key: String(row.period_key),
    period_start: String(row.period_start),
    period_end: String(row.period_end),
    income: Number(row.income ?? 0),
    expenses: Number(row.expenses ?? 0),
    savings: Number(row.savings ?? 0),
    savings_rate: row.savings_rate == null ? null : Number(row.savings_rate),
    account_net_worth: Number(row.account_net_worth ?? 0),
    consolidated_net_worth: Number(row.consolidated_net_worth ?? 0),
    investment_value: Number(row.investment_value ?? 0),
    transaction_count: Number(row.transaction_count ?? 0),
    top_expense_category: row.top_expense_category ? String(row.top_expense_category) : null,
    top_expense_amount: Number(row.top_expense_amount ?? 0),
    generated_insights: Array.isArray(row.generated_insights) ? row.generated_insights as JournalInsight[] : [],
    closed_at: String(row.closed_at),
  }
}

export function buildFinancialTimeline(
  closures: FinancialMonthClosure[],
  patrimonioSnapshots: PatrimonioSnapshotRow[],
  monthEvents: Array<{ date: string; type: string; label: string; amount?: number }>,
): FinancialTimelineEvent[] {
  const events: FinancialTimelineEvent[] = closures.map((closure) => ({
    id: `closure-${closure.id}`,
    date: closure.closed_at,
    type: 'CLOSURE',
    title: `Chiusura ${closure.period_key}`,
    description: `Risparmio ${closure.savings.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} · patrimonio ${closure.consolidated_net_worth.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`,
    amount: closure.savings,
    tone: closure.savings >= 0 ? 'POSITIVE' : 'WARNING',
  }))

  const snapshots = [...patrimonioSnapshots].sort((a, b) => a.observed_at.localeCompare(b.observed_at))
  for (let index = 1; index < snapshots.length; index += 1) {
    const current = snapshots[index]
    const previous = snapshots[index - 1]
    const difference = round2(Number(current.consolidated_value) - Number(previous.consolidated_value))
    if (Math.abs(difference) < 1) continue
    events.push({
      id: `patrimony-${current.id}`,
      date: current.observed_at,
      type: 'PATRIMONY',
      title: difference > 0 ? 'Patrimonio aumentato' : 'Patrimonio diminuito',
      description: `Da ${Number(previous.consolidated_value).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} a ${Number(current.consolidated_value).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`,
      amount: difference,
      tone: difference > 0 ? 'POSITIVE' : 'WARNING',
    })
  }

  for (const event of monthEvents) {
    if (event.type === 'month_open' || event.type === 'month_close') continue
    events.push({
      id: `month-${event.type}-${event.date}-${event.label}`,
      date: event.date,
      type: event.type === 'biggest_income' ? 'INCOME' : event.type === 'budget_exceeded' ? 'BUDGET' : 'EXPENSE',
      title: event.type === 'biggest_income' ? 'Entrata principale del mese' : event.type === 'budget_exceeded' ? 'Budget superato' : 'Uscita principale del mese',
      description: event.label,
      amount: event.amount ?? null,
      tone: event.type === 'biggest_income' ? 'POSITIVE' : 'WARNING',
    })
  }

  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
}

export async function buildFinancialJournalPayload(supabase: SupabaseClient, userId: string): Promise<FinancialJournalPayload> {
  const dashboard = await buildDashboardPayload(supabase)
  const [closuresRes, snapshotsRes, assetsRes] = await Promise.all([
    supabase.from('financial_month_closures').select('*').eq('user_id', userId).order('period_start', { ascending: false }).limit(24),
    supabase.from('patrimonio_snapshots').select('id,consolidated_value,observed_at').eq('user_id', userId).order('observed_at', { ascending: false }).limit(90),
    supabase.from('external_assets').select('id,name,current_value,include_in_net_worth,updated_at,last_synced_at').eq('user_id', userId),
  ])
  if (closuresRes.error) throw closuresRes.error
  if (snapshotsRes.error) throw snapshotsRes.error
  if (assetsRes.error) throw assetsRes.error

  const closures = (closuresRes.data ?? []).map((row) => normalizeClosure(row as Record<string, unknown>))
  const snapshots = (snapshotsRes.data ?? []) as PatrimonioSnapshotRow[]
  const assets = (assetsRes.data ?? []) as ExternalAssetRow[]
  const now = Date.now()
  const staleInvestmentCount = assets.filter((asset) => {
    const updated = new Date(asset.last_synced_at ?? asset.updated_at).getTime()
    return !Number.isFinite(updated) || now - updated > 7 * 86400000
  }).length
  const investmentValue = round2(assets.reduce((sum, asset) => sum + Number(asset.current_value ?? 0), 0))
  const latestPatrimonio = snapshots[0] ? Number(snapshots[0].consolidated_value) : dashboard.netWorth
  const periodKey = `${dashboard.currentMonth.year}-${String(dashboard.currentMonth.month).padStart(2, '0')}`
  const previousClosure = closures.find((closure) => closure.period_key !== periodKey) ?? null
  const periodStart = `${periodKey}-01`
  const periodEnd = new Date(dashboard.currentMonth.year, dashboard.currentMonth.month, 0).toLocaleDateString('en-CA')
  const savingsRate = dashboard.monthIncome > 0 ? round2((dashboard.monthBalance / dashboard.monthIncome) * 100) : null
  const insights = buildJournalInsights({
    dashboardInsights: dashboard.insights,
    staleInvestmentCount,
    savings: dashboard.monthBalance,
    previousSavings: previousClosure?.savings ?? null,
    consolidatedNetWorth: latestPatrimonio,
    previousNetWorth: previousClosure?.consolidated_net_worth ?? null,
  })
  const preview: FinancialClosurePreview = {
    period_key: periodKey,
    period_start: periodStart,
    period_end: periodEnd,
    income: dashboard.monthIncome,
    expenses: dashboard.monthExpense,
    savings: dashboard.monthBalance,
    savings_rate: savingsRate,
    account_net_worth: dashboard.netWorth,
    consolidated_net_worth: latestPatrimonio,
    investment_value: investmentValue,
    transaction_count: dashboard.monthStats.txCount,
    top_expense_category: dashboard.topCategories[0]?.name ?? null,
    top_expense_amount: dashboard.topCategories[0]?.total ?? 0,
    generated_insights: insights,
  }

  return {
    preview,
    closures,
    insights,
    timeline: buildFinancialTimeline(closures, snapshots, dashboard.timeline),
    staleInvestmentCount,
    generatedAt: new Date().toISOString(),
  }
}

export async function saveFinancialMonthClosure(supabase: SupabaseClient, userId: string, preview: FinancialClosurePreview): Promise<FinancialMonthClosure> {
  const { data, error } = await supabase.from('financial_month_closures').upsert({
    user_id: userId,
    ...preview,
    closed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,period_key' }).select('*').single()
  if (error) throw error
  return normalizeClosure(data as Record<string, unknown>)
}
