import { REPORT_TYPE_CODES, type ReportTypeCode } from './constants'
import type { ReportRange, ReportTransactionTypeFilter } from './types'

/**
 * Each value here must correspond to exactly one visual block in
 * src/app/(app)/reports/page.tsx (see the SECTION_TO_BLOCK comment there).
 * A template's `sections` array is what actually drives what the user sees —
 * this is not decorative metadata, reports/page.tsx reads it directly.
 */
export type ReportSection =
  | 'kpi-income'
  | 'kpi-expenses'
  | 'kpi-cashflow'
  | 'kpi-net-worth'
  | 'monthly-series'
  | 'expense-categories'
  | 'income-categories'
  | 'fixed-variable'
  | 'net-worth'
  | 'transfers-summary'
  | 'comparison'
  | 'insights'
  | 'accounts'

export type ReportCategory = 'periodic' | 'thematic'
export type ReportEntryKind = 'template' | 'related'

export type ReportTypeDefinition = {
  code: ReportTypeCode
  label: string
  description: string
  /** 'template' = a real report rendered by /reports; 'related' = a link to a different feature page. */
  kind: ReportEntryKind
  /** null for kind:'related' — categorization only applies to in-engine report templates. */
  category: ReportCategory | null
  defaultRange: ReportRange
  defaultType: ReportTransactionTypeFilter
  /** Which blocks of /reports to show. Ignored for kind:'related'. */
  sections: ReportSection[]
  color: string
  /**
   * Derived, never hand-typed: `/reports?tpl=<code>&range=<defaultRange>&type=<defaultType>`
   * for templates, or the literal target page for related tools.
   */
  href: string
  /** True = exists (still reachable) but must not be offered in template pickers (e.g. TAGS). */
  hidden: boolean
}

type RawEntry = Omit<ReportTypeDefinition, 'href'> & { externalHref?: string }

// Every template below maps 1:1 to a distinct block set in reports/page.tsx — see the
// per-template comments. "Panoramica completa" templates (MONTHLY/QUARTERLY/ANNUAL/CUSTOM)
// intentionally share the same full section list: they differ only by period, by design.
const FULL_SECTIONS: ReportSection[] = [
  'kpi-income', 'kpi-expenses', 'kpi-cashflow', 'kpi-net-worth',
  'monthly-series', 'expense-categories', 'income-categories',
  'fixed-variable', 'net-worth', 'transfers-summary', 'comparison', 'insights', 'accounts',
]

// INCOME: solo cio' che riguarda le entrate. Niente KPI/andamento/categorie di spesa.
const INCOME_SECTIONS: ReportSection[] = ['kpi-income', 'monthly-series', 'income-categories', 'insights']

// EXPENSES: solo cio' che riguarda le uscite, incluso fisso/variabile.
const EXPENSES_SECTIONS: ReportSection[] = ['kpi-expenses', 'monthly-series', 'expense-categories', 'fixed-variable', 'insights']

// CASH_FLOW: entrate, uscite, saldo, andamento e trasferimenti. Niente patrimonio/conti/categorie
// (altrimenti sarebbe indistinguibile da MONTHLY o da NET_WORTH).
const CASH_FLOW_SECTIONS: ReportSection[] = ['kpi-income', 'kpi-expenses', 'kpi-cashflow', 'monthly-series', 'transfers-summary', 'insights']

// ACCOUNTS: solo conti/saldi. Niente andamento mensile entrate/uscite (non deve sembrare
// la panoramica mensile).
const ACCOUNTS_SECTIONS: ReportSection[] = ['kpi-net-worth', 'accounts']

// NET_WORTH: patrimonio ed evoluzione patrimonio, conti/saldi. Niente categorie di
// spesa/entrata (per essere davvero diverso da CASH_FLOW).
const NET_WORTH_SECTIONS: ReportSection[] = ['kpi-net-worth', 'net-worth', 'accounts']

