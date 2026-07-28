import type { AffordabilityBaseline, AffordabilityInput, AffordabilityReason, AffordabilityRisk } from './types'
import type { CostBreakdown, ProjectionResult } from './metrics'
import { DEFAULT_MINIMUM_LIQUIDITY_MONTHS, DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO } from './constants'
import { roundMoney } from '@/lib/scenarios/money'

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(n)
}

function fmtPct(ratio: number) {
  return `${Math.round(ratio * 100)}%`
}

const THRESHOLDS_INLINE = {
  installmentRatioCaution: 0.50,
}

// ── Reasons (ordered by importance) ──────────────────────────────────────────

export function buildReasons(
  baseline: AffordabilityBaseline,
  input: AffordabilityInput,
  costs: CostBreakdown,
  liquidityAfter: number,
  coverageMonthsAfter: number | null,
  marginAfter: number,
  installmentToMarginRatio: number | null,
  projection: ProjectionResult,
): AffordabilityReason[] {
  const reasons: AffordabilityReason[] = []
  const minMonths = input.minimumLiquidityMonths ?? DEFAULT_MINIMUM_LIQUIDITY_MONTHS
  const maxRatio = input.maxInstallmentToMarginRatio ?? DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO

  // 1. Liquidity
  {
    const minBuffer = roundMoney(baseline.monthlyExpenses * minMonths)
    if (liquidityAfter < 0) {
      reasons.push({
        category: 'LIQUIDITA',
        text: `L'importo da pagare (${fmt(costs.upfrontCost)}) supera la liquidità disponibile (${fmt(baseline.totalLiquidity)}). Il saldo diventerebbe negativo di ${fmt(Math.abs(liquidityAfter))}.`,
        severity: 'critical',
      })
    } else if (liquidityAfter < minBuffer * 0.5) {
      reasons.push({
        category: 'LIQUIDITA',
        text: `Dopo l'acquisto rimarrebbero ${fmt(liquidityAfter)}, pari a ${(coverageMonthsAfter ?? 0).toFixed(1)} mesi di spese. Il parametro impostato è ${minMonths} mesi (${fmt(minBuffer)}).`,
        severity: 'critical',
      })
    } else if (liquidityAfter < minBuffer) {
      reasons.push({
        category: 'LIQUIDITA',
        text: `Dopo l'acquisto rimarrebbero ${fmt(liquidityAfter)} (${(coverageMonthsAfter ?? 0).toFixed(1)} mesi di spese), sotto il parametro di ${minMonths} mesi impostato (${fmt(minBuffer)}).`,
        severity: 'warning',
      })
    } else {
      reasons.push({
        category: 'LIQUIDITA',
        text: `Dopo l'acquisto rimarrebbero ${fmt(liquidityAfter)} (${(coverageMonthsAfter ?? 0).toFixed(1)} mesi di spese), sopra il parametro di ${minMonths} mesi impostato.`,
        severity: 'info',
      })
    }
  }

  // 2. Monthly margin
  {
    if (marginAfter < 0) {
      reasons.push({
        category: 'MARGINE',
        text: `Il margine mensile dopo l'acquisto è stimato a ${fmt(marginAfter)}/mese. Le uscite mensili totali supererebbero le entrate.`,
        severity: 'critical',
      })
    } else {
      const drop = baseline.monthlyMargin > 0
        ? roundMoney((baseline.monthlyMargin - marginAfter) / baseline.monthlyMargin)
        : null
      const dropText = drop !== null ? ` (−${fmtPct(drop)} rispetto all'attuale)` : ''
      reasons.push({
        category: 'MARGINE',
        text: `Margine mensile: ${fmt(baseline.monthlyMargin)}/mese prima, ${fmt(marginAfter)}/mese dopo l'acquisto${dropText}.`,
        severity: marginAfter < baseline.monthlyMargin * 0.3 ? 'warning' : 'info',
      })
    }
  }

  // 3. Installments (only if installment mode)
  if (input.paymentMode === 'INSTALLMENTS' && costs.monthlyInstallment > 0) {
    if (installmentToMarginRatio !== null) {
      const pct = fmtPct(installmentToMarginRatio)
      const severity = installmentToMarginRatio > THRESHOLDS_INLINE.installmentRatioCaution ? 'warning'
        : installmentToMarginRatio > maxRatio ? 'warning' : 'info'
      reasons.push({
        category: 'RATE',
        text: `La rata di ${fmt(costs.monthlyInstallment)}/mese rappresenta il ${pct} del margine mensile attuale. Il parametro impostato è ${fmtPct(maxRatio)}.`,
        severity,
      })
    }
    if (costs.balloonPayment > 0) {
      reasons.push({
        category: 'RATE',
        text: `È prevista una maxi-rata finale di ${fmt(costs.balloonPayment)}.`,
        severity: 'warning',
      })
    }
  }

  // 4. Recurring cost
  if (costs.recurringMonthlyCost > 0) {
    const linkedText = (input.linkedMonthlyIncome ?? 0) > 0
      ? ` Al netto di ${fmt(input.linkedMonthlyIncome!)} di entrata mensile collegata, il costo netto è ${fmt(costs.effectiveMonthlyCost)}/mese.`
      : ''
    reasons.push({
      category: 'SPESE_FUTURE',
      text: `L'acquisto genera un costo ricorrente stimato di ${fmt(costs.recurringMonthlyCost)}/mese.${linkedText}`,
      severity: costs.effectiveMonthlyCost > baseline.monthlyMargin * 0.2 ? 'warning' : 'info',
    })
  }

  // 5. Negative months
  if (projection.negativeMonths > 0) {
    reasons.push({
      category: 'FONDO',
      text: `Nel periodo analizzato, il saldo proiettato scenderebbe sotto zero in ${projection.negativeMonths} ${projection.negativeMonths === 1 ? 'mese' : 'mesi'}.`,
      severity: projection.negativeMonths >= 3 ? 'critical' : 'warning',
    })
  }

  // 6. Data quality
  if (baseline.dataQuality === 'BASSA' || baseline.dataQuality === 'INSUFFICIENTE') {
    reasons.push({
      category: 'DATI',
      text: `Valutazione basata su dati di qualità ${baseline.dataQuality === 'BASSA' ? 'bassa' : 'insufficiente'}. ${baseline.historicMonthsAvailable === 0 ? 'Nessuna transazione storica trovata.' : `Storico disponibile: ${baseline.historicMonthsAvailable} ${baseline.historicMonthsAvailable === 1 ? 'mese' : 'mesi'}.`} Il risultato è indicativo.`,
      severity: baseline.dataQuality === 'INSUFFICIENTE' ? 'critical' : 'warning',
    })
  }

  // Sort: critical first, then warning, then info
  return reasons.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })
}

