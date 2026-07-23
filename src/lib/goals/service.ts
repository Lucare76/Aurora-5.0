import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoalContribution, SavingsGoal, SavingsGoalStatus } from '@/types/database'

export type IntelligentGoalStatus =
  | 'COMPLETED'
  | 'AHEAD'
  | 'ON_TRACK'
  | 'SLIGHTLY_BEHIND'
  | 'BEHIND'
  | 'OVERDUE'
  | 'NO_DEADLINE'
  | 'INSUFFICIENT_DATA'

export type ForecastStatus = 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'COMPLETED' | 'ZERO_PACE'
export type GoalInsightSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER'
export type GoalInsightType =
  | 'GOAL_COMPLETED'
  | 'GOAL_AHEAD'
  | 'GOAL_ON_TRACK'
  | 'GOAL_BEHIND'
  | 'GOAL_OVERDUE'
  | 'DEADLINE_AT_RISK'
  | 'CONTRIBUTION_STREAK'
  | 'CONTRIBUTION_SLOWDOWN'
  | 'CONTRIBUTION_ACCELERATION'
  | 'NO_RECENT_CONTRIBUTIONS'
  | 'NEAR_COMPLETION'
  | 'INSUFFICIENT_DATA'
  | 'MONTHLY_AMOUNT_REQUIRED'
  | 'FORECAST_AVAILABLE'

export type GoalForecast = {
  targetAmount: number
  currentAmount: number
  remainingAmount: number
  completionPercentage: number
  totalContributed: number
  contributionCount: number
  firstContributionDate: string | null
  lastContributionDate: string | null
  activeDays: number
  activeMonths: number
  averageMonthlyContribution: number
  averageContributionAmount: number
  estimatedCompletionDate: string | null
  estimatedMonthsRemaining: number | null
  hasEnoughData: boolean
  forecastStatus: ForecastStatus
}

export type GoalPace = {
  intelligentStatus: IntelligentGoalStatus
  daysRemaining: number | null
  monthsRemaining: number | null
  requiredMonthlyContribution: number | null
  requiredWeeklyContribution: number | null
  expectedProgressPercentage: number | null
  actualProgressPercentage: number
  paceDifferencePercentage: number | null
  projectedAmountAtDeadline: number | null
  projectedShortfall: number | null
  projectedSurplus: number | null
  consecutiveContributionMonths: number
  monthsWithContributionsLast6: number
  monthsWithoutContributionsLast6: number
  daysSinceLastContribution: number | null
  recentThreeMonthAverage: number | null
  previousThreeMonthAverage: number | null
  paceTrendPercentage: number | null
}

export type GoalHistoryPoint = {
  key: string
  month: string
  contributedAmount: number
  contributionCount: number
  cumulativeAmount: number
  targetAmount: number
  completionPercentage: number
}

export type GoalInsight = {
  type: GoalInsightType
  severity: GoalInsightSeverity
  title: string
  message: string
  metadata?: Record<string, unknown>
}

export type GoalProgress = SavingsGoal & {
  remainingAmount: number
  completionPercentage: number
  intelligentStatus?: IntelligentGoalStatus
  forecast?: GoalForecast
  pace?: GoalPace
  primaryInsight?: GoalInsight | null
  estimatedCompletionDate?: string | null
  requiredMonthlyContribution?: number | null
}

export type GoalSummary = {
  totalGoals: number
  activeGoals: number
  completedGoals: number
  targetAmount: number
  savedAmount: number
  remainingAmount: number
  completionPercentage: number
  nearestGoal: GoalProgress | null
  goalsOnTrack: number
  goalsBehind: number
  overdueGoals: number
  nearestDeadlineGoal: GoalProgress | null
  nearestCompletionGoal: GoalProgress | null
  totalRequiredMonthlyContribution: number
  primaryGoalsInsight: GoalInsight | null
}

export type GoalDetail = {
  goal: GoalProgress
  contributions: GoalContribution[]
  contributionCount: number
  summary: GoalSummary
  forecast: GoalForecast
  pace: GoalPace
  history: GoalHistoryPoint[]
  insights: GoalInsight[]
}

