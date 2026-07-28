import type { AffordabilityReason, AffordabilityRisk, AffordabilityAlternative } from '../types'
import type { CarInput, CarCosts } from './types'

const fmt = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

// ── Car-specific reasons ───────────────────────────────────────────────────────

export function buildCarReasons(
  input: CarInput,
  costs: CarCosts,
  baselineMargin: number,
  totalLiquidity: number,
  negativeMonths: number,
  liquidityAfter: number,
): AffordabilityReason[] {
  const reasons: AffordabilityReason[] = []
  const c = input.currency ?? 'EUR'

  if (costs.totalReductions > 0) {
    reasons.push({
      category: 'LIQUIDITA',
      text: `Riduzioni totali di ${fmt(costs.totalReductions, c)} (sconti, incentivi, permuta) abbassano il costo effettivo a ${fmt(costs.effectivePurchasePrice, c)}.`,
      severity: 'info',
    })
  }

  if (costs.financingTotalCost > 0) {
    reasons.push({
      category: 'RATE',
      text: `Il finanziamento comporta un costo totale extra di ${fmt(costs.financingTotalCost, c)} rispetto al prezzo di acquisto.`,
      severity: costs.financingTotalCost > costs.effectivePurchasePrice * 0.15 ? 'warning' : 'info',
    })
  }

  if (input.paymentMode === 'FINANCING' && baselineMargin > 0) {
    const ratio = costs.monthlyInstallment / baselineMargin
    if (ratio > 0.5) {
      reasons.push({
        category: 'RATE',
        text: `La rata mensile di ${fmt(costs.monthlyInstallment, c)} rappresenta il ${Math.round(ratio * 100)}% del margine disponibile (soglia prudente: 35%).`,
        severity: ratio > 0.7 ? 'critical' : 'warning',
      })
    } else if (ratio > 0) {
      reasons.push({
        category: 'RATE',
        text: `La rata mensile di ${fmt(costs.monthlyInstallment, c)} è pari al ${Math.round(ratio * 100)}% del margine mensile — impatto gestibile.`,
        severity: 'info',
      })
    }
  }

  if (costs.totalMonthlyRunningCost > 0) {
    reasons.push({
      category: 'SPESE_FUTURE',
      text: `I costi mensili ricorrenti (assicurazione, bollo, carburante, manutenzione) ammontano a ${fmt(costs.totalMonthlyRunningCost, c)}/mese.`,
      severity: costs.totalMonthlyRunningCost > baselineMargin * 0.3 ? 'warning' : 'info',
    })
  }

  if (costs.averageMonthlyOwnershipCost > 0) {
    reasons.push({
      category: 'SPESE_FUTURE',
      text: `Il costo medio mensile di possesso sull'intero periodo (${input.ownershipYears} anni) è di ${fmt(costs.averageMonthlyOwnershipCost, c)}/mese.`,
      severity: 'info',
    })
  }

  if (costs.incrementalMonthlyCost > 0 && costs.currentCarMonthlyCost > 0) {
    reasons.push({
      category: 'SPESE_FUTURE',
      text: `Rispetto all'auto attuale, il costo mensile aumenta di ${fmt(costs.incrementalMonthlyCost, c)}.`,
      severity: costs.incrementalMonthlyCost > baselineMargin * 0.2 ? 'warning' : 'info',
    })
  } else if (costs.incrementalMonthlyCost < 0 && costs.currentCarMonthlyCost > 0) {
    reasons.push({
      category: 'LIQUIDITA',
      text: `Rispetto all'auto attuale, il costo mensile si riduce di ${fmt(Math.abs(costs.incrementalMonthlyCost), c)}.`,
      severity: 'info',
    })
  }

  if (costs.residualValue > 0) {
    reasons.push({
      category: 'LIQUIDITA',
      text: `Il valore residuo stimato di ${fmt(costs.residualValue, c)} riduce il costo netto di possesso a ${fmt(costs.netOwnershipCost, c)}.`,
      severity: 'info',
    })
  }

  if (negativeMonths > 0) {
    reasons.push({
      category: 'LIQUIDITA',
      text: `La liquidità potrebbe scendere sotto zero in ${negativeMonths} ${negativeMonths === 1 ? 'mese' : 'mesi'} sui prossimi ${input.horizonMonths ?? 24}.`,
      severity: negativeMonths >= 3 ? 'critical' : 'warning',
    })
  }

  if (costs.missingCosts.length > 0) {
    reasons.push({
      category: 'DATI',
      text: `Costi non forniti e non inclusi nel calcolo: ${costs.missingCosts.join(', ')}. Il costo effettivo sarà probabilmente più alto.`,
      severity: 'warning',
    })
  }

  if (costs.costPerKilometer != null) {
    reasons.push({
      category: 'SPESE_FUTURE',
      text: `Costo per chilometro percorso: ${fmt(costs.costPerKilometer, c)}/km (su ${(input.annualKm ?? 0).toLocaleString('it-IT')} km/anno).`,
      severity: 'info',
    })
  }

  return reasons
}

