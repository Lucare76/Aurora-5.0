import { roundMoney } from '@/lib/scenarios/money'
import type { HomeInput } from './types'

const n = (value: number | null | undefined): number => value ?? 0

export function describeMortgage(input: HomeInput): string[] {
  if (input.paymentMode !== 'MORTGAGE') return ['Pagamento immediato senza mutuo.']
  const notes = [
    `Mutuo ${input.mortgageRateType === 'variable' ? 'a tasso variabile dichiarato dall utente' : input.mortgageRateType === 'fixed' ? 'a tasso fisso dichiarato dall utente' : 'con tasso non indicato'}.`,
  ]
  if (input.tan != null) notes.push(`TAN inserito manualmente: ${input.tan}%.`)
  if (input.taeg != null) notes.push(`TAEG inserito manualmente: ${input.taeg}%.`)
  return notes
}

export function computeMortgageTotalPaid(input: HomeInput): number {
  if (input.paymentMode !== 'MORTGAGE') return 0
  return roundMoney(
    n(input.downPayment) +
      n(input.mortgageMonthlyPayment) * n(input.mortgageDurationMonths) +
      n(input.mortgageFees?.balloonPayment) +
      n(input.mortgageFees?.origination) +
      n(input.mortgageFees?.appraisal) +
      n(input.mortgageFees?.mandatoryInsurance) +
      n(input.mortgageFees?.preAmortization) +
      n(input.mortgageFees?.installmentCollection) * n(input.mortgageDurationMonths),
  )
}