export type CreateGoalInput = {
  userId: string
  name: string
  targetAmount: number
  targetDate?: string | null
  icon?: string | null
  color?: string | null
  notes?: string | null
}

export type UpdateGoalInput = Partial<Omit<CreateGoalInput, 'userId'>> & {
  status?: SavingsGoalStatus
  archived?: boolean
}

const AVG_DAYS_PER_MONTH = 30.4375
const AVG_DAYS_PER_WEEK = 7
const MONTH_LABELS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function todayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function monthsBetweenEquivalent(start: Date, end: Date): number {
  return Math.max(daysBetween(start, end) / AVG_DAYS_PER_MONTH, 0)
}

function eur(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Math.abs(round2(n)))
}

function normalizeContribution(row: GoalContribution): GoalContribution {
  return { ...row, amount: round2(Number(row.amount)) }
}

function normalizeGoal(row: SavingsGoal): GoalProgress {
  const target = Number(row.target_amount)
  const current = Number(row.current_amount)
  return {
    ...row,
    target_amount: round2(target),
    current_amount: round2(current),
    remainingAmount: round2(Math.max(target - current, 0)),
    completionPercentage: target > 0 ? Math.round((current / target) * 100) : 0,
  }
}

function sortGoals(a: GoalProgress, b: GoalProgress): number {
  const order: Record<SavingsGoalStatus, number> = { ACTIVE: 0, COMPLETED: 1, ARCHIVED: 2 }
  const statusDiff = order[a.status] - order[b.status]
  if (statusDiff !== 0) return statusDiff
  if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date)
  if (a.target_date) return -1
  if (b.target_date) return 1
  return a.created_at.localeCompare(b.created_at)
}

function groupContributionsByGoal(contributions: GoalContribution[]): Map<string, GoalContribution[]> {
  const byGoal = new Map<string, GoalContribution[]>()
  for (const contribution of contributions.map(normalizeContribution)) {
    const arr = byGoal.get(contribution.goal_id) ?? []
    arr.push(contribution)
    byGoal.set(contribution.goal_id, arr)
  }
  for (const arr of byGoal.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  }
  return byGoal
}

export function calculateAverageMonthlyContribution(contributions: GoalContribution[], now = new Date()): number {
  const sorted = contributions.map(normalizeContribution).sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) return 0
  const first = parseDate(sorted[0].date)
  const end = todayUtc(now)
  const months = Math.max(monthsBetweenEquivalent(first, end), 1 / AVG_DAYS_PER_MONTH)
  return round2(sorted.reduce((sum, row) => sum + row.amount, 0) / months)
}

export function calculateRequiredMonthlyContribution(remainingAmount: number, targetDate: string | null, now = new Date()): number | null {
  if (!targetDate) return null
  if (remainingAmount <= 0) return 0
  const today = todayUtc(now)
  const target = parseDate(targetDate)
  const days = daysBetween(today, target)
  if (days <= 0) return round2(remainingAmount)
  return round2(remainingAmount / Math.max(days / AVG_DAYS_PER_MONTH, 1 / AVG_DAYS_PER_MONTH))
}

export function calculateEstimatedCompletionDate(remainingAmount: number, averageMonthlyContribution: number, now = new Date()): string | null {
  if (remainingAmount <= 0 || averageMonthlyContribution <= 0) return null
  const monthsRemaining = remainingAmount / averageMonthlyContribution
  const estimated = todayUtc(now)
  estimated.setUTCDate(estimated.getUTCDate() + Math.ceil(monthsRemaining * AVG_DAYS_PER_MONTH))
  return isoDate(estimated)
}

