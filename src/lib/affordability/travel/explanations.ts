import type { AffordabilityReason, AffordabilityRisk } from '../types'
import type { TravelCosts, TravelInput } from './types'

export function buildTravelReasons(costs: TravelCosts, liquidityAfter: number, coverageMonthsAfter: number | null): AffordabilityReason[] {
  const reasons: AffordabilityReason[] = [
    {
      category: 'LIQUIDITA',
      severity: liquidityAfter < 0 ? 'critical' : 'info',
      text: `La vacanza costa ${costs.totalTripCost.toFixed(2)} € e lascia una liquidità stimata di ${liquidityAfter.toFixed(2)} €.`,
    },
    {
      category: 'FONDO',
      severity: coverageMonthsAfter != null && coverageMonthsAfter < 3 ? 'warning' : 'info',
      text: `Dopo la vacanza resterebbero ${coverageMonthsAfter?.toFixed(1) ?? '—'} mesi di copertura spese.`,
    },
  ]
  if (costs.monthsUntilDeparture > 0) {
    reasons.push({
      category: 'MARGINE',
      severity: 'info',
      text: `Per arrivare alla partenza con il budget coperto servirebbe accantonare circa ${costs.suggestedMonthlySaving.toFixed(2)} € al mese.`,
    })
  }
  return reasons
}

export function buildTravelRisks(input: TravelInput, costs: TravelCosts): AffordabilityRisk[] {
  const risks: AffordabilityRisk[] = []
  if (costs.missingCosts.length > 0) {
    risks.push({ severity: 'warning', text: `Valutazione parziale: mancano ${costs.missingCosts.join(', ')}.` })
  }
  if (!input.payments || input.payments.length === 0) {
    risks.push({ severity: 'info', text: 'Il calendario pagamenti è stato derivato dai dati inseriti; aggiungi date reali per una proiezione più precisa.' })
  }
  if (costs.upfrontCost > 0 && costs.duringTripCost > 0) {
    risks.push({ severity: 'info', text: 'La vacanza concentra spese sia alla prenotazione sia durante il viaggio: verifica i picchi di liquidità.' })
  }
  return risks
}
