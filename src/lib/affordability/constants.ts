import type { AffordabilityClassification, AffordabilityDataQuality, PaymentMode } from './types'

// ── Engine version ────────────────────────────────────────────────────────────

export const AFFORDABILITY_ENGINE_VERSION = '1.0.0'

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_MINIMUM_LIQUIDITY_MONTHS = 3
export const DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO = 0.35
export const DEFAULT_HORIZON_MONTHS = 12
export const DEFAULT_INCLUDE_GOAL_CONTRIBUTIONS = true

// ── Limits ────────────────────────────────────────────────────────────────────

export const MAX_PURCHASE_NAME_LENGTH = 120
export const MAX_NOTES_LENGTH = 1000
export const MAX_NUMBER_OF_INSTALLMENTS = 360
export const MAX_HORIZON_MONTHS = 24
export const MAX_PRICE = 10_000_000
export const LOOKBACK_MONTHS = 3        // months of transaction history to use
export const MIN_MONTHS_FOR_GOOD_QUALITY = 6
export const MIN_MONTHS_FOR_MEDIA_QUALITY = 2

// ── Classification thresholds ─────────────────────────────────────────────────
// These are the default thresholds used when user hasn't set custom ones.
// They are compared to the computed metrics, not to hardcoded values.

export const THRESHOLDS = {
  // Ratio: installment / monthly margin
  installmentRatioAffordable: 0.35,
  installmentRatioCaution: 0.50,
  installmentRatioRisky: 0.70,

  // Negative months count
  negativeMonthsAffordable: 0,
  negativeMonthsCaution: 1,
  negativeMonthsRisky: 3,

  // Coverage months factor (multiplied by minimumLiquidityMonths)
  coverageFactorCaution: 1.0,    // exactly at threshold → caution
  coverageFactorRisky: 0.5,      // < 50% of threshold → risky

  // Margin depletion ratio: (newMargin - oldMargin) / oldMargin
  marginDropAffordable: 0.3,     // margin drops up to 30% → ok
  marginDropCaution: 0.5,        // up to 50% → caution
  marginDropRisky: 0.8,          // up to 80% → risky

  // Score thresholds (sustainability score 0-100)
  scoreAffordable: 70,
  scoreCaution: 45,
  scoreRisky: 20,
} as const

// ── Recurring frequency to monthly multiplier ─────────────────────────────────

export const FREQUENCY_MONTHLY_FACTOR: Record<string, number> = {
  daily: 30.44,
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
}

// ── Italian labels ────────────────────────────────────────────────────────────

export const CLASSIFICATION_LABELS: Record<AffordabilityClassification, string> = {
  AFFORDABLE: 'Sostenibile',
  CAUTION: 'Sostenibile con cautela',
  RISKY: 'Rischioso',
  NOT_AFFORDABLE: 'Non sostenibile',
  INSUFFICIENT_DATA: 'Dati insufficienti',
}

export const DATA_QUALITY_LABELS: Record<AffordabilityDataQuality, string> = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BASSA: 'Bassa',
  INSUFFICIENTE: 'Insufficiente',
}

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  IMMEDIATE: 'Pagamento immediato',
  INSTALLMENTS: 'Pagamento rateale',
}

// ── Disclaimer ────────────────────────────────────────────────────────────────

export const DISCLAIMER =
  'Questa valutazione ha finalità organizzative e informative e si basa sui dati registrati in Aurora. Non costituisce consulenza finanziaria.'

export const DISCLAIMER_VARIABILITY =
  'Le spese impreviste e le variazioni future delle entrate potrebbero modificare il risultato.'

export const SIMULATION_NOTE =
  'Simulazione temporanea — nessun dato finanziario è stato modificato.'

// ── Assumption descriptions ───────────────────────────────────────────────────

export const FIXED_ASSUMPTIONS: string[] = [
  'Le entrate e le uscite mensili sono stimate dalla media degli ultimi 3 mesi di transazioni registrate.',
  'Le ricorrenze attive contribuiscono alla stima mensile se non sono disponibili transazioni sufficienti.',
  'Le rate esistenti sui prestiti sono stimate dai pagamenti recenti.',
  'Le contribuzioni agli obiettivi attivi sono stimate dalla media recente.',
  'Nessuna inflazione né variazione automatica degli importi.',
  'Il saldo negativo non genera automaticamente nuovo debito.',
]