export function buildGoalForecast(goalInput: SavingsGoal | GoalProgress, contributionsInput: GoalContribution[], now = new Date()): GoalForecast {
  const goal = normalizeGoal(goalInput as SavingsGoal)
  const contributions = contributionsInput.map(normalizeContribution).sort((a, b) => a.date.localeCompare(b.date))
  const totalContributed = round2(contributions.reduce((sum, row) => sum + row.amount, 0))
  const contributionCount = contributions.length
  const firstContributionDate = contributions[0]?.date ?? null
  const lastContributionDate = contributions[contributions.length - 1]?.date ?? null
  const today = todayUtc(now)
  const firstDate = firstContributionDate ? parseDate(firstContributionDate) : null
  const activeDays = firstDate ? Math.max(daysBetween(firstDate, today), 0) : 0
  const activeMonths = firstDate ? round2(Math.max(activeDays / AVG_DAYS_PER_MONTH, 1 / AVG_DAYS_PER_MONTH)) : 0
  const averageMonthlyContribution = activeMonths > 0 ? round2(totalContributed / activeMonths) : 0
  const averageContributionAmount = contributionCount > 0 ? round2(totalContributed / contributionCount) : 0
  const hasEnoughData = contributionCount >= 2 && activeDays >= 14 && averageMonthlyContribution > 0

  if (goal.remainingAmount <= 0 || goal.status === 'COMPLETED') {
    return {
      targetAmount: goal.target_amount,
      currentAmount: goal.current_amount,
      remainingAmount: goal.remainingAmount,
      completionPercentage: goal.completionPercentage,
      totalContributed,
      contributionCount,
      firstContributionDate,
      lastContributionDate,
      activeDays,
      activeMonths,
      averageMonthlyContribution,
      averageContributionAmount,
      estimatedCompletionDate: null,
      estimatedMonthsRemaining: null,
      hasEnoughData: false,
      forecastStatus: 'COMPLETED',
    }
  }

  if (!hasEnoughData) {
    return {
      targetAmount: goal.target_amount,
      currentAmount: goal.current_amount,
      remainingAmount: goal.remainingAmount,
      completionPercentage: goal.completionPercentage,
      totalContributed,
      contributionCount,
      firstContributionDate,
      lastContributionDate,
      activeDays,
      activeMonths,
      averageMonthlyContribution,
      averageContributionAmount,
      estimatedCompletionDate: null,
      estimatedMonthsRemaining: null,
      hasEnoughData: false,
      forecastStatus: averageMonthlyContribution <= 0 ? 'ZERO_PACE' : 'INSUFFICIENT_DATA',
    }
  }

  const estimatedMonthsRemaining = round2(goal.remainingAmount / averageMonthlyContribution)
  return {
    targetAmount: goal.target_amount,
    currentAmount: goal.current_amount,
    remainingAmount: goal.remainingAmount,
    completionPercentage: goal.completionPercentage,
    totalContributed,
    contributionCount,
    firstContributionDate,
    lastContributionDate,
    activeDays,
    activeMonths,
    averageMonthlyContribution,
    averageContributionAmount,
    estimatedCompletionDate: calculateEstimatedCompletionDate(goal.remainingAmount, averageMonthlyContribution, now),
    estimatedMonthsRemaining,
    hasEnoughData,
    forecastStatus: 'AVAILABLE',
  }
}

export function buildGoalHistory(
  goalInput: SavingsGoal | GoalProgress,
  contributionsInput: GoalContribution[],
  now = new Date(),
  months = 12,
): GoalHistoryPoint[] {
  const goal = normalizeGoal(goalInput as SavingsGoal)
  const contributions = contributionsInput.map(normalizeContribution)
  const start = todayUtc(now)
  start.setUTCDate(1)
  start.setUTCMonth(start.getUTCMonth() - (months - 1))

  const beforeStart = contributions
    .filter((row) => parseDate(row.date) < start)
    .reduce((sum, row) => sum + row.amount, 0)
  let cumulative = round2(beforeStart)

  return Array.from({ length: months }, (_, index) => {
    const d = new Date(start)
    d.setUTCMonth(start.getUTCMonth() + index)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const rows = contributions.filter((row) => row.date.slice(0, 7) === key)
    const contributedAmount = round2(rows.reduce((sum, row) => sum + row.amount, 0))
    cumulative = round2(cumulative + contributedAmount)
    return {
      key,
      month: MONTH_LABELS[d.getUTCMonth()],
      contributedAmount,
      contributionCount: rows.length,
      cumulativeAmount: cumulative,
      targetAmount: goal.target_amount,
      completionPercentage: goal.target_amount > 0 ? Math.round((cumulative / goal.target_amount) * 100) : 0,
    }
  })
}

