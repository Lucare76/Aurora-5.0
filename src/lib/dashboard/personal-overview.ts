import type { SupabaseClient, User } from '@supabase/supabase-js'
import { canAccessPrivateFinance, canAccessPrivateHr } from '@/lib/access/private-finance-access'
import { buildDashboardPayload } from '@/lib/dashboard/service'
import type { BudgetStatus } from '@/lib/budgets/service'
import { buildFinancialHealthPayload } from '@/lib/financial-health/service'
import { listDataIntegrityIssues, getLatestDataIntegrityScan } from '@/lib/data-integrity/service'
import { buildAdiSummary, buildAuroraScopeSummary, filterAccountsByScope } from '@/lib/dependent-finance/calculations'
import { todayDateOnly, daysBetweenDateOnly } from '@/lib/deadlines/date-only'
import { classifyDeadlineTemporalStatus, deadlineStats, shouldRemind, sortDeadlines } from '@/lib/deadlines'
import {
  annualVacationAllowance,
  annualVacationRemaining,
  annualVacationUsed,
  monthlyPermitAllowance,
  monthlyPermitRemaining,
  monthlyPermitUsed,
  permitUsagePercentage,
} from '@/lib/leave/calculations'
import type { LeaveEntry, LeaveSettings, PersonalDeadline } from '@/types/database'
import type { AccountPurposeLink } from '@/lib/dependent-finance/types'

export type OverviewSectionStatus = 'OK' | 'UNAVAILABLE' | 'HIDDEN'
export type OverviewAlertTone = 'critical' | 'warning' | 'info' | 'success' | 'neutral'
export type OverviewAlertSource = 'data-integrity' | 'deadline' | 'budget' | 'notification' | 'leave' | 'financial-health'

export type PersonalOverviewAlert = {
  id: string
  source: OverviewAlertSource
  title: string
  description: string
  tone: OverviewAlertTone
  href: string
  cta: string
  date?: string | null
  priority: number
}

export type PersonalOverviewEvent = {
  id: string
  title: string
  description: string
  date: string
  href: string
  tone: OverviewAlertTone
}

export type PersonalOverviewMetric = {
  label: string
  value: number | string | null
  suffix?: string
  tone?: OverviewAlertTone
}

export type PersonalOverviewPayload = {
  generatedAt: string
  today: string
  greetingName: string
  access: {
    privateFinance: boolean
    privateHr: boolean
  }
  attention: {
    status: OverviewSectionStatus
    items: PersonalOverviewAlert[]
  }
  todaySection: {
    status: OverviewSectionStatus
    items: PersonalOverviewEvent[]
    emptyMessage: string
  }
  week: {
    status: OverviewSectionStatus
    items: PersonalOverviewEvent[]
  }
  month: {
    status: OverviewSectionStatus
    metrics: {
      deadlines?: {
        overdue: number
        today: number
        next7: number
        next30: number
        monthTotal: number
        monthCompleted: number
        monthActive: number
      }
      leave?: {
        vacationAllowance: number
        vacationUsed: number
        vacationRemaining: number
        permitAllowance: number
        permitUsed: number
        permitRemaining: number
        permitUsagePercentage: number
      }
      budgets: {
        regular: number
        warning: number
        exceeded: number
      }
      goals: {
        total: number
        active: number
        completed: number
        progressPercentage: number
      }
    }
  }
  financial: {
    status: OverviewSectionStatus
    netWorth: number
    income: number
    expenses: number
    balance: number
    healthScore: number | null
    healthLevel: string
    healthSummary: string
    budgetAttentionCount: number
  }
  privateCards: {
    aurora?: {
      status: OverviewSectionStatus
      balance: number
      activeAccounts: number
      href: string
    }
    adi?: {
      status: OverviewSectionStatus
      balance: number
      received: number
      spent: number
      href: string
    }
  }
  sections: {
    deadlines: OverviewSectionStatus
    leave: OverviewSectionStatus
    dataIntegrity: OverviewSectionStatus
    notifications: OverviewSectionStatus
    privateFinance: OverviewSectionStatus
  }
  queryPlan: string[]
}

type AccountRow = {
  id: string
  name: string
  type: string | null
  balance: number | string
  currency: string
  is_active: boolean
  color?: string | null
  icon?: string | null
}

