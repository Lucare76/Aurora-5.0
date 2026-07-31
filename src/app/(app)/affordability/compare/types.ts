import { MAX_SCENARIOS, MIN_SCENARIOS } from '@/lib/decision-comparison/constants'
import type { CriterionKey } from '@/lib/decision-comparison/types'

// ── Domain & scenario drafts ──────────────────────────────────────────────────
//
// The compare page cannot read previously-computed affordability results:
// none of the 4 calculators (generic/car/home/travel) persist anything today,
// they are pure client-side "compute on submit" forms. So each scenario here
// is built from a minimal set of the SAME required fields the dedicated
// domain APIs already validate — the compare API re-runs the real Sprint 24A
// adapters against this raw input, it never receives a precomputed result.

export type ScenarioDomain = 'generic' | 'car' | 'home' | 'travel'

export const SCENARIO_DOMAINS: ScenarioDomain[] = ['generic', 'car', 'home', 'travel']

export type ScenarioFieldValues = Record<string, string>

export interface ScenarioDraft {
  id: string
  domain: ScenarioDomain
  label: string
  fields: ScenarioFieldValues
}

export const DOMAIN_LABELS: Record<ScenarioDomain, string> = {
  generic: 'Acquisto generico',
  car: 'Auto',
  home: 'Casa',
  travel: 'Vacanza',
}

// ── Field configuration per domain ────────────────────────────────────────────

export interface FieldConfig {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  required: boolean
  options?: { value: string; label: string }[]
  min?: number
  step?: number
  /** Only required when the given other field has this value. */
  requiredWhen?: { field: string; equals: string }
}

export const DOMAIN_FIELDS: Record<ScenarioDomain, FieldConfig[]> = {
  generic: [
    { key: 'purchaseName', label: 'Nome acquisto', type: 'text', required: true },
    { key: 'totalPrice', label: 'Prezzo totale (€)', type: 'number', required: true, min: 0.01, step: 0.01 },
    {
      key: 'paymentMode',
      label: 'Modalità di pagamento',
      type: 'select',
      required: true,
      options: [
        { value: 'IMMEDIATE', label: 'Pagamento immediato' },
        { value: 'INSTALLMENTS', label: 'Pagamento rateale' },
      ],
    },
    { key: 'purchaseDate', label: 'Data prevista', type: 'date', required: true },
    { key: 'installmentAmount', label: 'Rata mensile (€)', type: 'number', required: false, min: 0.01, step: 0.01, requiredWhen: { field: 'paymentMode', equals: 'INSTALLMENTS' } },
    { key: 'numberOfInstallments', label: 'Numero rate', type: 'number', required: false, min: 1, step: 1, requiredWhen: { field: 'paymentMode', equals: 'INSTALLMENTS' } },
  ],
  car: [
    { key: 'carName', label: 'Nome auto', type: 'text', required: true },
    { key: 'purchasePrice', label: 'Prezzo di acquisto (€)', type: 'number', required: true, min: 0.01, step: 0.01 },
    {
      key: 'paymentMode',
      label: 'Modalità di pagamento',
      type: 'select',
      required: true,
      options: [
        { value: 'IMMEDIATE', label: 'Pagamento immediato' },
        { value: 'FINANCING', label: 'Finanziamento' },
      ],
    },
    { key: 'purchaseDate', label: 'Data prevista', type: 'date', required: true },
    { key: 'ownershipYears', label: 'Anni di possesso previsti', type: 'number', required: true, min: 0.5, step: 0.5 },
    { key: 'installmentAmount', label: 'Rata mensile (€)', type: 'number', required: false, min: 0.01, step: 0.01, requiredWhen: { field: 'paymentMode', equals: 'FINANCING' } },
    { key: 'numberOfInstallments', label: 'Numero rate', type: 'number', required: false, min: 1, step: 1, requiredWhen: { field: 'paymentMode', equals: 'FINANCING' } },
  ],
  home: [
    { key: 'simulationName', label: 'Nome simulazione', type: 'text', required: true },
    {
      key: 'condition',
      label: 'Condizione immobile',
      type: 'select',
      required: true,
      options: [
        { value: 'new_build', label: 'Nuova costruzione' },
        { value: 'used', label: 'Usato' },
      ],
    },
    {
      key: 'purpose',
      label: 'Destinazione',
      type: 'select',
      required: true,
      options: [
        { value: 'primary_home', label: 'Prima casa' },
        { value: 'other_home', label: 'Seconda casa' },
      ],
    },
    { key: 'askingPrice', label: 'Prezzo richiesto (€)', type: 'number', required: true, min: 0.01, step: 0.01 },
    { key: 'agreedPrice', label: 'Prezzo concordato (€)', type: 'number', required: true, min: 0.01, step: 0.01 },
    { key: 'purchaseDate', label: 'Data prevista', type: 'date', required: true },
    { key: 'ownershipYears', label: 'Anni di possesso previsti', type: 'number', required: true, min: 1, step: 1 },
    {
      key: 'paymentMode',
      label: 'Modalità di pagamento',
      type: 'select',
      required: true,
      options: [
        { value: 'IMMEDIATE', label: 'Pagamento immediato' },
        { value: 'MORTGAGE', label: 'Mutuo' },
      ],
    },
    { key: 'mortgageMonthlyPayment', label: 'Rata mutuo mensile (€)', type: 'number', required: false, min: 0.01, step: 0.01, requiredWhen: { field: 'paymentMode', equals: 'MORTGAGE' } },
    { key: 'mortgageDurationMonths', label: 'Durata mutuo (mesi)', type: 'number', required: false, min: 1, step: 1, requiredWhen: { field: 'paymentMode', equals: 'MORTGAGE' } },
  ],
  travel: [
    { key: 'simulationName', label: 'Nome viaggio', type: 'text', required: true },
    { key: 'travelers', label: 'Numero viaggiatori', type: 'number', required: true, min: 1, step: 1 },
    { key: 'bookingDate', label: 'Data prenotazione', type: 'date', required: true },
    { key: 'departureDate', label: 'Data partenza', type: 'date', required: true },
    { key: 'returnDate', label: 'Data rientro', type: 'date', required: true },
  ],
}

