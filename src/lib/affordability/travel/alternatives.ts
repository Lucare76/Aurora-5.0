import type { AffordabilityAlternative } from '../types'
import type { TravelCosts } from './types'

export function buildTravelAlternatives(costs: TravelCosts, liquidityAfter: number): AffordabilityAlternative[] {
  const alternatives: AffordabilityAlternative[] = []
  if (liquidityAfter < 0) {
    alternatives.push({ type: 'reduce_budget', text: `Riduci il budget di almeno ${Math.abs(liquidityAfter).toFixed(2)} € per non erodere la liquidità disponibile.`, value: Math.abs(liquidityAfter) })
  }
  if (costs.durationDays > 3) alternatives.push({ type: 'reduce_days', text: 'Ridurre il numero di giorni abbassa pasti, attività e parte dei costi variabili.' })
  if (costs.mealsTotal > 0) alternatives.push({ type: 'reduce_meals', text: 'Riduci il budget giornaliero dei pasti per diminuire il costo totale senza cambiare destinazione.' })
  if (costs.extrasTotal > 0) alternatives.push({ type: 'reduce_extras', text: 'Taglia extra e imprevisti non essenziali prima di ridurre il fondo emergenza.' })
  if (costs.activitiesTotal > 0) alternatives.push({ type: 'reduce_activities', text: 'Riduci attività a pagamento o distribuiscile su un budget più prudente.' })
  alternatives.push({ type: 'postpone', text: 'Posticipare la partenza aumenta i mesi disponibili per accantonare il budget.' })
  alternatives.push({ type: 'increase_saving', text: `Accantona circa ${costs.suggestedMonthlySaving.toFixed(2)} € al mese fino alla partenza.` })
  return alternatives
}