type TxRow = {
  id: string
  account_id: string | null
  type: 'income' | 'expense' | 'transfer'
  amount: number | string
  date: string
  description: string | null
  category_id: string | null
  transfer_peer_id: string | null
  destination_account_id?: string | null
}

type NotificationRow = {
  id: string
  title: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  created_at: string
  source_url: string | null
}

type OverviewSourceData = {
  financialPayload?: Awaited<ReturnType<typeof buildDashboardPayload>>
  financialHealth?: Awaited<ReturnType<typeof buildFinancialHealthPayload>>
  dataIntegrity?: Awaited<ReturnType<typeof loadDataIntegrityOverview>>
  notifications?: NotificationRow[]
  deadlines?: PersonalDeadline[]
  leave?: Awaited<ReturnType<typeof loadLeaveOverview>>
  aurora?: { balance: number; activeAccounts: number }
  adi?: { balance: number; received: number; spent: number }
  unavailable: Partial<Record<keyof PersonalOverviewPayload['sections'] | 'financial', true>>
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function buildPersonalOverviewViewModel(input: {
  now: Date
  user: Pick<User, 'email'> & { id?: string }
  data: OverviewSourceData
}): PersonalOverviewPayload {
  const today = todayDateOnly(input.now)
  const monthStart = `${today.slice(0, 7)}-01`
  const monthEnd = endOfMonthDateOnly(input.now)
  const financialPayload = input.data.financialPayload
  const health = input.data.financialHealth
  const deadlines = input.data.deadlines ?? []
  const activeDeadlines = deadlines.filter((item) => item.status === 'ACTIVE')
  const monthDeadlines = deadlines.filter((item) => item.due_date >= monthStart && item.due_date <= monthEnd)
  const deadlineSummary = deadlineStats(activeDeadlines, today)
  const dataIntegrity = input.data.dataIntegrity
  const notifications = input.data.notifications ?? []
  const leave = input.data.leave

  const todayItems = buildTodayItems({ today, deadlines: activeDeadlines, leaveEntries: leave?.entries ?? [], notifications })
  const weekItems = buildWeekItems({ today, deadlines: activeDeadlines, leaveEntries: leave?.entries ?? [] })
  const alerts = buildAttentionItems({
    today,
    deadlines: activeDeadlines,
    dataIntegrity,
    notifications,
    leave,
    budgetRisks: financialPayload?.budgetSummary.topRiskBudgets ?? [],
    healthWarnings: health?.warnings ?? [],
  })

  const budgetTop = financialPayload?.budgetSummary.topRiskBudgets ?? []
  const budgetExceeded = financialPayload?.budgetSummary.exceededCount ?? 0
  const budgetRisk = financialPayload?.budgetSummary.atRiskCount ?? 0
  const totalBudgets = financialPayload?.budgetSummary.totalBudgets ?? 0

  return {
    generatedAt: new Date().toISOString(),
    today,
    greetingName: health?.profile?.displayName ?? 'Utente Aurora',
    access: {
      privateFinance: canAccessPrivateFinance(input.user.email),
      privateHr: canAccessPrivateHr(input.user.email),
    },
    attention: {
      status: 'OK',
      items: alerts,
    },
    todaySection: {
      status: sectionStatus(input.data.unavailable.deadlines || input.data.unavailable.leave || input.data.unavailable.notifications),
      items: todayItems,
      emptyMessage: 'Nulla richiede attenzione oggi.',
    },
    week: {
      status: sectionStatus(input.data.unavailable.deadlines || input.data.unavailable.leave),
      items: weekItems,
    },
    month: {
      status: 'OK',
      metrics: {
        ...(deadlines.length > 0 ? {
          deadlines: {
            overdue: deadlineSummary.overdue,
            today: deadlineSummary.today,
            next7: activeDeadlines.filter((item) => daysBetweenDateOnly(today, item.due_date) >= 0 && daysBetweenDateOnly(today, item.due_date) <= 7).length,
            next30: deadlineSummary.next30Days,
            monthTotal: monthDeadlines.length,
            monthCompleted: monthDeadlines.filter((item) => item.status === 'COMPLETED').length,
            monthActive: monthDeadlines.filter((item) => item.status === 'ACTIVE').length,
          },
        } : {}),
        ...(leave ? {
          leave: {
            vacationAllowance: leave.vacationAllowance,
            vacationUsed: leave.vacationUsed,
            vacationRemaining: leave.vacationRemaining,
            permitAllowance: leave.permitAllowance,
            permitUsed: leave.permitUsed,
            permitRemaining: leave.permitRemaining,
            permitUsagePercentage: leave.permitUsagePercentage,
          },
        } : {}),
        budgets: {
          regular: Math.max(totalBudgets - budgetRisk, 0),
          warning: Math.max(budgetRisk - budgetExceeded, 0),
          exceeded: budgetExceeded,
        },
        goals: {
          total: financialPayload?.goalsSummary.totalGoals ?? 0,
          active: financialPayload?.goalsSummary.activeGoals ?? 0,
          completed: financialPayload?.goalsSummary.completedGoals ?? 0,
          progressPercentage: financialPayload?.goalsSummary.completionPercentage ?? 0,
        },
      },
    },
    financial: {
      status: input.data.unavailable.financial ? 'UNAVAILABLE' : 'OK',
      netWorth: financialPayload?.netWorth ?? health?.metrics.currentFinancialPosition ?? 0,
      income: financialPayload?.monthIncome ?? health?.metrics.monthlyIncome ?? 0,
      expenses: financialPayload?.monthExpense ?? health?.metrics.monthlyExpenses ?? 0,
      balance: financialPayload?.monthBalance ?? health?.metrics.monthlyMargin ?? 0,
      healthScore: health?.totalScore ?? null,
      healthLevel: health?.levelLabel ?? 'Non disponibile',
      healthSummary: health?.summary ?? 'Financial Health non disponibile.',
      budgetAttentionCount: budgetTop.length,
    },
    privateCards: {
      ...(input.data.aurora ? { aurora: { status: 'OK' as const, balance: input.data.aurora.balance, activeAccounts: input.data.aurora.activeAccounts, href: '/aurora' } } : {}),
      ...(input.data.adi ? { adi: { status: 'OK' as const, balance: input.data.adi.balance, received: input.data.adi.received, spent: input.data.adi.spent, href: '/adi' } } : {}),
    },
    sections: {
      deadlines: input.data.unavailable.deadlines ? 'UNAVAILABLE' : canAccessPrivateHr(input.user.email) ? 'OK' : 'HIDDEN',
      leave: input.data.unavailable.leave ? 'UNAVAILABLE' : canAccessPrivateHr(input.user.email) ? 'OK' : 'HIDDEN',
      dataIntegrity: input.data.unavailable.dataIntegrity ? 'UNAVAILABLE' : 'OK',
      notifications: input.data.unavailable.notifications ? 'UNAVAILABLE' : 'OK',
      privateFinance: input.data.unavailable.privateFinance ? 'UNAVAILABLE' : canAccessPrivateFinance(input.user.email) ? 'OK' : 'HIDDEN',
    },
    queryPlan: [
      'financial-health service',
      'dashboard service payload',
      'data_integrity_issues open limit 5',
      'notifications unread important limit 5',
      'private HR deadlines/leave only when authorized',
      'private finance Aurora/ADI only when authorized',
    ],
  }
}

export async function buildPersonalOverviewPayload(supabase: SupabaseClient, user: User): Promise<PersonalOverviewPayload> {
  const now = new Date()
  const privateHr = canAccessPrivateHr(user.email)
  const privateFinance = canAccessPrivateFinance(user.email)
  const unavailable: OverviewSourceData['unavailable'] = {}

  const capture = async <T>(section: keyof OverviewSourceData['unavailable'], loader: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await loader()
    } catch (error) {
      unavailable[section] = true
      console.warn('[personal-overview] section unavailable', { section, name: error instanceof Error ? error.name : 'unknown' })
      return undefined
    }
  }

  const [financialPayload, financialHealth, dataIntegrity, notifications, deadlines, leave, privateFinanceData] = await Promise.all([
    capture('financial', () => buildDashboardPayload(supabase)),
    capture('financial', () => buildFinancialHealthPayload(supabase, new URLSearchParams(), user.id)),
    capture('dataIntegrity', () => loadDataIntegrityOverview(supabase, user.id)),
    capture('notifications', () => loadNotifications(supabase, user.id)),
    privateHr ? capture('deadlines', () => loadDeadlines(supabase, user.id, now)) : Promise.resolve(undefined),
    privateHr ? capture('leave', () => loadLeaveOverview(supabase, user.id, now)) : Promise.resolve(undefined),
    privateFinance ? capture('privateFinance', () => loadPrivateFinanceOverview(supabase, user.id)) : Promise.resolve(undefined),
  ])

  if (!financialPayload && !financialHealth) {
    throw new Error('PERSONAL_OVERVIEW_FINANCIAL_UNAVAILABLE')
  }

  return buildPersonalOverviewViewModel({
    now,
    user,
    data: {
      financialPayload,
      financialHealth,
      dataIntegrity,
      notifications,
      deadlines,
      leave,
      aurora: privateFinanceData?.aurora,
      adi: privateFinanceData?.adi,
      unavailable,
    },
  })
}

