'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Umbrella,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import type { OverviewAlertTone, PersonalOverviewPayload } from '@/lib/dashboard/personal-overview'

const euroFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const dateFormatter = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function toneToStatusTone(tone: OverviewAlertTone): StatusTone {
  if (tone === 'critical') return 'critical'
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  if (tone === 'info') return 'info'
  return 'neutral'
}

function toneLabel(tone: OverviewAlertTone): string {
  if (tone === 'critical') return 'Urgente'
  if (tone === 'warning') return 'Da controllare'
  if (tone === 'success') return 'Ok'
  if (tone === 'info') return 'Info'
  return 'Neutro'
}

function formatMoney(value: number) {
  return euroFormatter.format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`))
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    </main>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<PersonalOverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const response = await fetch('/api/dashboard/personal-overview', { cache: 'no-store' })
      if (!response.ok) throw new Error('PERSONAL_OVERVIEW_UNAVAILABLE')
      const body = await response.json() as PersonalOverviewPayload
      setData(body)
      setLastRefresh(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))
      if (silent) toast.success('Dashboard aggiornata.')
    } catch (error) {
      console.error('[dashboard:personal-overview]', error)
      toast.error('Dashboard non disponibile. Riprova tra qualche secondo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dateLabel = useMemo(() => dateFormatter.format(new Date()), [])
  const hasLeaveOverview = Boolean(data?.month.metrics.leave)

  if (loading && !data) return <DashboardLoading />

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Sparkles className="h-10 w-10 text-indigo-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Dashboard non disponibile</h1>
          <p className="mt-2 text-sm text-slate-500">Aurora non riesce a caricare il centro operativo personale.</p>
          <Button className="mt-6" onClick={() => load()}>Riprova</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-600">{greeting()}, {data.greetingName}!</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Dashboard personale</h1>
              <p className="mt-2 text-sm text-slate-500">{dateLabel}</p>
              <p className="mt-1 text-xs text-slate-400">Centro operativo unificato. I dati privati vengono caricati solo se autorizzati server-side.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="text-xs text-slate-400" aria-live="polite">{lastRefresh ? `Aggiornata alle ${lastRefresh}` : 'Aggiornamento in corso'}</p>
              <Button variant="outline" className="gap-2" onClick={() => load(true)} disabled={refreshing}>
                <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Aggiorna
              </Button>
            </div>
          </div>
        </section>

        <section aria-label="Panoramica finanziaria">
          <FinancialOverview data={data} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-labelledby="attention-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="attention-title" className="text-xl font-bold text-slate-950">Cosa richiede attenzione</h2>
              <p className="mt-1 text-sm text-slate-500">Massimo 5 priorità ordinate per urgenza.</p>
            </div>
            {data.attention.items.length === 0 ? <StatusBadge tone="success" label="Tutto sotto controllo" /> : <StatusBadge tone="warning" label={`${data.attention.items.length} da vedere`} />}
          </div>
          {data.attention.items.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Tutto sotto controllo</p>
                  <p className="mt-1 text-sm text-emerald-700">Non ci sono attività urgenti o anomalie da gestire.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {data.attention.items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <AlertTriangle className={item.tone === 'critical' ? 'mt-0.5 h-5 w-5 shrink-0 text-red-500' : 'mt-0.5 h-5 w-5 shrink-0 text-amber-500'} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{item.title}</p>
                        <StatusBadge tone={toneToStatusTone(item.tone)} label={toneLabel(item.tone)} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                    </div>
                  </div>
                  <Link href={item.href} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}>{item.cta}</Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-12 xl:gap-5" aria-label="Centro operativo personale">
          <div className="xl:col-span-4">
            <TimelineSection title="Oggi" description="Solo elementi rilevanti per la giornata." items={data.todaySection.items} emptyMessage={data.todaySection.emptyMessage} />
          </div>
          <div className="xl:col-span-4">
            <TimelineSection title="Questa settimana" description="Scadenze, ferie e permessi nei prossimi 7 giorni." items={data.week.items} emptyMessage="Nessun evento nei prossimi 7 giorni." />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <MonthOverview data={data} />
          </div>
          {hasLeaveOverview && (
            <div className="md:col-span-2 xl:col-span-6">
              <LeaveOverview data={data} />
            </div>
          )}
          <div className={hasLeaveOverview ? 'md:col-span-2 xl:col-span-6' : 'md:col-span-2 xl:col-span-12'}>
            <BudgetGoalsOverview data={data} />
          </div>
        </section>

        {(data.privateCards.aurora || data.privateCards.adi) && (
          <section className="grid items-start gap-4 lg:grid-cols-2" aria-label="Sezioni private separate">
            {data.privateCards.aurora && (
              <PrivateCard
                icon={<Sparkles className="h-5 w-5 text-indigo-600" />}
                title="Risparmi Aurora"
                value={formatMoney(data.privateCards.aurora.balance)}
                description={`${data.privateCards.aurora.activeAccounts} conti attivi. Separato dal patrimonio personale.`}
                href={data.privateCards.aurora.href}
                cta="Apri Risparmi Aurora"
              />
            )}
            {data.privateCards.adi && (
              <PrivateCard
                icon={<ShieldCheck className="h-5 w-5 text-cyan-600" />}
                title="ADI"
                value={formatMoney(data.privateCards.adi.balance)}
                description={`Ricevuti ${formatMoney(data.privateCards.adi.received)} · spesi ${formatMoney(data.privateCards.adi.spent)}.`}
                href={data.privateCards.adi.href}
                cta="Apri Gestione ADI"
              />
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function TimelineSection({ title, description, items, emptyMessage }: { title: string; description: string; items: PersonalOverviewPayload['week']['items']; emptyMessage: string }) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-xl">{title}</CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link key={item.id} href={item.href} className="flex min-h-14 items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <StatusBadge tone={toneToStatusTone(item.tone)} label={toneLabel(item.tone)} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-400">{formatDate(item.date)}</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FinancialOverview({ data }: { data: PersonalOverviewPayload }) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Wallet className="h-5 w-5 text-indigo-600" />
          Panoramica finanziaria
        </CardTitle>
        <p className="text-sm text-slate-500">Solo patrimonio personale. Aurora e ADI restano separati.</p>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="grid grid-cols-2 gap-3 min-[1180px]:grid-cols-4">
          <Metric label="Patrimonio" value={formatMoney(data.financial.netWorth)} />
          <Metric label="Entrate mese" value={formatMoney(data.financial.income)} tone="success" />
          <Metric label="Uscite mese" value={formatMoney(data.financial.expenses)} tone="critical" />
          <Metric label="Saldo netto" value={formatMoney(data.financial.balance)} tone={data.financial.balance >= 0 ? 'success' : 'warning'} />
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-950">Salute finanziaria</p>
              <p className="mt-1 text-sm text-slate-500">{data.financial.healthSummary}</p>
            </div>
            <StatusBadge tone={data.financial.healthScore != null && data.financial.healthScore >= 75 ? 'success' : 'warning'} label={data.financial.healthScore == null ? data.financial.healthLevel : `${data.financial.healthScore}/100`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MonthOverview({ data }: { data: PersonalOverviewPayload }) {
  const deadlines = data.month.metrics.deadlines
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-xl">Questo mese</CardTitle>
        <p className="text-sm text-slate-500">Scadenze ed eventi rilevanti del mese.</p>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        {deadlines ? (
          <SummaryBlock icon={<CalendarClock className="h-5 w-5 text-indigo-600" />} title="Scadenze" href="/deadlines">
            <MetricGrid items={[
              ['Scadute', deadlines.overdue],
              ['Oggi', deadlines.today],
              ['Prossimi 7 giorni', deadlines.next7],
              ['Completate', deadlines.monthCompleted],
            ]} />
          </SummaryBlock>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Nessuna scadenza rilevante questo mese.</p>
        )}
      </CardContent>
    </Card>
  )
}

function LeaveOverview({ data }: { data: PersonalOverviewPayload }) {
  const leave = data.month.metrics.leave
  if (!leave) return null

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Umbrella className="h-5 w-5 text-sky-600" />
          Ferie e permessi 104
        </CardTitle>
        <p className="text-sm text-slate-500">Riepilogo del mese dal modulo privato HR.</p>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <MetricGrid items={[
          ['Ferie usate', leave.vacationUsed],
          ['Ferie residue', leave.vacationRemaining],
          ['Ore 104 usate', leave.permitUsed],
          ['Ore 104 residue', leave.permitRemaining],
        ]} />
        <Link href="/leave" className="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700">Apri</Link>
      </CardContent>
    </Card>
  )
}

function BudgetGoalsOverview({ data }: { data: PersonalOverviewPayload }) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <HeartPulse className="h-5 w-5 text-rose-600" />
          Budget e obiettivi
        </CardTitle>
        <p className="text-sm text-slate-500">Monitoraggio sintetico di budget mensili e obiettivi attivi.</p>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <MetricGrid items={[
          ['Budget regolari', data.month.metrics.budgets.regular],
          ['Budget warning', data.month.metrics.budgets.warning],
          ['Budget superati', data.month.metrics.budgets.exceeded],
          ['Obiettivi attivi', data.month.metrics.goals.active],
        ]} />
        <Link href="/budgets" className="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700">Apri</Link>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: StatusTone }) {
  const toneClass = tone === 'success' ? 'text-emerald-700' : tone === 'critical' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : 'text-slate-950'
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 break-words text-lg font-bold tabular-nums leading-tight ${toneClass}`}>{value}</p>
    </div>
  )
}

function SummaryBlock({ icon, title, href, children }: { icon: ReactNode; title: string; href: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="font-semibold text-slate-950">{title}</p>
        </div>
        <Link href={href} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Apri</Link>
      </div>
      {children}
    </div>
  )
}

function MetricGrid({ items }: { items: Array<[string, number]> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  )
}

function PrivateCard({ icon, title, value, description, href, cta }: { icon: ReactNode; title: string; value: string; description: string; href: string; cta: string }) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {icon}
              <h2 className="font-bold text-slate-950">{title}</h2>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          <Link href={href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{cta}</Link>
        </div>
      </CardContent>
    </Card>
  )
}