const NUMERIC_KEYS = new Set(['totalPrice', 'installmentAmount', 'numberOfInstallments', 'purchasePrice', 'ownershipYears', 'askingPrice', 'agreedPrice', 'mortgageMonthlyPayment', 'mortgageDurationMonths', 'travelers'])
const INT_KEYS = new Set(['numberOfInstallments', 'mortgageDurationMonths', 'travelers'])

export function createEmptyDraft(id: string, domain: ScenarioDomain): ScenarioDraft {
  const fields: ScenarioFieldValues = {}
  for (const f of DOMAIN_FIELDS[domain]) fields[f.key] = ''
  return { id, domain, label: '', fields }
}

// ── Validation (client-side, mirrors server requirements for fast feedback) ──

export function isFieldRequired(field: FieldConfig, fields: ScenarioFieldValues): boolean {
  if (field.required) return true
  if (field.requiredWhen && fields[field.requiredWhen.field] === field.requiredWhen.equals) return true
  return false
}

export function getMissingFields(domain: ScenarioDomain, fields: ScenarioFieldValues): string[] {
  return DOMAIN_FIELDS[domain]
    .filter((f) => isFieldRequired(f, fields) && !fields[f.key]?.trim())
    .map((f) => f.label)
}

export function isDraftComplete(draft: ScenarioDraft): boolean {
  return getMissingFields(draft.domain, draft.fields).length === 0
}

export interface ScenarioCountValidation {
  ok: boolean
  reason: string | null
}

export function validateScenarioCount(count: number): ScenarioCountValidation {
  if (count < MIN_SCENARIOS) {
    return { ok: false, reason: `Seleziona almeno ${MIN_SCENARIOS} scenari per avviare il confronto.` }
  }
  if (count > MAX_SCENARIOS) {
    return { ok: false, reason: `Non è possibile confrontare più di ${MAX_SCENARIOS} scenari contemporaneamente.` }
  }
  return { ok: true, reason: null }
}

export function hasDuplicateLabels(drafts: ScenarioDraft[]): boolean {
  const names = drafts.map((d) => (d.label.trim() || d.fields.purchaseName || d.fields.carName || d.fields.simulationName || '').trim().toLowerCase()).filter(Boolean)
  return new Set(names).size !== names.length
}

export function canStartComparison(drafts: ScenarioDraft[]): { ok: boolean; reason: string | null } {
  const count = validateScenarioCount(drafts.length)
  if (!count.ok) return count
  const incomplete = drafts.filter((d) => !isDraftComplete(d))
  if (incomplete.length > 0) {
    return { ok: false, reason: 'Completa tutti i campi obbligatori di ogni scenario prima di confrontare.' }
  }
  return { ok: true, reason: null }
}

// ── Building the API payload ──────────────────────────────────────────────────

function parseFieldValue(key: string, raw: string): string | number {
  if (!NUMERIC_KEYS.has(key)) return raw
  const n = Number(raw.replace(',', '.'))
  return INT_KEYS.has(key) ? Math.trunc(n) : n
}

export function buildScenarioInput(draft: ScenarioDraft): Record<string, unknown> {
  const input: Record<string, unknown> = { currency: 'EUR' }
  for (const f of DOMAIN_FIELDS[draft.domain]) {
    const raw = draft.fields[f.key]
    if (!raw) continue
    input[f.key] = parseFieldValue(f.key, raw)
  }
  return input
}

export interface ComparePayload {
  scenarios: Array<{ id: string; domain: ScenarioDomain; label?: string; input: Record<string, unknown> }>
  profile: string
  customWeights?: Record<string, number> | null
}

export function buildComparePayload(
  drafts: ScenarioDraft[],
  profile: string,
  customWeights: Partial<Record<CriterionKey, number>> | null,
): ComparePayload {
  return {
    scenarios: drafts.map((d) => ({
      id: d.id,
      domain: d.domain,
      ...(d.label.trim() ? { label: d.label.trim() } : {}),
      input: buildScenarioInput(d),
    })),
    profile,
    ...(profile === 'CUSTOM' ? { customWeights } : {}),
  }
}

// ── Custom weights validation ─────────────────────────────────────────────────

export function validateCustomWeights(weights: Partial<Record<CriterionKey, number>>): string | null {
  const values = Object.values(weights).filter((v): v is number => v !== undefined)
  if (values.some((v) => !Number.isFinite(v) || v < 0)) {
    return 'I pesi devono essere numeri maggiori o uguali a zero.'
  }
  if (values.every((v) => v === 0) || values.length === 0) {
    return 'Imposta almeno un peso maggiore di zero.'
  }
  return null
}

export function generateScenarioId(): string {
  return `scn-${Math.random().toString(36).slice(2, 10)}`
}
