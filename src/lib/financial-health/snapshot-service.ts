import type { SupabaseClient } from '@supabase/supabase-js'
import { FINANCIAL_HEALTH_CALCULATION_VERSION } from './constants'
import type { FinancialHealthResult } from './types'

export type FinancialHealthSnapshot = {
  id: string
  user_id: string
  period_key: string
  period_start: string
  period_end: string
  total_score: number | null
  level: string | null
  is_provisional: boolean
  data_quality: string
  observed_weight: number
  metrics: Record<string, unknown>
  component_scores: Record<string, unknown>
  factors: Record<string, unknown>[]
  recommendations: Record<string, unknown>[]
  calculation_version: string
  calculated_at: string
  created_at: string
  updated_at: string
}

export async function listFinancialHealthSnapshots(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinancialHealthSnapshot[]> {
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from('financial_health_snapshots')
    .select('id,user_id,period_key,period_start,period_end,total_score,level,is_provisional,data_quality,observed_weight,metrics,component_scores,factors,recommendations,calculation_version,calculated_at,created_at,updated_at')
    .eq('user_id', userId)
    .order('period_start', { ascending: false })
    .limit(24)

  if (error) throw error
  return (data ?? []) as FinancialHealthSnapshot[]
}

export async function saveFinancialHealthSnapshot(
  supabase: SupabaseClient,
  userId: string,
  result: FinancialHealthResult,
): Promise<FinancialHealthSnapshot> {
  const row = {
    user_id: userId,
    period_key: result.period.key,
    period_start: result.period.from,
    period_end: result.period.to,
    total_score: result.totalScore,
    level: result.level,
    is_provisional: result.isProvisional,
    data_quality: result.dataQuality.level,
    observed_weight: result.observedWeight,
    metrics: result.metrics,
    component_scores: result.componentScores,
    factors: [...result.positiveFactors, ...result.negativeFactors, ...result.neutralFactors],
    recommendations: result.recommendations,
    calculation_version: FINANCIAL_HEALTH_CALCULATION_VERSION,
    calculated_at: result.calculatedAt,
  }

  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from('financial_health_snapshots')
    .upsert(row, { onConflict: 'user_id,period_key,calculation_version' })
    .select('id,user_id,period_key,period_start,period_end,total_score,level,is_provisional,data_quality,observed_weight,metrics,component_scores,factors,recommendations,calculation_version,calculated_at,created_at,updated_at')
    .single()

  if (error) throw error
  return data as FinancialHealthSnapshot
}