function consecutiveMonths(history: GoalHistoryPoint[]): number {
  let count = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].contributedAmount <= 0) break
    count += 1
  }
  return count
}

export function determineGoalPaceStatus(params: {
  completionPercentage: number
  targetDate: string | null
  expectedProgressPercentage: number | null
  paceDifferencePercentage: number | null
  hasEnoughData: boolean
  isCompleted: boolean
  isOverdue: boolean
}): IntelligentGoalStatus {
  if (params.isCompleted) return 'COMPLETED'
  if (!params.targetDate) return params.hasEnoughData ? 'NO_DEADLINE' : 'INSUFFICIENT_DATA'
  if (params.isOverdue) return 'OVERDUE'
  if (params.paceDifferencePercentage == null) return 'INSUFFICIENT_DATA'
  if (params.paceDifferencePercentage >= 10) return 'AHEAD'
  if (params.paceDifferencePercentage >= -5) return 'ON_TRACK'
  if (params.paceDifferencePercentage >= -15) return 'SLIGHTLY_BEHIND'
  return 'BEHIND'
}

export function buildGoalPace(goalInput: SavingsGoal | GoalProgress, contributionsInput: GoalContribution[], now = new Date()): GoalPace {
  const goal = normalizeGoal(goalInput as SavingsGoal)
  const forecast = buildGoalForecast(goal, contributionsInput, now)
  const history = buildGoalHistory(goal, contributionsInput, now, 12)
  const today = todayUtc(now)
  const target = goal.target_date ? parseDate(goal.target_date) : null
  const created = parseDate(goal.created_at)
  const daysRemaining = target ? daysBetween(today, target) : null
  const monthsRemaining = target ? round2(Math.max(daysRemaining ?? 0, 0) / AVG_DAYS_PER_MONTH) : null
  const requiredMonthlyContribution = calculateRequiredMonthlyContribution(goal.remainingAmount, goal.target_date, now)
  const requiredWeeklyContribution = requiredMonthlyContribution == null ? null : round2(requiredMonthlyContribution / (AVG_DAYS_PER_MONTH / AVG_DAYS_PER_WEEK))
  const totalPeriodDays = target ? Math.max(daysBetween(created, target), 1) : null
  const elapsedDays = target ? Math.max(daysBetween(created, today), 0) : null
  const expectedProgressPercentage = target && totalPeriodDays
    ? Math.min(Math.round(((elapsedDays ?? 0) / totalPeriodDays) * 100), 100)
    : null
  const actualProgressPercentage = goal.completionPercentage
  const paceDifferencePercentage = expectedProgressPercentage == null ? null : actualProgressPercentage - expectedProgressPercentage
  const projectedAmountAtDeadline = target && forecast.hasEnoughData
    ? round2(goal.current_amount + forecast.averageMonthlyContribution * Math.max((daysRemaining ?? 0) / AVG_DAYS_PER_MONTH, 0))
    : null
  const projectedShortfall = projectedAmountAtDeadline == null ? null : round2(Math.max(goal.target_amount - projectedAmountAtDeadline, 0))
  const projectedSurplus = projectedAmountAtDeadline == null ? null : round2(Math.max(projectedAmountAtDeadline - goal.target_amount, 0))
  const lastDate = forecast.lastContributionDate ? parseDate(forecast.lastContributionDate) : null
  const daysSinceLastContribution = lastDate ? Math.max(daysBetween(lastDate, today), 0) : null
  const last6 = history.slice(-6)
  const recent3 = history.slice(-3)
  const prev3 = history.slice(-6, -3)
  const recentThreeMonthAverage = recent3.length === 3 ? round2(recent3.reduce((s, p) => s + p.contributedAmount, 0) / 3) : null
  const previousThreeMonthAverage = prev3.length === 3 ? round2(prev3.reduce((s, p) => s + p.contributedAmount, 0) / 3) : null
  const paceTrendPercentage = previousThreeMonthAverage && previousThreeMonthAverage > 0 && recentThreeMonthAverage != null
    ? Math.round(((recentThreeMonthAverage - previousThreeMonthAverage) / previousThreeMonthAverage) * 100)
    : null
  const isCompleted = goal.current_amount >= goal.target_amount || goal.status === 'COMPLETED'
  const isOverdue = Boolean(target && daysRemaining != null && daysRemaining < 0 && !isCompleted)

  return {
    intelligentStatus: determineGoalPaceStatus({
      completionPercentage: goal.completionPercentage,
      targetDate: goal.target_date,
      expectedProgressPercentage,
      paceDifferencePercentage,
      hasEnoughData: forecast.hasEnoughData,
      isCompleted,
      isOverdue,
    }),
    daysRemaining,
    monthsRemaining,
    requiredMonthlyContribution,
    requiredWeeklyContribution,
    expectedProgressPercentage,
    actualProgressPercentage,
    paceDifferencePercentage,
    projectedAmountAtDeadline,
    projectedShortfall,
    projectedSurplus,
    consecutiveContributionMonths: consecutiveMonths(history),
    monthsWithContributionsLast6: last6.filter((p) => p.contributedAmount > 0).length,
    monthsWithoutContributionsLast6: last6.filter((p) => p.contributedAmount === 0).length,
    daysSinceLastContribution,
    recentThreeMonthAverage,
    previousThreeMonthAverage,
    paceTrendPercentage,
  }
}