// ── Risks ─────────────────────────────────────────────────────────────────────

export function buildRisks(
  baseline: AffordabilityBaseline,
  input: AffordabilityInput,
  costs: CostBreakdown,
  liquidityAfter: number,
  projection: ProjectionResult,
): AffordabilityRisk[] {
  const risks: AffordabilityRisk[] = []
  const minMonths = input.minimumLiquidityMonths ?? DEFAULT_MINIMUM_LIQUIDITY_MONTHS

  if (projection.negativeMonths > 0) {
    risks.push({
      text: `Saldo proiettato negativo in ${projection.negativeMonths} ${projection.negativeMonths === 1 ? 'mese' : 'mesi'}: qualsiasi spesa imprevista aggraverebbe la situazione.`,
      severity: 'critical',
    })
  }

  if (liquidityAfter < baseline.monthlyExpenses * minMonths) {
    risks.push({
      text: `Il fondo di emergenza scenderebbe sotto i ${minMonths} mesi di spese, riducendo la capacità di far fronte a imprevisti.`,
      severity: liquidityAfter < baseline.monthlyExpenses ? 'critical' : 'warning',
    })
  }

  if (costs.monthlyInstallment > 0 && costs.monthlyInstallment > baseline.monthlyMargin * 0.5) {
    risks.push({
      text: `La rata mensile è elevata rispetto al margine. In caso di riduzione delle entrate, potrebbe diventare difficile da sostenere.`,
      severity: 'warning',
    })
  }

  if (costs.balloonPayment > 0) {
    risks.push({
      text: `La maxi-rata finale di ${fmt(costs.balloonPayment)} richiede di avere liquidità disponibile al termine del periodo di rateizzazione.`,
      severity: 'warning',
    })
  }

  if (costs.recurringMonthlyCost > 0) {
    risks.push({
      text: `Il costo ricorrente di ${fmt(costs.recurringMonthlyCost)}/mese è un impegno continuativo che si aggiunge alle uscite abituali.`,
      severity: 'info',
    })
  }

  if (baseline.incomeSource === 'RECURRING' || baseline.incomeSource === 'NONE') {
    risks.push({
      text: 'Le entrate mensili sono state stimate in base alle ricorrenze (nessuna transazione recente). Se le entrate effettive differiscono, il risultato potrebbe variare.',
      severity: 'warning',
    })
  }

  if (baseline.dataQuality === 'BASSA') {
    risks.push({
      text: 'Il risultato è indicativo perché Aurora dispone di pochi dati storici. Registra più transazioni per una stima più affidabile.',
      severity: 'warning',
    })
  }

  return risks.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })
}

