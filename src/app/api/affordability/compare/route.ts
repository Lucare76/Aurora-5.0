import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { affordabilityInputSchema } from '@/lib/affordability/validation'
import { carInputSchemaFull } from '@/lib/affordability/car/validation'
import { homeInputSchema } from '@/lib/affordability/home/validation'
import { travelInputSchema } from '@/lib/affordability/travel/validation'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { CarInput } from '@/lib/affordability/car/types'
import type { HomeInput } from '@/lib/affordability/home/types'
import type { TravelInput } from '@/lib/affordability/travel/types'
import type { AffordabilityInput } from '@/lib/affordability/types'
import { adaptGenericScenario } from '@/lib/decision-comparison/adapters/generic-adapter'
import { adaptCarScenario } from '@/lib/decision-comparison/adapters/car-adapter'
import { adaptHomeScenario } from '@/lib/decision-comparison/adapters/home-adapter'
import { adaptTravelScenario } from '@/lib/decision-comparison/adapters/travel-adapter'
import { compareDecisions } from '@/lib/decision-comparison/engine'
import { DecisionComparisonError } from '@/lib/decision-comparison/types'
import { MIN_SCENARIOS, MAX_SCENARIOS } from '@/lib/decision-comparison/constants'
import { filterPersonalAccounts, filterPersonalTransactions, getDependentAccountIds } from '@/lib/dependent-finance/calculations'
import type {
  ComparisonProfile,
  DecisionComparisonErrorCode,
  NormalizedScenario,
} from '@/lib/decision-comparison/types'

export const dynamic = 'force-dynamic'

// ── Response helpers ────────────────────────────────────────────────────────

function errorJson(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

function successJson(data: unknown) {
  return NextResponse.json({ data }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}

// ── Request schema ───────────────────────────────────────────────────────────
//
// Scenarios carry the SAME raw domain input already validated by the
// dedicated /api/affordability/{car,home,travel}/calculate routes — the
// comparison never accepts a precomputed result from the client. Metrics are
// always derived server-side by re-running the Sprint 24A adapters against
// the caller's own financial data.

const PROFILE_VALUES = [
  'BALANCED',
  'PROTECT_LIQUIDITY',
  'REDUCE_TOTAL_COST',
  'REDUCE_MONTHLY_COMMITMENT',
  'AVOID_DEBT',
  'PRESERVE_EMERGENCY_FUND',
  'CUSTOM',
] as const

const profileSchema = z.enum(PROFILE_VALUES)

const scenarioLabelSchema = z.string().min(1, 'Etichetta non valida').max(120, 'Etichetta troppo lunga').nullable().optional()
const scenarioIdSchema = z.string().min(1, 'ID scenario richiesto').max(64, 'ID scenario troppo lungo')

const scenarioSchema = z.discriminatedUnion('domain', [
  z.object({ id: scenarioIdSchema, domain: z.literal('generic'), label: scenarioLabelSchema, input: affordabilityInputSchema }),
  z.object({ id: scenarioIdSchema, domain: z.literal('car'), label: scenarioLabelSchema, input: carInputSchemaFull }),
  z.object({ id: scenarioIdSchema, domain: z.literal('home'), label: scenarioLabelSchema, input: homeInputSchema }),
  z.object({ id: scenarioIdSchema, domain: z.literal('travel'), label: scenarioLabelSchema, input: travelInputSchema }),
])

const compareRequestSchema = z
  .object({
    scenarios: z
      .array(scenarioSchema)
      .min(MIN_SCENARIOS, `Servono almeno ${MIN_SCENARIOS} scenari per un confronto.`)
      .max(MAX_SCENARIOS, `Non è possibile confrontare più di ${MAX_SCENARIOS} scenari.`),
    profile: profileSchema,
    customWeights: z.record(z.string(), z.number()).nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = data.scenarios.map((s) => s.id)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scenarios'], message: 'Gli ID degli scenari devono essere univoci.' })
    }
    if (data.profile === 'CUSTOM' && !data.customWeights) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customWeights'], message: 'Il profilo personalizzato richiede dei pesi.' })
    }
  })

type CompareRequest = z.infer<typeof compareRequestSchema>
type ScenarioRequest = CompareRequest['scenarios'][number]

// ── Engine error → HTTP status mapping ───────────────────────────────────────

const ENGINE_ERROR_STATUS: Record<DecisionComparisonErrorCode, number> = {
  TOO_FEW_SCENARIOS: 400,
  TOO_MANY_SCENARIOS: 400,
  INVALID_WEIGHTS: 400,
  CURRENCY_MISMATCH: 422,
  INVALID_NUMBER: 422,
  INSUFFICIENT_DATA: 422,
}

// ── Account ownership ────────────────────────────────────────────────────────

function collectAccountIds(scenarios: ScenarioRequest[]): string[] {
  const ids = new Set<string>()
  for (const scenario of scenarios) {
    const input = scenario.input as { accountId?: string | null; debitAccountId?: string | null }
    if (input.accountId) ids.add(input.accountId)
    if (input.debitAccountId) ids.add(input.debitAccountId)
  }
  return [...ids]
}

async function verifyAccountOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountIds: string[],
): Promise<boolean> {
  if (accountIds.length === 0) return true
  const { data, error } = await supabase.from('accounts').select('id').eq('user_id', userId).in('id', accountIds)
  if (error) throw error
  const owned = new Set((data ?? []).map((a) => a.id))
  return accountIds.every((id) => owned.has(id))
}

