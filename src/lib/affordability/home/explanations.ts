import type { AffordabilityAlternative, AffordabilityReason, AffordabilityRisk } from '../types'
import type { HomeCosts, HomeInput } from './types'
import { roundMoney } from '@/lib/scenarios/money'

export function buildHomeReasons(input: HomeInput, costs: HomeCosts, monthlyMargin: number, liquidityAfter: number): AffordabilityReason[] {
  const reasons: AffordabilityReason[] = []
  reasons.push({
    category: 'LIQUIDITA',
    severity: liquidityAfter < 0 ? 'critical' : costs.upfrontHomeCost > 0 ? 'warning' : 'info',
    text: `L'acquisto richiede un esborso iniziale di ${costs.upfrontHomeCost.toFixed(2)} € e lascia una liquidità stimata di ${liquidityAfter.toFixed(2)} €.`,
  })
  if (input.paymentMode === 'MORTGAGE') {
    const ratio = monthlyMargin > 0 ? costs.mortgageMonthlyPayment / monthlyMargin : null
    reasons.push({
      category: 'RATE',
      severity: ratio != null && ratio > 0.5 ? 'critical' : ratio != null && ratio > 0.35 ? 'warning' : 'info',
      text: `La rata del mutuo è ${costs.mortgageMonthlyPayment.toFixed(2)} €/mese, ma il costo abitativo medio stimato è ${costs.averageMonthlyHousingCost.toFixed(2)} €/mese includendo gestione e costi ricorrenti.`,
    })
  }
  if (costs.currentHousingMonthlyCost > 0) {
    reasons.push({
      category: 'MARGINE',
      severity: costs.incrementalMonthlyHousingCost > monthlyMargin * 0.4 ? 'warning' : 'info',
      text: `Rispetto alla situazione abitativa attuale, l'incremento reale è circa ${costs.incrementalMonthlyHousingCost.toFixed(2)} €/mese.`,
    })
  }
  if (costs.renovationCost > 0 || costs.furnishingCost > 0) {
    reasons.push({
      category: 'SPESE_FUTURE',
      severity: 'warning',
      text: `Lavori e arredamento pesano per ${roundMoney(costs.renovationCost + costs.furnishingCost).toFixed(2)} €: sono costi separati dalla rata.`,
    })
  }
  return reasons
}

export function buildHomeRisks(input: HomeInput, costs: HomeCosts): AffordabilityRisk[] {
  const risks: AffordabilityRisk[] = []
  if (input.mortgageRateType === 'variable') {
    risks.push({ severity: 'warning', text: 'Il tasso variabile è una semplice etichetta inserita dall utente: Aurora non simula variazioni future del tasso.' })
  }
  if (costs.missingCosts.length > 0) {
    risks.push({ severity: 'warning', text: `Valutazione parziale: mancano ${costs.missingCosts.join(', ')}.` })
  }
  if (costs.residualPropertyValue > 0) {
    risks.push({ severity: 'info', text: 'Il valore residuo è una stima inserita dall utente e non viene usato per nascondere criticità di liquidità.' })
  }
  if (costs.renovationContingency === 0 && costs.renovationCost > 0) {
    risks.push({ severity: 'warning', text: 'Sono presenti lavori, ma non è stato indicato un margine prudenziale per imprevisti.' })
  }
  return risks
}

export function buildHomeAlternatives(input: HomeInput, costs: HomeCosts, monthlyMargin: number, liquidityAfter: number): AffordabilityAlternative[] {
  const alternatives: AffordabilityAlternative[] = []
  if (liquidityAfter < 0) {
    alternatives.push({ type: 'reduce_upfront', text: `Per non andare sotto zero, l'esborso iniziale dovrebbe diminuire di circa ${Math.abs(liquidityAfter).toFixed(2)} €.`, value: Math.abs(liquidityAfter) })
  }
  if (costs.furnishingDeferrable > 0) {
    alternatives.push({ type: 'defer_furnishing', text: `Rinviando ${costs.furnishingDeferrable.toFixed(2)} € di arredamento non essenziale, la liquidità iniziale migliorerebbe dello stesso importo.`, value: costs.furnishingDeferrable })
  }
  if (costs.renovationCost > 0) {
    alternatives.push({ type: 'phase_renovation', text: 'Distribuisci i lavori in più tranche per evitare picchi di liquidità nello stesso mese.' })
  }
  if (input.paymentMode === 'MORTGAGE' && monthlyMargin > 0 && costs.mortgageMonthlyPayment > monthlyMargin * 0.35) {
    alternatives.push({ type: 'lower_installment', text: 'Valuta una soluzione con rata più bassa o prezzo inferiore: la rata supera la soglia prudenziale impostata.' })
  }
  alternatives.push({ type: 'wait', text: 'Confronta lo scenario acquistando tra 6, 12 o 24 mesi per aumentare il fondo di emergenza.' })
  if (costs.currentHousingMonthlyCost > 0) {
    alternatives.push({ type: 'rent_vs_buy', text: 'Confronta il mantenimento dell abitazione attuale con l acquisto: la liquidità conta separatamente dal patrimonio teorico.' })
  }
  return alternatives
}
