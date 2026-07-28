'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, CalendarDays, PieChart, TrendingUp, Wallet } from 'lucide-react'

type QuickLink = {
  label: string
  description: string
  href: string
  icon: typeof BarChart3
  color: string
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Mensile',
    description: 'Mese corrente',
    href: '/reports?range=current-month&type=both',
    icon: CalendarDays,
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    label: 'Entrate',
    description: 'Ultimi 6 mesi',
    href: '/reports?range=last-6-months&type=income',
    icon: TrendingUp,
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    label: 'Uscite',
    description: 'Ultimi 6 mesi',
    href: '/reports?range=last-6-months&type=expense',
    icon: PieChart,
    color: 'text-red-600 bg-red-50',
  },
  {
    label: 'Annuale',
    description: 'Anno corrente',
    href: '/reports?range=current-year&type=both',
    icon: BarChart3,
    color: 'text-violet-600 bg-violet-50',
  },
  {
    label: 'Patrimonio',
    description: 'Ultimi 12 mesi',
    href: '/reports?range=last-12-months&type=both',
    icon: Wallet,
    color: 'text-purple-600 bg-purple-50',
  },
]

export function ReportsWidget() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
              aria-label={`Genera ${link.label}`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${link.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{link.label}</p>
                <p className="text-xs text-slate-400">{link.description}</p>
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
            <p className="text-xs text-slate-400">19 template</p>
          </div>
        </Link>
    </div>
  )
}