function insightRank(insight: GoalInsight): number {
  const severityRank: Record<GoalInsightSeverity, number> = { DANGER: 0, WARNING: 1, SUCCESS: 2, INFO: 3 }
  const typeRank: Partial<Record<GoalInsightType, number>> = {
    GOAL_OVERDUE: 0,
    DEADLINE_AT_RISK: 1,
    GOAL_BEHIND: 2,
    NO_RECENT_CONTRIBUTIONS: 3,
    NEAR_COMPLETION: 4,
    GOAL_COMPLETED: 5,
    MONTHLY_AMOUNT_REQUIRED: 6,
    FORECAST_AVAILABLE: 7,
    CONTRIBUTION_ACCELERATION: 8,
    CONTRIBUTION_SLOWDOWN: 9,
    GOAL_AHEAD: 10,
    GOAL_ON_TRACK: 11,
    INSUFFICIENT_DATA: 12,
  }
  return severityRank[insight.severity] * 100 + (typeRank[insight.type] ?? 50)
}

export function buildGoalInsights(
  goalInput: SavingsGoal | GoalProgress,
  contributionsInput: GoalContribution[],
  now = new Date(),
  maxCount = 3,
): GoalInsight[] {
  const goal = normalizeGoal(goalInput as SavingsGoal)
  const forecast = buildGoalForecast(goal, contributionsInput, now)
  const pace = buildGoalPace(goal, contributionsInput, now)
  const insights: GoalInsight[] = []
  const add = (insight: GoalInsight) => {
    if (!insights.some((item) => item.type === insight.type)) insights.push(insight)
  }

  if (pace.intelligentStatus === 'COMPLETED') {
    add({ type: 'GOAL_COMPLETED', severity: 'SUCCESS', title: 'Obiettivo completato', message: `Hai raggiunto ${goal.name} con ${eur(goal.current_amount)} accantonati.` })
  } else if (pace.intelligentStatus === 'OVERDUE') {
    add({ type: 'GOAL_OVERDUE', severity: 'DANGER', title: 'Scadenza superata', message: `La scadenza è passata e mancano ancora ${eur(goal.remainingAmount)}.` })
  } else if (pace.intelligentStatus === 'BEHIND') {
    add({ type: 'GOAL_BEHIND', severity: 'DANGER', title: 'In ritardo', message: `Sei sotto il ritmo necessario di ${Math.abs(pace.paceDifferencePercentage ?? 0)} punti percentuali.` })
  } else if (pace.intelligentStatus === 'SLIGHTLY_BEHIND') {
    add({ type: 'GOAL_BEHIND', severity: 'WARNING', title: 'Leggermente in ritardo', message: `Serve recuperare circa ${Math.abs(pace.paceDifferencePercentage ?? 0)} punti percentuali.` })
  } else if (pace.intelligentStatus === 'AHEAD') {
    add({ type: 'GOAL_AHEAD', severity: 'SUCCESS', title: 'In anticipo', message: `Sei sopra il ritmo previsto di ${pace.paceDifferencePercentage ?? 0} punti percentuali.` })
  } else if (pace.intelligentStatus === 'ON_TRACK') {
    add({ type: 'GOAL_ON_TRACK', severity: 'SUCCESS', title: 'In linea', message: 'Il ritmo attuale è coerente con la scadenza.' })
  }

  if (goal.remainingAmount <= goal.target_amount * 0.1 && goal.remainingAmount > 0) {
    add({ type: 'NEAR_COMPLETION', severity: 'SUCCESS', title: 'Quasi completato', message: `Ti mancano solo ${eur(goal.remainingAmount)} per completare l’obiettivo.` })
  }
  if (pace.daysSinceLastContribution != null && pace.daysSinceLastContribution >= 45 && goal.status !== 'COMPLETED') {
    add({ type: 'NO_RECENT_CONTRIBUTIONS', severity: 'WARNING', title: 'Nessun versamento recente', message: `Non registri versamenti da ${pace.daysSinceLastContribution} giorni.` })
  }
  if (pace.requiredMonthlyContribution != null && pace.requiredMonthlyContribution > 0 && goal.status !== 'COMPLETED') {
    add({ type: 'MONTHLY_AMOUNT_REQUIRED', severity: pace.intelligentStatus === 'BEHIND' ? 'WARNING' : 'INFO', title: 'Quota mensile necessaria', message: `Per rispettare la scadenza dovresti accantonare circa ${eur(pace.requiredMonthlyContribution)} al mese.` })
  }
  if (forecast.hasEnoughData && forecast.estimatedCompletionDate) {
    add({ type: 'FORECAST_AVAILABLE', severity: 'INFO', title: 'Previsione disponibile', message: `Con questo ritmo raggiungerai l’obiettivo intorno a ${forecast.estimatedCompletionDate}.` })
  } else if (!forecast.hasEnoughData && goal.status !== 'COMPLETED') {
    add({ type: 'INSUFFICIENT_DATA', severity: 'INFO', title: 'Dati insufficienti', message: 'Servono altri versamenti per stimare la data di completamento.' })
  }
  if (pace.paceTrendPercentage != null && Math.abs(pace.paceTrendPercentage) >= 15) {
    add({
      type: pace.paceTrendPercentage > 0 ? 'CONTRIBUTION_ACCELERATION' : 'CONTRIBUTION_SLOWDOWN',
      severity: pace.paceTrendPercentage > 0 ? 'SUCCESS' : 'WARNING',
      title: pace.paceTrendPercentage > 0 ? 'Ritmo in aumento' : 'Ritmo in calo',
      message: `Negli ultimi tre mesi il ritmo è ${pace.paceTrendPercentage > 0 ? 'aumentato' : 'diminuito'} del ${Math.abs(pace.paceTrendPercentage)}%.`,
    })
  }
  if (pace.consecutiveContributionMonths >= 3) {
    add({ type: 'CONTRIBUTION_STREAK', severity: 'SUCCESS', title: 'Buona regolarità', message: `Versamenti registrati per ${pace.consecutiveContributionMonths} mesi consecutivi.` })
  }

  return insights.sort((a, b) => insightRank(a) - insightRank(b)).slice(0, maxCount)
}

