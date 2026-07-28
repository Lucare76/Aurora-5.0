import { REPORT_TYPE_CODES, type ReportTypeCode } from './constants'
import type { ReportRange } from './types'

export type ReportSection =
  | 'summary'
  | 'comparison'
  | 'monthly-series'
  | 'expense-categories'
  | 'income-categories'
  | 'fixed-variable'
  | 'net-worth'
  | 'records'
  | 'insights'
  | 'accounts'
  | 'budgets'
  | 'goals'
  | 'loans'
  | 'recurring'
  | 'financial-health'
  | 'data-integrity'
  | 'scenarios'
  | 'transactions'

export type ReportCategory = 'periodic' | 'thematic' | 'extended'

export type ReportTypeDefinition = {
  code: ReportTypeCode
  label: string
  description: string
  category: ReportCategory
  defaultRange: ReportRange
  sections: ReportSection[]
  color: string
  href: string
}

export const REPORT_REGISTRY: ReportTypeDefinition[] = [
  {
    code: 'MONTHLY',
    label: 'Report mensile',
    description: 'Entrate, uscite e cash flow del mese corrente con andamento storico.',
    category: 'periodic',
    defaultRange: 'current-month',
    sections: ['summary', 'comparison', 'monthly-series', 'expense-categories', 'income-categories', 'insights'],
    color: 'indigo',
    href: '/reports?range=current-month&type=both',
  },
  {
    code: 'QUARTERLY',
    label: 'Report trimestrale',
    description: 'Sintesi degli ultimi 3 mesi con confronto per trimestre.',
    category: 'periodic',
    defaultRange: 'last-3-months',
    sections: ['summary', 'comparison', 'monthly-series', 'expense-categories', 'income-categories', 'fixed-variable', 'insights'],
    color: 'violet',
    href: '/reports?range=last-3-months&type=both',
  },
  {
    code: 'ANNUAL',
    label: 'Report annuale',
    description: "Panoramica completa dell'anno con confronto rispetto all'anno precedente.",
    category: 'periodic',
    defaultRange: 'current-year',
    sections: ['summary', 'comparison', 'monthly-series', 'expense-categories', 'income-categories', 'net-worth', 'records', 'insights'],
    color: 'amber',
    href: '/reports?range=current-year&type=both',
  },
  {
    code: 'CUSTOM',
    label: 'Report personalizzato',
    description: 'Intervallo personalizzato con tutti i filtri disponibili.',
    category: 'periodic',
    defaultRange: 'custom',
    sections: ['summary', 'comparison', 'monthly-series', 'expense-categories', 'income-categories', 'fixed-variable', 'net-worth', 'records', 'insights', 'accounts'],
    color: 'slate',
    href: '/reports?range=custom',
  },
  {
    code: 'INCOME',
    label: 'Analisi entrate',
    description: 'Dettaglio delle entrate per categoria, andamento e confronto.',
    category: 'thematic',
    defaultRange: 'last-6-months',
    sections: ['summary', 'comparison', 'income-categories', 'monthly-series', 'insights'],
    color: 'emerald',
    href: '/reports?range=last-6-months&type=income',
  },
  {
    code: 'EXPENSES',
    label: 'Analisi uscite',
    description: 'Dettaglio delle uscite per categoria, fisse/variabili e top spese.',
    category: 'thematic',
    defaultRange: 'last-6-months',
    sections: ['summary', 'comparison', 'expense-categories', 'fixed-variable', 'monthly-series', 'insights'],
    color: 'red',
    href: '/reports?range=last-6-months&type=expense',
  },
  {
    code: 'CASH_FLOW',
    label: 'Cash flow',
    description: 'Andamento del flusso di cassa mensile e cumulativo.',
    category: 'thematic',
    defaultRange: 'last-12-months',
    sections: ['summary', 'comparison', 'monthly-series', 'net-worth', 'insights'],
    color: 'sky',
    href: '/reports?range=last-12-months&type=both',
  },
  {
    code: 'ACCOUNTS',
    label: 'Report conti',
    description: 'Saldi e movimenti per ogni conto nel periodo selezionato.',
    category: 'thematic',
    defaultRange: 'current-month',
    sections: ['accounts', 'summary', 'insights'],
    color: 'teal',
    href: '/reports?range=current-month&type=all',
  },
  {
    code: 'NET_WORTH',
    label: 'Patrimonio netto',
    description: 'Evoluzione del patrimonio netto con massimi e minimi storici.',
    category: 'thematic',
    defaultRange: 'last-12-months',
    sections: ['net-worth', 'accounts', 'summary', 'monthly-series'],
    color: 'purple',
    href: '/reports?range=last-12-months&type=both',
  },
  {
    code: 'BUDGETS',
    label: 'Report budget',
    description: 'Rispetto dei budget mensili, categorie superate e margini.',
    category: 'extended',
    defaultRange: 'current-month',
    sections: ['budgets', 'expense-categories', 'summary'],
    color: 'orange',
    href: '/budgets',
  },
  {
    code: 'GOALS',
    label: 'Report obiettivi',
    description: 'Avanzamento degli obiettivi di risparmio e previsioni di completamento.',
    category: 'extended',
    defaultRange: 'current-year',
    sections: ['goals', 'summary'],
    color: 'pink',
    href: '/goals',
  },
  {
    code: 'LOANS',
    label: 'Report prestiti',
    description: 'Capitale residuo, pagamenti e scadenze dei prestiti.',
    category: 'extended',
    defaultRange: 'current-year',
    sections: ['loans', 'summary'],
    color: 'rose',
    href: '/loans',
  },
  {
    code: 'RECURRING',
    label: 'Report ricorrenti',
    description: 'Impatto mensile delle regole ricorrenti e proiezione futura.',
    category: 'extended',
    defaultRange: 'current-month',
    sections: ['recurring', 'fixed-variable', 'summary'],
    color: 'cyan',
    href: '/recurring',
  },
  {
    code: 'FINANCIAL_HEALTH',
    label: 'Salute finanziaria',
    description: 'Score, componenti, trend storici e raccomandazioni del motore.',
    category: 'extended',
    defaultRange: 'current-month',
    sections: ['financial-health', 'summary'],
    color: 'green',
    href: '/financial-health',
  },
  {
    code: 'DATA_INTEGRITY',
    label: 'Integrità dati',
    description: 'Anomalie strutturali, duplicati e riferimenti incoerenti.',
    category: 'extended',
    defaultRange: 'current-month',
    sections: ['data-integrity'],
    color: 'yellow',
    href: '/data-integrity',
  },
  {
    code: 'SCENARIOS',
    label: 'Scenari finanziari',
    description: 'Proiezioni "what if" e confronto con la baseline.',
    category: 'extended',
    defaultRange: 'current-year',
    sections: ['scenarios', 'summary'],
    color: 'fuchsia',
    href: '/scenarios',
  },
  {
    code: 'TRANSACTIONS',
    label: 'Elenco movimenti',
    description: 'Tutti i movimenti del periodo con filtri avanzati.',
    category: 'thematic',
    defaultRange: 'current-month',
    sections: ['transactions', 'summary'],
    color: 'blue',
    href: '/transactions',
  },
  {
    code: 'CATEGORIES',
    label: 'Analisi categorie',
    description: 'Entrate e uscite per categoria con gerarchia completa.',
    category: 'thematic',
    defaultRange: 'last-3-months',
    sections: ['expense-categories', 'income-categories', 'comparison', 'summary'],
    color: 'lime',
    href: '/reports?range=last-3-months&type=both',
  },
  {
    code: 'TAGS',
    label: 'Report tag',
    description: 'Movimenti classificati per tag (funzionalità pianificata).',
    category: 'thematic',
    defaultRange: 'current-month',
    sections: ['summary'],
    color: 'stone',
    href: '/reports',
  },
]

export function getReportType(code: ReportTypeCode): ReportTypeDefinition | undefined {
  return REPORT_REGISTRY.find((def) => def.code === code)
}

export function isReportTypeCode(value: unknown): value is ReportTypeCode {
  return typeof value === 'string' && (REPORT_TYPE_CODES as readonly string[]).includes(value)
}

export const REPORT_REGISTRY_BY_CATEGORY: Record<ReportCategory, ReportTypeDefinition[]> = {
  periodic: REPORT_REGISTRY.filter((def) => def.category === 'periodic'),
  thematic: REPORT_REGISTRY.filter((def) => def.category === 'thematic'),
  extended: REPORT_REGISTRY.filter((def) => def.category === 'extended'),
}