async function loadDataIntegrityOverview(supabase: SupabaseClient, userId: string) {
  const [issuesResult, latestScan] = await Promise.all([
    listDataIntegrityIssues(supabase, userId, { status: 'open', limit: 5 }),
    getLatestDataIntegrityScan(supabase, userId),
  ])
  return { ...issuesResult, latestScan }
}

async function loadNotifications(supabase: SupabaseClient, userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,severity,created_at,source_url')
    .eq('user_id', userId)
    .eq('is_read', false)
    .is('archived_at', null)
    .in('severity', ['CRITICAL', 'WARNING'])
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? []) as NotificationRow[]
}

async function loadDeadlines(supabase: SupabaseClient, userId: string, now: Date): Promise<PersonalDeadline[]> {
  const today = todayDateOnly(now)
  const monthEnd = endOfMonthDateOnly(now)
  const { data, error } = await supabase
    .from('personal_deadlines')
    .select('id,user_id,title,description,category,due_date,status,priority,recurrence,reminder_days_before,completed_at,created_at,updated_at')
    .eq('user_id', userId)
    .in('status', ['ACTIVE', 'COMPLETED'])
    .gte('due_date', today.slice(0, 7) + '-01')
    .lte('due_date', monthEnd)
    .order('due_date', { ascending: true })
    .limit(50)
  if (error) throw error
  return (data ?? []) as PersonalDeadline[]
}

