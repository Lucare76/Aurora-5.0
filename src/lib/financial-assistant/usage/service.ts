import { calculateAiRequestCost } from '../pricing/calculator'
import type { AIUsageRecord, AiUsageApiResponse, AiUsageSummary } from './types'

type SupabaseLike = {
  from: (table: string) => any
  rpc?: (name: string, args: Record<string, unknown>) => any
}

type AiUsageRow = {
  provider: string
  model: string
  usage_date: string
  request_count: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost_usd: number | null
  last_request_at: string | null
}

export async function recordAiUsage(params: {
  supabase: SupabaseLike
  userId: string
  usage: AIUsageRecord
  now?: Date
}): Promise<void> {
  const cost = calculateAiRequestCost({
    provider: params.usage.provider,
    model: params.usage.model,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
  })

  const usageDate = toDateOnly(params.now ?? new Date())
  const rpc = params.supabase.rpc
  if (!rpc) return
  const { error } = await rpc('increment_ai_usage_daily', {
    p_user_id: params.userId,
    p_provider: params.usage.provider,
    p_model: params.usage.model,
    p_usage_date: usageDate,
    p_input_tokens: params.usage.inputTokens,
    p_output_tokens: params.usage.outputTokens,
    p_total_tokens: params.usage.totalTokens,
    p_estimated_cost_usd: cost.totalCost,
  })
  if (error) {
    throw new Error('AI usage non registrato.')
  }
}

export async function fetchAiUsageSummary(params: {
  supabase: SupabaseLike
  userId: string
  now?: Date
}): Promise<AiUsageApiResponse> {
  const now = params.now ?? new Date()
  const today = toDateOnly(now)
  const monthStart = toDateOnly(new Date(now.getFullYear(), now.getMonth(), 1))

  const { data, error } = await params.supabase
    .from('ai_usage_daily')
    .select('provider,model,usage_date,request_count,input_tokens,output_tokens,total_tokens,estimated_cost_usd,last_request_at')
    .eq('user_id', params.userId)
    .gte('usage_date', monthStart)
    .lte('usage_date', today)
    .order('usage_date', { ascending: false })

  if (error) throw new Error('Utilizzo AI non disponibile.')
  const rows = (data ?? []) as AiUsageRow[]
  return {
    today: summarize(rows.filter((row) => row.usage_date === today)),
    currentMonth: summarize(rows),
    pricingNote: 'Il costo mostrato è una stima calcolata sui token registrati da Aurora. La fatturazione effettiva resta quella del provider.',
  }
}

export function summarize(rows: AiUsageRow[]): AiUsageSummary {
  const requestCount = rows.reduce((sum, row) => sum + Number(row.request_count ?? 0), 0)
  const inputTokens = rows.reduce((sum, row) => sum + Number(row.input_tokens ?? 0), 0)
  const outputTokens = rows.reduce((sum, row) => sum + Number(row.output_tokens ?? 0), 0)
  const totalTokens = rows.reduce((sum, row) => sum + Number(row.total_tokens ?? 0), 0)
  const hasUnknownCost = rows.some((row) => row.estimated_cost_usd == null)
  const estimatedCost = hasUnknownCost
    ? null
    : roundUsd(rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0))
  const providers = [...new Set(rows.map((row) => row.provider))].sort()
  const models = [...new Set(rows.map((row) => row.model))].sort()
  const lastRequestAt = rows
    .map((row) => row.last_request_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null

  return {
    requestCount,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    currency: 'USD',
    providers,
    models,
    lastRequestAt,
  }
}

function toDateOnly(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}
