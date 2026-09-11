'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, CalendarDays, PieChart, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import { getReportType, REPORT_QUICK_LINK_CODES, REPORT_TEMPLATES, reportColorClasses } from '@/lib/reports/registry'
import type { ReportTypeCode } from '@/lib/reports/constants'

const RANGE_SHORT_LABELS: Record<string, string> = {
  'current-month': 'Mese corrente',
  'previous-month': 'Mese precedente',
  'last-3-months': 'Ultimi 3 mesi',
  'last-6-months': 'Ultimi 6 mesi',
  'current-year': 'Anno corrente',
  'previous-year': 'Anno precedente',
  'last-12-months': 'Ultimi 12 mesi',
  custom: 'Personalizzato',
}

const WIDGET_ICONS: Partial<Record<ReportTypeCode, LucideIcon>> = {
  MONTHLY: CalendarDays,
  INCOME: TrendingUp,
  EXPENSES: PieChart,
  ANNUAL: BarChart3,
  NET_WORTH: Wallet,
}

export function ReportsWidget() {
  const links = REPORT_QUICK_LINK_CODES
    .map((code) => getReportType(code))
    .filter((def): def is NonNullable<typeof def> => Boolean(def) && !def!.hidden)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links.map((def) => {
          const Icon = WIDGET_ICONS[def.code] ?? BarChart3
          const colors = reportColorClasses(def.color)
          return (
            <Link
              key={def.code}
              href={def.href}
              className="group flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
              aria-label={`Genera ${def.label}`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg} ${colors.icon}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{def.label}</p>
                <p className="text-xs text-slate-400">{RANGE_SHORT_LABELS[def.defaultRange] ?? def.defaultRange}</p>
              </div>
            </Link>
          )
        })}
        <Link
          href="/reports/new"
          className="group flex flex-col gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-3 transition hover:border-indigo-300 hover:bg-indigo-50"
          aria-label="Tutti i template report"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600">
            <ArrowRight className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700">Tutti i report</p>
            <p className="text-xs text-slate-400">{REPORT_TEMPLATES.length} template</p>
          </div>
        </Link>
    </div>
  )
}
