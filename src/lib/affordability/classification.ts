import type { AffordabilityBaseline, AffordabilityClassification, AffordabilityInput } from './types'
import type { CostBreakdown, ProjectionResult } from './metrics'
import { THRESHOLDS, DEFAULT_MINIMUM_LIQUIDITY_MONTHS, DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO } from './constants'
import { roundMoney } from '@/lib/scenarios/money'

export type ClassificationInput = {
  baseline: AffordabilityBaseline
  input: AffordabilityInput
  costs: CostBreakdown
  liquidityAfter: number
  coverageMonthsAfter: number | null
  marginAfter: number
  installmentToMarginRatio: number | null
  projection: ProjectionResult
}

function resolveMinMonths(input: AffordabilityInput): number {
  return input.minimumLiquidityMonths ?? DEFAULT_MINIMUM_LIQUIDITY_MONTHS
}

function resolveMaxRatio(input: AffordabilityInput): number {
  return input.maxInstallmentToMarginRatio ?? DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO
}

// ── Sustainability score (0–100, internal) ────────────────────────────────────

export function computeSustainabilityScore(params: ClassificationInput): number {
  const { baseline, input, costs, liquidityAfter, coverageMonthsAfter, marginAfter, installmentToMarginRatio, projection } = params
  const minMonths = resolveMinMonths(input)

  let score = 100

  // 1. Liquidity negative → critical
  if (liquidityAfter < 0) score -= 40
  else if (liquidityAfter < baseline.monthlyExpenses * minMonths * 0.5) score -= 30
  else if (liquidityAfter < baseline.monthlyExpenses * minMonths) score -= 15

  // 2. Coverage months
  if (coverageMonthsAfter !== null) {
    if (coverageMonthsAfter < 0) score -= 20
    else if (coverageMonthsAfter < minMonths * 0.5) score -= 15
    else if (coverageMonthsAfter < minMonths) score -= 8
  }

  // 3. Margin after
  if (marginAfter < 0) score -= 25
  else if (marginAfter < baseline.monthlyExpenses * 0.05) score -= 15
  else if (marginAfter < baseline.monthlyMargin * 0.2) score -= 8

  // 4. Installment to margin ratio
  if (installmentToMarginRatio !== null) {
    const maxRatio = resolveMaxRatio(input)
    if (installmentToMarginRatio > 1) score -= 20
    else if (installmentToMarginRatio > THRESHOLDS.installmentRatioRisky) score -= 15
    else if (installmentToMarginRatio > THRESHOLDS.installmentRatioCaution) score -= 10
    else if (installmentToMarginRatio > maxRatio) score -= 5
  }

  // 5. Negative months
  if (projection.negativeMonths >= 6) score -= 20
  else if (projection.negativeMonths >= 3) score -= 15
  else if (projection.negativeMonths >= 1) score -= 8

  // 6. Minimum projected liquidity
  if (projection.minimumLiquidity < 0) score -= 10

  // 7. Data quality penalty
  if (baseline.dataQuality === 'BASSA') score -= 5
  else if (baseline.dataQuality === 'INSUFFICIENTE') score -= 20

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ── Main classification ───────────────────────────────────────────────────────

export function classify(params: ClassificationInput): AffordabilityClassification {
  const { baseline, input, costs, liquidityAfter, coverageMonthsAfter, marginAfter, installmentToMarginRatio, projection } = params

  // INSUFFICIENT_DATA: no usable data
  if (baseline.dataQuality === 'INSUFFICIENTE') {
    // Still classify if we have liquidity and a known price
    if (baseline.totalLiquidity === 0 && baseline.monthlyIncome === 0) {
      return 'INSUFFICIENT_DATA'
    }
  }

  const minMonths = resolveMinMonths(input)
  const maxRatio = resolveMaxRatio(input)
  const minBuffer = roundMoney(baseline.monthlyExpenses * minMonths)

  // NOT_AFFORDABLE conditions
  if (liquidityAfter < 0) return 'NOT_AFFORDABLE'
  if (marginAfter < 0 && costs.effectiveMonthlyCost > 0) {
    // Only NOT_AFFORDABLE if the margin is severely negative (can't cover installment from margin)
    if (marginAfter < -baseline.monthlyExpenses * 0.1) return 'NOT_AFFORDABLE'
  }
  if (projection.negativeMonths >= 6) return 'NOT_AFFORDABLE'

  // RISKY conditions
  const liquidityBelowHalfBuffer = liquidityAfter < minBuffer * 0.5
  const ratioTooHigh = installmentToMarginRatio !== null && installmentToMarginRatio > THRESHOLDS.installmentRatioRisky
  const tooManyNegativeMonths = projection.negativeMonths >= THRESHOLDS.negativeMonthsRisky
  const marginVeryNegative = marginAfter < -baseline.monthlyExpenses * 0.05

  if (liquidityBelowHalfBuffer || ratioTooHigh || tooManyNegativeMonths || marginVeryNegative) {
    return 'RISKY'
  }

  // CAUTION conditions
  const liquidityBelowBuffer = liquidityAfter < minBuffer
  const ratioBeyondMax = installmentToMarginRatio !== null && installmentToMarginRatio > maxRatio
  const someNegativeMonths = projection.negativeMonths >= THRESHOLDS.negativeMonthsCaution
  const coverageTight = coverageMonthsAfter !== null && coverageMonthsAfter < minMonths
  const marginNegative = marginAfter < 0

  if (liquidityBelowBuffer || ratioBeyondMax || someNegativeMonths || coverageTight || marginNegative) {
    return 'CAUTION'
  }

  return 'AFFORDABLE'
}

// ── Classification label ──────────────────────────────────────────────────────

import { CLASSIFICATION_LABELS } from './constants'

export function classificationLabel(c: AffordabilityClassification): string {
  return CLASSIFICATION_LABELS[c]
}

// ── Summary text ──────────────────────────────────────────────────────────────

export function buildSummary(
  classification: AffordabilityClassification,
  params: ClassificationInput,
): string {
  const { baseline, input, costs, liquidityAfter, coverageMonthsAfter, marginAfter, projection } = params
  const minMonths = resolveMinMonths(input)

  switch (classification) {
    case 'AFFORDABLE': {
      const coverage = coverageMonthsAfter?.toFixed(1) ?? '—'
      return `L'acquisto è compatibile con la tua situazione attuale. Dopo la spesa, la liquidità stimata è di ${liquidityAfter.toFixed(2)} € (circa ${coverage} mesi di spese).`
    }

    case 'CAUTION': {
      if (liquidityAfter < baseline.monthlyExpenses * minMonths) {
        const coverage = coverageMonthsAfter?.toFixed(1) ?? '—'
        return `L'acquisto è realizzabile, ma ridurrebbe il fondo di sicurezza sotto i ${minMonths} ${minMonths === 1 ? 'mese' : 'mesi'} di spese impostati. La liquidità residua sarebbe di circa ${liquidityAfter.toFixed(2)} € (${coverage} mesi).`
      }
      if (projection.negativeMonths > 0) {
        return `L'acquisto è realizzabile, ma in ${projection.negativeMonths} ${projection.negativeMonths === 1 ? 'mese' : 'mesi'} del periodo analizzato il saldo proiettato scenderebbe sotto zero.`
      }
      return `L'acquisto è realizzabile con cautela. Uno o più indicatori sono vicini alle soglie impostate.`
    }

    case 'RISKY': {
      if (projection.negativeMonths >= 3) {
        return `L'acquisto comporta un rischio elevato. Il saldo proiettato sarebbe negativo per ${projection.negativeMonths} mesi nel periodo analizzato.`
      }
      if (liquidityAfter < baseline.monthlyExpenses) {
        return `L'acquisto è rischioso: la liquidità residua (${liquidityAfter.toFixed(2)} €) coprirebbe meno di un mese di spese abituali.`
      }
      return `L'acquisto presenta rischi significativi basati sui dati attuali. Valuta le alternative proposte.`
    }

    case 'NOT_AFFORDABLE': {
      if (liquidityAfter < 0) {
        return `L'acquisto non è sostenibile: il costo iniziale (${costs.upfrontCost.toFixed(2)} €) supera la liquidità disponibile (${baseline.totalLiquidity.toFixed(2)} €).`
      }
      if (marginAfter < 0) {
        return `L'acquisto non è sostenibile: la rata mensile supera il margine disponibile. Il margine dopo l'acquisto sarebbe di ${marginAfter.toFixed(2)} €/mese.`
      }
      return `L'acquisto non appare sostenibile con la situazione finanziaria attuale registrata in Aurora.`
    }

    case 'INSUFFICIENT_DATA': {
      return `Non è stato possibile effettuare una valutazione affidabile per mancanza di dati storici sufficienti. Registra entrate e uscite in Aurora per ottenere una stima più accurata.`
    }
  }
}