async function loadLeaveOverview(supabase: SupabaseClient, userId: string, now: Date) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const [{ data: settings, error: settingsError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase.from('leave_settings').select('vacation_days_per_year,permit_104_hours_per_month').eq('user_id', userId).maybeSingle(),
    supabase
      .from('leave_entries')
      .select('id,user_id,type,start_date,end_date,days,hours,start_time,end_time,note,created_at,updated_at')
      .eq('user_id', userId)
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', `${year}-12-31`)
      .order('start_date', { ascending: true }),
  ])
  if (settingsError) throw settingsError
  if (entriesError) throw entriesError
  const safeSettings = (settings ?? { vacation_days_per_year: 0, permit_104_hours_per_month: 0 }) as LeaveSettings
  const safeEntries = (entries ?? []) as LeaveEntry[]
  return {
    settings: safeSettings,
    entries: safeEntries,
    vacationAllowance: annualVacationAllowance(safeSettings),
    vacationUsed: annualVacationUsed(safeEntries, year),
    vacationRemaining: annualVacationRemaining(safeSettings, safeEntries, year),
    permitAllowance: monthlyPermitAllowance(safeSettings),
    permitUsed: monthlyPermitUsed(safeEntries, year, month),
    permitRemaining: monthlyPermitRemaining(safeSettings, safeEntries, year, month),
    permitUsagePercentage: permitUsagePercentage(safeSettings, safeEntries, year, month),
  }
}