function enrichGoal(goalInput: SavingsGoal, contributions: GoalContribution[], now = new Date(), includeHistory = false): GoalProgress {
  const goal = normalizeGoal(goalInput)
  const forecast = buildGoalForecast(goal, contributions, now)
  const pace = buildGoalPace(goal, contributions, now)
  const insights = buildGoalInsights(goal, contributions, now, 1)
  return {
    ...goal,
    forecast,
    pace,
    intelligentStatus: pace.intelligentStatus,
    primaryInsight: insights[0] ?? null,
    estimatedCompletionDate: forecast.estimatedCompletionDate,
    requiredMonthlyContribution: pace.requiredMonthlyContribution,
    ...(includeHistory ? { history: buildGoalHistory(goal, contributions, now) } : {}),
  }
}

export function buildGoalsIntelligenceSummary(goalsInput: SavingsGoal[], contributionsInput: GoalContribution[] = [], now = new Date()): GoalSummary {
  const byGoal = groupContributionsByGoal(contributionsInput)
  const enriched = goalsInput.map((goal) => enrichGoal(goal, byGoal.get(goal.id) ?? [], now))
  const visible = enriched.filter((goal) => !goal.archived && goal.status !== 'ARCHIVED')
  const active = visible.filter((goal) => goal.status === 'ACTIVE')
  const completed = visible.filter((goal) => goal.status === 'COMPLETED')
  const targetAmount = round2(visible.reduce((sum, goal) => sum + goal.target_amount, 0))
  const savedAmount = round2(visible.reduce((sum, goal) => sum + goal.current_amount, 0))
  const remainingAmount = round2(Math.max(targetAmount - savedAmount, 0))
  const behindStatuses: IntelligentGoalStatus[] = ['SLIGHTLY_BEHIND', 'BEHIND']
  const nearestDeadlineGoal = [...active]
    .filter((goal) => goal.target_date)
    .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))[0] ?? null
  const nearestCompletionGoal = [...active]
    .sort((a, b) => a.remainingAmount - b.remainingAmount)[0] ?? null
  const primaryGoalsInsight =
    active.find((goal) => goal.primaryInsight?.severity === 'DANGER')?.primaryInsight ??
    active.find((goal) => goal.primaryInsight?.severity === 'WARNING')?.primaryInsight ??
    active.find((goal) => goal.primaryInsight)?.primaryInsight ??
    null

  return {
    totalGoals: visible.length,
    activeGoals: active.length,
    completedGoals: completed.length,
    targetAmount,
    savedAmount,
    remainingAmount,
    completionPercentage: targetAmount > 0 ? Math.round((savedAmount / targetAmount) * 100) : 0,
    nearestGoal: nearestDeadlineGoal,
    goalsOnTrack: active.filter((goal) => goal.intelligentStatus === 'AHEAD' || goal.intelligentStatus === 'ON_TRACK').length,
    goalsBehind: active.filter((goal) => behindStatuses.includes(goal.intelligentStatus ?? 'INSUFFICIENT_DATA')).length,
    overdueGoals: active.filter((goal) => goal.intelligentStatus === 'OVERDUE').length,
    nearestDeadlineGoal,
    nearestCompletionGoal,
    totalRequiredMonthlyContribution: round2(active.reduce((sum, goal) => sum + (goal.requiredMonthlyContribution ?? 0), 0)),
    primaryGoalsInsight,
  }
}