// CATEGORIES: categorie, percentuali e andamento disponibile, senza la riga KPI e senza
// fisso/variabile o trasferimenti (per essere davvero diverso da QUARTERLY).
const CATEGORIES_SECTIONS: ReportSection[] = ['monthly-series', 'expense-categories', 'income-categories', 'insights']

const RAW_REGISTRY: RawEntry[] = [
  {
    code: 'MONTHLY',
    label: 'Report mensile',
    description: 'Panoramica finanziaria completa del mese corrente.',
    kind: 'template',
    category: 'periodic',
    defaultRange: 'current-month',
    defaultType: 'both',
    sections: FULL_SECTIONS,
    color: 'indigo',
    hidden: false,
  },
  {
    code: 'QUARTERLY',
    label: 'Report trimestrale',
    description: 'Panoramica finanziaria completa degli ultimi 3 mesi.',
    kind: 'template',
    category: 'periodic',
    defaultRange: 'last-3-months',
    defaultType: 'both',
    sections: FULL_SECTIONS,
    color: 'violet',
    hidden: false,
  },
  {
    code: 'ANNUAL',
    label: 'Report annuale',
    description: "Panoramica finanziaria completa dell'anno corrente.",
    kind: 'template',
    category: 'periodic',
    defaultRange: 'current-year',
    defaultType: 'both',
    sections: FULL_SECTIONS,
    color: 'amber',
    hidden: false,
  },
  {
    code: 'CUSTOM',
    label: 'Report personalizzato',
    description: 'Intervallo personalizzato con tutti i filtri e le sezioni disponibili.',
    kind: 'template',
    category: 'periodic',
    defaultRange: 'custom',
    defaultType: 'both',
    sections: FULL_SECTIONS,
    color: 'slate',
    hidden: false,
  },
  {
    code: 'INCOME',
    label: 'Analisi entrate',
    description: 'Le tue entrate: andamento, categorie e insight, senza il rumore delle uscite.',
    kind: 'template',
    category: 'thematic',
    defaultRange: 'last-6-months',
    defaultType: 'income',
    sections: INCOME_SECTIONS,
    color: 'emerald',
    hidden: false,
  },
  {
    code: 'EXPENSES',
    label: 'Analisi uscite',
    description: 'Le tue uscite: andamento, categorie, fisso/variabile e insight.',
    kind: 'template',
    category: 'thematic',
    defaultRange: 'last-6-months',
    defaultType: 'expense',
    sections: EXPENSES_SECTIONS,
    color: 'red',
    hidden: false,
  },
  {
    code: 'CASH_FLOW',
    label: 'Cash flow',
    description: 'Flusso di cassa: entrate, uscite, saldo netto e trasferimenti nel tempo.',
    kind: 'template',
    category: 'thematic',
    defaultRange: 'last-12-months',
    defaultType: 'both',
    sections: CASH_FLOW_SECTIONS,
    color: 'sky',
    hidden: false,
  },
  {
    code: 'ACCOUNTS',
    label: 'Report conti',
    description: 'Saldi e patrimonio conto per conto, senza la panoramica mensile.',
    kind: 'template',
    category: 'thematic',
    defaultRange: 'current-month',
    defaultType: 'all',
    sections: ACCOUNTS_SECTIONS,
    color: 'teal',
    hidden: false,
  },
  {
    code: 'NET_WORTH',
    label: 'Patrimonio netto',
    description: 'Evoluzione del patrimonio netto, saldi per conto e variazione nel periodo.',
    kind: 'template',
    category: 'thematic',
    defaultRange: 'last-12-months',
    defaultType: 'all',
    sections: NET_WORTH_SECTIONS,
    color: 'purple',
    hidden: false,
  },
  {
    code: 'CATEGORIES',
    label: 'Analisi categorie',
    description: 'Categorie di spesa: importi, incidenza percentuale e andamento, senza la riga KPI.',
    kind: 'template',
    category: 'thematic',
    defaultRange: 'last-3-months',
    defaultType: 'both',
    sections: CATEGORIES_SECTIONS,
    color: 'lime',
    hidden: false,
  },
  {
    code: 'TAGS',
    label: 'Report tag',
    description: 'Movimenti classificati per tag (funzionalità pianificata, non ancora disponibile).',
    kind: 'template',
    category: 'thematic',
    defaultRange: 'current-month',
    defaultType: 'both',
    sections: [],
    color: 'stone',
    hidden: true,
  },
  {
    code: 'BUDGETS',
    label: 'Report budget',
    description: 'Rispetto dei budget mensili, categorie superate e margini.',
    kind: 'related',
    category: null,
    defaultRange: 'current-month',
    defaultType: 'both',
    sections: [],
    color: 'orange',
    hidden: false,
    externalHref: '/budgets',
  },
  {
    code: 'GOALS',
    label: 'Report obiettivi',
    description: 'Avanzamento degli obiettivi di risparmio e previsioni di completamento.',
    kind: 'related',
    category: null,
    defaultRange: 'current-year',
    defaultType: 'both',
    sections: [],
    color: 'pink',
    hidden: false,
    externalHref: '/goals',
  },
  {
    code: 'LOANS',
    label: 'Report prestiti',
    description: 'Capitale residuo, pagamenti e scadenze dei prestiti.',
    kind: 'related',
    category: null,
    defaultRange: 'current-year',
    defaultType: 'both',
    sections: [],
    color: 'rose',
    hidden: false,
    externalHref: '/loans',
  },
  {
    code: 'RECURRING',
    label: 'Report ricorrenti',
    description: 'Impatto mensile delle regole ricorrenti e proiezione futura.',
    kind: 'related',
    category: null,
    defaultRange: 'current-month',
    defaultType: 'both',
    sections: [],
    color: 'cyan',
    hidden: false,
    externalHref: '/recurring',
  },
  {
    code: 'FINANCIAL_HEALTH',
    label: 'Salute finanziaria',
    description: 'Score, componenti, trend storici e raccomandazioni del motore.',
    kind: 'related',
    category: null,
    defaultRange: 'current-month',
    defaultType: 'both',
    sections: [],
    color: 'green',
    hidden: false,
    externalHref: '/financial-health',
  },
  {
    code: 'DATA_INTEGRITY',
    label: 'Integrità dati',
    description: 'Anomalie strutturali, duplicati e riferimenti incoerenti.',
    kind: 'related',
    category: null,
    defaultRange: 'current-month',
    defaultType: 'both',
    sections: [],
    color: 'yellow',
    hidden: false,
    externalHref: '/data-integrity',
  },
  {
    code: 'SCENARIOS',
    label: 'Scenari finanziari',
    description: 'Proiezioni "what if" e confronto con la baseline.',
    kind: 'related',
    category: null,
    defaultRange: 'current-year',
    defaultType: 'both',
    sections: [],
    color: 'fuchsia',
    hidden: false,
    externalHref: '/scenarios',
  },
  {
    code: 'TRANSACTIONS',
    label: 'Elenco movimenti',
    description: 'Tutti i movimenti del periodo con filtri avanzati.',
    kind: 'related',
    category: null,
    defaultRange: 'current-month',
    defaultType: 'both',
    sections: [],
    color: 'blue',
    hidden: false,
    externalHref: '/transactions',
  },
]