async function loadPrivateFinanceOverview(supabase: SupabaseClient, userId: string) {
  const [{ data: accounts, error: accountsError }, { data: links, error: linksError }, { data: transactions }, { data: adiEntries, error: adiError }] = await Promise.all([
    supabase.from('accounts').select('id,name,type,balance,currency,is_active,color,icon').eq('user_id', userId),
    supabase.from('account_purpose_links').select('account_id,purpose').eq('user_id', userId),
    supabase.from('transactions').select('id,account_id,type,amount,date,description,category_id,transfer_peer_id').eq('user_id', userId).order('date', { ascending: false }).limit(1000),
    supabase.from('adi_entries').select('entry_type,adi_category,amount,date,reference_period').eq('user_id', userId),
  ])
  if (accountsError) throw accountsError
  if (linksError) throw linksError
  if (adiError) throw adiError
  const accountRows = (accounts ?? []) as AccountRow[]
  const scopeLinks = (links ?? []) as AccountPurposeLink[]
  const auroraAccounts = filterAccountsByScope(accountRows, scopeLinks, 'DEPENDENT_AURORA')
    .map((account) => ({ ...account, type: account.type ?? undefined, balance: Number(account.balance) || 0 }))
  const auroraSummary = buildAuroraScopeSummary({
    accounts: auroraAccounts,
    links: scopeLinks,
    transactions: ((transactions ?? []) as TxRow[]).map((tx) => ({
      ...tx,
      account_id: tx.account_id ?? undefined,
      amount: Number(tx.amount) || 0,
      destination_account_id: tx.type === 'transfer' ? tx.transfer_peer_id : null,
    })),
  })
  const adiSummary = buildAdiSummary((adiEntries ?? []) as Parameters<typeof buildAdiSummary>[0])
  return {
    aurora: { balance: auroraSummary.balance, activeAccounts: auroraSummary.activeAccountsCount },
    adi: { balance: adiSummary.balance, received: adiSummary.received, spent: adiSummary.spent },
  }
}

function buildAttentionItems(params: {
  today: string
  deadlines: PersonalDeadline[]
  dataIntegrity?: Awaited<ReturnType<typeof loadDataIntegrityOverview>>
  notifications: NotificationRow[]
  leave?: Awaited<ReturnType<typeof loadLeaveOverview>>
  budgetRisks: Array<{ categoryName: string; percentage: number; status: BudgetStatus }>
  healthWarnings: string[]
}): PersonalOverviewAlert[] {
  const items: PersonalOverviewAlert[] = []
  const criticalCount = params.dataIntegrity?.summary.critical ?? 0
  const warningCount = params.dataIntegrity?.summary.warning ?? 0
  if (criticalCount > 0) items.push(alert('data-integrity-critical', 'data-integrity', 'Integrità dati critica', `${criticalCount} anomalie critiche aperte.`, 'critical', '/data-integrity', 'Apri integrità dati', 10))
  if (warningCount > 0) items.push(alert('data-integrity-warning', 'data-integrity', 'Integrità dati da controllare', `${warningCount} segnalazioni warning aperte.`, 'warning', '/data-integrity', 'Apri integrità dati', 20))

  for (const deadline of sortDeadlines(params.deadlines, params.today).slice(0, 5)) {
    const status = classifyDeadlineTemporalStatus(deadline, params.today)
    const days = daysBetweenDateOnly(params.today, deadline.due_date)
    if (status === 'OVERDUE') items.push(alert(`deadline-${deadline.id}`, 'deadline', deadline.title, `Scadenza superata da ${Math.abs(days)} giorni.`, 'critical', '/deadlines', 'Apri scadenze', 15, deadline.due_date))
    else if (status === 'TODAY') items.push(alert(`deadline-${deadline.id}`, 'deadline', deadline.title, 'Scade oggi.', 'critical', '/deadlines', 'Apri scadenze', 16, deadline.due_date))
    else if (days <= 7 || shouldRemind(deadline, params.today)) items.push(alert(`deadline-${deadline.id}`, 'deadline', deadline.title, `Scade tra ${days} giorni.`, 'warning', '/deadlines', 'Apri scadenze', 40, deadline.due_date))
  }

  for (const budget of params.budgetRisks.slice(0, 3)) {
    items.push(alert(`budget-${budget.categoryName}`, 'budget', `Budget ${budget.categoryName}`, `Utilizzo al ${budget.percentage}%.`, budget.status === 'exceeded' ? 'critical' : 'warning', '/budgets', 'Apri budget', budget.status === 'exceeded' ? 30 : 45))
  }

  if (params.leave && params.leave.permitAllowance > 0 && params.leave.permitRemaining <= 3) {
    items.push(alert('leave-permit-low', 'leave', 'Permessi 104 quasi esauriti', `${params.leave.permitRemaining} ore residue questo mese.`, 'warning', '/leave', 'Apri ferie e permessi', 50))
  }

  for (const notification of params.notifications.slice(0, 2)) {
    items.push(alert(`notification-${notification.id}`, 'notification', notification.title, 'Notifica importante non letta.', notification.severity === 'CRITICAL' ? 'critical' : 'warning', notification.source_url ?? '/notifications', 'Apri notifiche', notification.severity === 'CRITICAL' ? 55 : 65, notification.created_at.slice(0, 10)))
  }

  for (const warning of params.healthWarnings.slice(0, 1)) {
    items.push(alert('financial-health-warning', 'financial-health', 'Financial Health da controllare', warning, 'warning', '/financial-health', 'Apri salute finanziaria', 70))
  }

  return items.sort((a, b) => a.priority - b.priority || String(a.date ?? '').localeCompare(String(b.date ?? ''))).slice(0, 5)
}