export function buildGoalSummary(goals: SavingsGoal[]): GoalSummary {
  return buildGoalsIntelligenceSummary(goals, [])
}

export async function listGoals(supabase: SupabaseClient): Promise<GoalProgress[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at')
    .order('created_at', { ascending: true })

  if (error) throw error
  const goals = (data ?? []) as SavingsGoal[]
  if (goals.length === 0) return []

  const { data: contributionData, error: contributionError } = await supabase
    .from('goal_contributions')
    .select('id,goal_id,user_id,amount,date,note,created_at')
    .in('goal_id', goals.map((goal) => goal.id))
    .order('date', { ascending: true })

  if (contributionError) throw contributionError
  const byGoal = groupContributionsByGoal((contributionData ?? []) as GoalContribution[])
  return goals.map((goal) => enrichGoal(goal, byGoal.get(goal.id) ?? [])).sort(sortGoals)
}

export async function createGoal(supabase: SupabaseClient, input: CreateGoalInput): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: input.userId,
      name: input.name,
      target_amount: input.targetAmount,
      target_date: input.targetDate ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return { id: data.id }
}

export async function updateGoal(supabase: SupabaseClient, goalId: string, input: UpdateGoalInput): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.targetAmount !== undefined) patch.target_amount = input.targetAmount
  if (input.targetDate !== undefined) patch.target_date = input.targetDate
  if (input.icon !== undefined) patch.icon = input.icon
  if (input.color !== undefined) patch.color = input.color
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.status !== undefined) patch.status = input.status
  if (input.archived !== undefined) patch.archived = input.archived

  const { error } = await supabase
    .from('savings_goals')
    .update(patch)
    .eq('id', goalId)

  if (error) throw error
}