function computeHref(entry: RawEntry): string {
  if (entry.kind === 'related') return entry.externalHref ?? '/reports'
  const params = new URLSearchParams()
  params.set('tpl', entry.code)
  params.set('range', entry.defaultRange)
  params.set('type', entry.defaultType)
  return `/reports?${params.toString()}`
}

export const REPORT_REGISTRY: ReportTypeDefinition[] = RAW_REGISTRY.map((raw) => {
  const href = computeHref(raw)
  const { externalHref: _externalHref, ...entry } = raw
  return { ...entry, href }
})

/** Real report templates (kind:'template'), excluding hidden ones (e.g. TAGS). Use this for pickers. */
export const REPORT_TEMPLATES: ReportTypeDefinition[] = REPORT_REGISTRY.filter((def) => def.kind === 'template' && !def.hidden)

/** Links to other Aurora features presented alongside report templates, never as templates themselves. */
export const RELATED_REPORT_TOOLS: ReportTypeDefinition[] = REPORT_REGISTRY.filter((def) => def.kind === 'related')

/** Curated subset used by compact surfaces (dashboard widget, command menu). Single source of truth
 * for those two so they can never diverge from REPORT_REGISTRY again. */
export const REPORT_QUICK_LINK_CODES: ReportTypeCode[] = ['MONTHLY', 'INCOME', 'EXPENSES', 'ANNUAL', 'NET_WORTH']