// ── Car-specific risks ─────────────────────────────────────────────────────────

export function buildCarRisks(
  input: CarInput,
  costs: CarCosts,
  baselineMargin: number,
  liquidityAfter: number,
  negativeMonths: number,
): AffordabilityRisk[] {
  const risks: AffordabilityRisk[] = []
  const c = input.currency ?? 'EUR'

  if (liquidityAfter < 0) {
    risks.push({
      text: 'Il pagamento iniziale azzera la liquidità disponibile — nessun margine di sicurezza per imprevisti.',
      severity: 'critical',
    })
  }

  if (input.paymentMode === 'FINANCING' && costs.financingTotalCost > costs.effectivePurchasePrice * 0.2) {
    risks.push({
      text: `Il costo totale del finanziamento (${fmt(costs.financingTotalCost, c)}) supera il 20% del prezzo — valuta un anticipo maggiore o un periodo più breve.`,
      severity: 'warning',
    })
  }

  if (costs.missingCosts.length >= 2) {
    risks.push({
      text: `Con ${costs.missingCosts.length} voci di costo mancanti, il reale impatto mensile è probabilmente superiore a quello calcolato.`,
      severity: 'warning',
    })
  }

  if (input.fuelType === 'electric' && !input.initialCosts?.wallbox) {
    risks.push({
      text: "Per i veicoli elettrici, considera il costo di installazione della wallbox domestica se non già incluso.",
      severity: 'info',
    })
  }

  if (input.ownershipYears > 10 && (input.condition === 'used' || !input.condition)) {
    risks.push({
      text: "Periodi di possesso superiori a 10 anni su auto usate comportano rischi di spese straordinarie elevate non prevedibili.",
      severity: 'warning',
    })
  }

  if (negativeMonths >= 6) {
    risks.push({
      text: `Con ${negativeMonths} mesi in negativo, il rischio di scoperto bancario o ritardi nei pagamenti è concreto.`,
      severity: 'critical',
    })
  }

  if (input.currentCar?.remainingFinancing && n(input.currentCar.remainingFinancing) > 0) {
    risks.push({
      text: `C'è ancora un debito residuo sull'auto attuale di ${fmt(n(input.currentCar.remainingFinancing), c)} — considera l'estinzione prima del nuovo acquisto.`,
      severity: 'warning',
    })
  }

  return risks
}

function n(v: number | null | undefined): number {
  return v ?? 0
}

// ── Car-specific alternatives ──────────────────────────────────────────────────

export function buildCarAlternatives(
  input: CarInput,
  costs: CarCosts,
  baselineMargin: number,
  liquidityAfter: number,
): AffordabilityAlternative[] {
  const alternatives: AffordabilityAlternative[] = []
  const c = input.currency ?? 'EUR'

  if (input.paymentMode === 'IMMEDIATE' && liquidityAfter < 0) {
    alternatives.push({
      type: 'finanziamento',
      text: 'Finanzia parte dell\'acquisto per ridurre l\'impatto immediato sulla liquidità.',
    })
  }

  if (input.paymentMode === 'FINANCING' && costs.monthlyInstallment > baselineMargin * 0.5 && baselineMargin > 0) {
    const maxInstallment = baselineMargin * 0.35
    alternatives.push({
      type: 'rata_ridotta',
      text: `Estendi la durata del finanziamento per ridurre la rata sotto ${fmt(maxInstallment, c)}/mese (35% del margine mensile).`,
      value: maxInstallment,
    })
  }

  if (costs.totalReductions === 0) {
    alternatives.push({
      type: 'sconto',
      text: 'Negozia uno sconto o un incentivo governativo per ridurre il prezzo di acquisto.',
    })
  }

  if (n(input.tradeInValue) === 0 && input.currentCar && n(input.currentCar.saleValue) > 0) {
    alternatives.push({
      type: 'permuta',
      text: `Utilizza il valore dell'auto attuale (stimato ${fmt(n(input.currentCar.saleValue), c)}) come anticipo o permuta per ridurre il finanziamento.`,
      value: n(input.currentCar.saleValue),
    })
  }

  if (input.ownershipYears > 5 && n(input.estimatedResidualValue) === 0) {
    alternatives.push({
      type: 'valore_residuo',
      text: "Inserisci una stima del valore di rivendita per avere un calcolo del costo netto più accurato.",
    })
  }

  if (costs.energyAnnualCost === 0 && input.fuelType !== 'electric') {
    alternatives.push({
      type: 'costi_energia',
      text: "Aggiungi una stima del costo carburante per un calcolo TCO completo.",
    })
  }

  return alternatives
}