export async function archiveGoal(supabase: SupabaseClient, goalId: string): Promise<void> {
  await updateGoal(supabase, goalId, { archived: true, status: 'ARCHIVED' })
}

export async function deleteGoal(supabase: SupabaseClient, goalId: string): Promise<void> {
  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('id', goalId)

  if (error) throw error
}

export async function addContribution(
  supabase: SupabaseClient,
  input: { goalId: string; userId: string; amount: number; date: string; note?: string | null },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('goal_contributions')
    .insert({
      goal_id: input.goalId,
      user_id: input.userId,
      amount: input.amount,
      date: input.date,
      note: input.note ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return { id: data.id }
}

export async function deleteContribution(supabase: SupabaseClient, contributionId: string): Promise<void> {
  const { error } = await supabase
    .from('goal_contributions')
    .delete()
    .eq('id', contributionId)

  if (error) throw error
}

export async function getGoalDetail(supabase: SupabaseClient, goalId: string): Promise<GoalDetail | null> {
  const [
    { data: goal, error: goalError },
    { data: contributions, error: contributionError, count },
    { data: allContributions, error: allContributionError },
  ] = await Promise.all([
    supabase
      .from('savings_goals')
      .select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at')
      .eq('id', goalId)
      .maybeSingle(),
    supabase
      .from('goal_contributions')
      .select('id,goal_id,user_id,amount,date,note,created_at', { count: 'exact' })
      .eq('goal_id', goalId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('goal_contributions')
      .select('id,goal_id,user_id,amount,date,note,created_at')
      .eq('goal_id', goalId)
      .order('date', { ascending: true }),
  ])

  if (goalError) throw goalError
  if (contributionError) throw contributionError
  if (allContributionError) throw allContributionError
  if (!goal) return null

  const normalizedGoal = normalizeGoal(goal as SavingsGoal)
  const allRows = ((allContributions ?? []) as GoalContribution[]).map(normalizeContribution)
  const forecast = buildGoalForecast(normalizedGoal, allRows)
  const pace = buildGoalPace(normalizedGoal, allRows)
  const history = buildGoalHistory(normalizedGoal, allRows)
  const insights = buildGoalInsights(normalizedGoal, allRows)
  const enrichedGoal: GoalProgress = {
    ...normalizedGoal,
    forecast,
    pace,
    intelligentStatus: pace.intelligentStatus,
    primaryInsight: insights[0] ?? null,
    estimatedCompletionDate: forecast.estimatedCompletionDate,
    requiredMonthlyContribution: pace.requiredMonthlyContribution,
  }

  return {
    goal: enrichedGoal,
    contributions: ((contributions ?? []) as GoalContribution[]).map(normalizeContribution),
    contributionCount: count ?? (contributions?.length ?? 0),
    summary: buildGoalsIntelligenceSummary([normalizedGoal], allRows),
    forecast,
    pace,
    history,
    insights,
  }
}

export async function getGoalsSummary(supabase: SupabaseClient): Promise<GoalSummary> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at')
    .neq('status', 'ARCHIVED')

  if (error) throw error
  return buildGoalsIntelligenceSummary((data ?? []) as SavingsGoal[], [])
}