export function getReportType(code: ReportTypeCode): ReportTypeDefinition | undefined {
  return REPORT_REGISTRY.find((def) => def.code === code)
}

export function isReportTypeCode(value: unknown): value is ReportTypeCode {
  return typeof value === 'string' && (REPORT_TYPE_CODES as readonly string[]).includes(value)
}

/** Resolves a `tpl` query value to a usable, non-hidden template. Unknown/hidden/related codes
 * (including a stray `tpl=TAGS`) safely resolve to undefined, which callers treat as "no template
 * selected" (full report), never as a crash or a silently-wrong narrow view. */
export function resolveTemplate(tpl: string | null | undefined): ReportTypeDefinition | undefined {
  if (!tpl || !isReportTypeCode(tpl)) return undefined
  const def = getReportType(tpl)
  if (!def || def.kind !== 'template' || def.hidden) return undefined
  return def
}

export const REPORT_REGISTRY_BY_CATEGORY: Record<ReportCategory, ReportTypeDefinition[]> = {
  periodic: REPORT_TEMPLATES.filter((def) => def.category === 'periodic'),
  thematic: REPORT_TEMPLATES.filter((def) => def.category === 'thematic'),
}

/** Single source of truth for the Tailwind classes behind each `color` name in the
 * registry — was previously copy-pasted between reports/new/page.tsx and (implicitly,
 * by hand) reports-widget.tsx. */
export const REPORT_COLOR_CLASSES: Record<string, { bg: string; icon: string; border: string }> = {
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-100 hover:border-indigo-300' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100 hover:border-violet-300' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100 hover:border-amber-300' },
  slate: { bg: 'bg-slate-50', icon: 'text-slate-600', border: 'border-slate-200 hover:border-slate-400' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100 hover:border-emerald-300' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-100 hover:border-red-300' },
  sky: { bg: 'bg-sky-50', icon: 'text-sky-600', border: 'border-sky-100 hover:border-sky-300' },
  teal: { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-teal-100 hover:border-teal-300' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100 hover:border-purple-300' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100 hover:border-orange-300' },
  pink: { bg: 'bg-pink-50', icon: 'text-pink-600', border: 'border-pink-100 hover:border-pink-300' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-600', border: 'border-rose-100 hover:border-rose-300' },
  cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-600', border: 'border-cyan-100 hover:border-cyan-300' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100 hover:border-green-300' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', border: 'border-yellow-100 hover:border-yellow-300' },
  fuchsia: { bg: 'bg-fuchsia-50', icon: 'text-fuchsia-600', border: 'border-fuchsia-100 hover:border-fuchsia-300' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100 hover:border-blue-300' },
  lime: { bg: 'bg-lime-50', icon: 'text-lime-600', border: 'border-lime-100 hover:border-lime-300' },
  stone: { bg: 'bg-stone-50', icon: 'text-stone-500', border: 'border-stone-200 hover:border-stone-400' },
}

export function reportColorClasses(color: string): { bg: string; icon: string; border: string } {
  return REPORT_COLOR_CLASSES[color] ?? { bg: 'bg-slate-50', icon: 'text-slate-600', border: 'border-slate-200 hover:border-slate-400' }
}
