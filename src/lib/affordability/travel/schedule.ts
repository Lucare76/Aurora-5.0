import { roundMoney } from '@/lib/scenarios/money'
import type { TravelInput, TravelPayment } from './types'

export function daysInclusive(start: string, end: string): number {
  return Math.max(1, Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1)
}

export function nightsBetween(start: string, end: string): number {
  return Math.max(0, daysInclusive(start, end) - 1)
}

export function monthsUntil(from: Date, targetDate: string): number {
  const target = new Date(`${targetDate}T00:00:00Z`)
  const months = (target.getUTCFullYear() - from.getUTCFullYear()) * 12 + target.getUTCMonth() - from.getUTCMonth()
  return Math.max(0, months)
}

export function normalizeTravelPayments(input: TravelInput, totalTripCost: number): TravelPayment[] {
  if (input.payments && input.payments.length > 0) {
    return input.payments.map((payment) => ({ ...payment, amount: roundMoney(payment.amount) })).sort((a, b) => a.date.localeCompare(b.date))
  }
  const lodgingDeposit = input.lodging?.deposit ?? 0
  const lodgingBalance = input.lodging?.balance ?? 0
  const payments: TravelPayment[] = []
  if (lodgingDeposit > 0) payments.push({ label: 'Acconto', amount: roundMoney(lodgingDeposit), date: input.bookingDate })
  if (lodgingBalance > 0) payments.push({ label: 'Saldo alloggio', amount: roundMoney(lodgingBalance), date: input.departureDate })
  const remaining = roundMoney(totalTripCost - lodgingDeposit - lodgingBalance)
  if (remaining > 0) payments.push({ label: 'Spese durante il viaggio', amount: remaining, date: input.departureDate })
  return payments.sort((a, b) => a.date.localeCompare(b.date))
}