// ── Financial data ───────────────────────────────────────────────────────────

function assertQuerySucceeded(label: string, result: { error?: unknown }) {
  if (result.error) {
    throw new Error(`Supabase query failed: ${label}`)
  }
}

async function loadDbData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<AffordabilityDbData> {
  const [accountsRes, recurringRes, txRes, loansRes, loanPaymentsRes, goalsRes, contribRes, accountPurposeRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('recurring_rules').select('id,account_id,type,amount,frequency,start_date,end_date,next_due_date,is_active').eq('user_id', userId),
    supabase
      .from('transactions')
      .select('id,account_id,type,amount,date,transfer_peer_id')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(500),
    supabase.from('loans').select('id,remaining,is_settled,due_date').eq('user_id', userId),
    supabase.from('loan_payments').select('id,loan_id,amount,paid_at').eq('user_id', userId),
    supabase.from('savings_goals').select('id,name,target_amount,current_amount,target_date,status,archived').eq('user_id', userId),
    supabase.from('goal_contributions').select('id,goal_id,amount,date').eq('user_id', userId),
    supabase.from('account_purpose_links').select('account_id,purpose').eq('user_id', userId),
  ])

  assertQuerySucceeded('accounts', accountsRes)
  assertQuerySucceeded('recurring_rules', recurringRes)
  assertQuerySucceeded('transactions', txRes)
  assertQuerySucceeded('loans', loansRes)
  assertQuerySucceeded('loan_payments', loanPaymentsRes)
  assertQuerySucceeded('savings_goals', goalsRes)
  assertQuerySucceeded('goal_contributions', contribRes)

  const accountPurposeLinks = accountPurposeRes.error ? [] : (accountPurposeRes.data ?? []) as Array<{ account_id: string; purpose: string }>
  const dedicatedAccountIds = getDependentAccountIds(accountPurposeLinks)

  return {
    accounts: filterPersonalAccounts((accountsRes.data ?? []) as AffordabilityDbData['accounts'], accountPurposeLinks),
    recurringRules: ((recurringRes.data ?? []) as AffordabilityDbData['recurringRules']).filter((rule) => !rule.account_id || !dedicatedAccountIds.has(rule.account_id)),
    recentTransactions: filterPersonalTransactions((txRes.data ?? []) as AffordabilityDbData['recentTransactions'], accountPurposeLinks),
    loans: (loansRes.data ?? []) as AffordabilityDbData['loans'],
    loanPayments: (loanPaymentsRes.data ?? []) as AffordabilityDbData['loanPayments'],
    goals: (goalsRes.data ?? []) as AffordabilityDbData['goals'],
    goalContributions: (contribRes.data ?? []) as AffordabilityDbData['goalContributions'],
  }
}

// ── Scenario adaptation (Sprint 24A core only — no scoring logic here) ───────

function adaptScenario(scenario: ScenarioRequest, dbData: AffordabilityDbData, now: Date): NormalizedScenario {
  const name = scenario.label ?? undefined
  switch (scenario.domain) {
    case 'generic':
      return adaptGenericScenario({ id: scenario.id, name, input: scenario.input as AffordabilityInput, dbData, now })
    case 'car':
      return adaptCarScenario({ id: scenario.id, name, input: scenario.input as CarInput, dbData, now })
    case 'home':
      return adaptHomeScenario({ id: scenario.id, name, input: scenario.input as HomeInput, dbData, now })
    case 'travel':
      return adaptTravelScenario({ id: scenario.id, name, input: scenario.input as TravelInput, dbData, now })
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return errorJson('UNAUTHORIZED', 'Accesso non autorizzato.', 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('INVALID_BODY', 'Corpo della richiesta non valido.', 400)
  }

  const parsed = compareRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorJson('VALIDATION_ERROR', 'Dati della richiesta non validi.', 400, parsed.error.issues)
  }

  const { scenarios: rawScenarios, profile, customWeights } = parsed.data

  try {
    const accountIds = collectAccountIds(rawScenarios)
    const ownershipOk = await verifyAccountOwnership(supabase, user.id, accountIds)
    if (!ownershipOk) {
      return errorJson('ACCOUNT_NOT_FOUND', 'Uno o più conti indicati non sono stati trovati o non sono autorizzati.', 404)
    }

    const now = new Date()
    const dbData = await loadDbData(supabase, user.id)
    const normalizedScenarios = rawScenarios.map((scenario) => adaptScenario(scenario, dbData, now))

    const result = compareDecisions(
      { scenarios: normalizedScenarios, profile: profile as ComparisonProfile, customWeights: customWeights ?? null },
      now,
    )
    return successJson(result)
  } catch (err) {
    if (err instanceof DecisionComparisonError) {
      return errorJson(err.code, err.message, ENGINE_ERROR_STATUS[err.code])
    }
    console.error('[aurora-affordability] compare', err instanceof Error ? err.message : err)
    return errorJson('CALCULATION_FAILED', 'Non è stato possibile completare il confronto. Nessun dato finanziario è stato modificato.', 500)
  }
}

export async function GET() {
  return errorJson('METHOD_NOT_ALLOWED', 'Metodo non consentito.', 405)
}