function buildTodayItems(params: { today: string; deadlines: PersonalDeadline[]; leaveEntries: LeaveEntry[]; notifications: NotificationRow[] }): PersonalOverviewEvent[] {
  const deadlineItems = params.deadlines
    .filter((item) => classifyDeadlineTemporalStatus(item, params.today) === 'OVERDUE' || classifyDeadlineTemporalStatus(item, params.today) === 'TODAY' || shouldRemind(item, params.today))
    .map((item) => event(`deadline-${item.id}`, item.title, item.due_date < params.today ? 'Scadenza superata.' : 'Scadenza o promemoria attivo oggi.', item.due_date, '/deadlines', item.due_date <= params.today ? 'critical' : 'warning'))
  const leaveItems = params.leaveEntries
    .filter((entry) => entry.start_date <= params.today && (entry.end_date ?? entry.start_date) >= params.today)
    .map((entry) => event(`leave-${entry.id}`, entry.type === 'VACATION' ? 'Ferie in corso' : 'Permesso 104 oggi', entry.note ?? 'Registrato in Ferie e permessi.', entry.start_date, '/leave', 'info'))
  const notificationItems = params.notifications.slice(0, 2).map((item) => event(`notification-${item.id}`, item.title, 'Notifica importante non letta.', item.created_at.slice(0, 10), item.source_url ?? '/notifications', item.severity === 'CRITICAL' ? 'critical' : 'warning'))
  return [...deadlineItems, ...leaveItems, ...notificationItems].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
}

function buildWeekItems(params: { today: string; deadlines: PersonalDeadline[]; leaveEntries: LeaveEntry[] }): PersonalOverviewEvent[] {
  return [
    ...params.deadlines
      .filter((item) => {
        const days = daysBetweenDateOnly(params.today, item.due_date)
        return days >= 0 && days <= 7
      })
      .map((item) => event(`deadline-week-${item.id}`, item.title, 'Scadenza nei prossimi 7 giorni.', item.due_date, '/deadlines', 'warning')),
    ...params.leaveEntries
      .filter((entry) => {
        const starts = daysBetweenDateOnly(params.today, entry.start_date)
        const ends = daysBetweenDateOnly(params.today, entry.end_date ?? entry.start_date)
        return (starts >= 0 && starts <= 7) || (starts < 0 && ends >= 0)
      })
      .map((entry) => event(`leave-week-${entry.id}`, entry.type === 'VACATION' ? 'Ferie' : 'Permesso 104', entry.note ?? 'Evento registrato.', entry.start_date, '/leave', 'info')),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10)
}

function alert(id: string, source: OverviewAlertSource, title: string, description: string, tone: OverviewAlertTone, href: string, cta: string, priority: number, date?: string | null): PersonalOverviewAlert {
  return { id, source, title, description, tone, href, cta, priority, date }
}

function event(id: string, title: string, description: string, date: string, href: string, tone: OverviewAlertTone): PersonalOverviewEvent {
  return { id, title, description, date, href, tone }
}

function sectionStatus(unavailable?: boolean): OverviewSectionStatus {
  return unavailable ? 'UNAVAILABLE' : 'OK'
}

function endOfMonthDateOnly(now: Date): string {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return todayDateOnly(end)
}
