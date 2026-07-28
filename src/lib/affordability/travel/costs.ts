import { roundMoney, sumMoney } from '@/lib/scenarios/money'
import { daysInclusive, monthsUntil, nightsBetween, normalizeTravelPayments } from './schedule'
import type { TravelCosts, TravelInput } from './types'

const n = (value: number | null | undefined): number => value ?? 0

function sumObject(values: Record<string, number | null | undefined> | null | undefined): number {
  if (!values) return 0
  return sumMoney(Object.values(values).map(n))
}

function mealsTotal(input: TravelInput, durationDays: number): number {
  const meals = input.meals
  if (!meals) return 0
  if ((meals.mode ?? 'daily_budget') === 'total') return roundMoney(n(meals.totalCost))
  return roundMoney(n(meals.dailyBudgetPerPerson) * durationDays * input.travelers)
}

function lodgingTotal(input: TravelInput): number {
  const lodging = input.lodging
  if (!lodging) return 0
  const base = n(lodging.totalCost) || sumMoney([n(lodging.deposit), n(lodging.balance)])
  return sumMoney([base, n(lodging.securityDeposit), n(lodging.cleaning), n(lodging.touristTax)])
}

function missingCosts(input: TravelInput): string[] {
  const missing: string[] = []
  if (!input.transport || sumObject(input.transport) === 0) missing.push('trasporti')
  if (!input.lodging || lodgingTotal(input) === 0) missing.push('alloggio')
  if (!input.meals || mealsTotal(input, daysInclusive(input.departureDate, input.returnDate)) === 0) missing.push('pasti')
  if (!input.activities || sumObject(input.activities) === 0) missing.push('attività')
  if (!input.extras || sumObject(input.extras) === 0) missing.push('extra e imprevisti')
  return missing
}

export function computeTravelCosts(input: TravelInput, now: Date): TravelCosts {
  const durationDays = daysInclusive(input.departureDate, input.returnDate)
  const nights = nightsBetween(input.departureDate, input.returnDate)
  const transportTotal = sumObject(input.transport)
  const accommodationTotal = lodgingTotal(input)
  const mealCost = mealsTotal(input, durationDays)
  const activitiesTotal = sumObject(input.activities)
  const extrasTotal = sumObject(input.extras)
  const totalTripCost = sumMoney([transportTotal, accommodationTotal, mealCost, activitiesTotal, extrasTotal])
  const payments = normalizeTravelPayments(input, totalTripCost)
  const upfrontCost = sumMoney(payments.filter((payment) => payment.date <= input.bookingDate).map((payment) => payment.amount))
  const duringTripCost = sumMoney(payments.filter((payment) => payment.date >= input.departureDate && payment.date <= input.returnDate).map((payment) => payment.amount))
  const afterReturnCost = sumMoney(payments.filter((payment) => payment.date > input.returnDate).map((payment) => payment.amount))
  const months = monthsUntil(now, input.departureDate)
  const alreadyPlanned = n(input.currentMonthlySaving) * months
  const suggestedMonthlySaving = months > 0 ? roundMoney(Math.max(0, totalTripCost - alreadyPlanned) / months) : totalTripCost

  return {
    durationDays,
    nights,
    travelers: input.travelers,
    transportTotal,
    lodgingTotal: accommodationTotal,
    mealsTotal: mealCost,
    activitiesTotal,
    extrasTotal,
    totalTripCost,
    upfrontCost,
    duringTripCost,
    afterReturnCost,
    suggestedMonthlySaving,
    monthsUntilDeparture: months,
    maxSustainableBudgetLow: null,
    maxSustainableBudgetHigh: null,
    missingCosts: missingCosts(input),
    payments,
    breakdown: [
      { label: 'Trasporti', amount: transportTotal },
      { label: 'Alloggio', amount: accommodationTotal },
      { label: 'Pasti', amount: mealCost },
      { label: 'Attività', amount: activitiesTotal },
      { label: 'Extra', amount: extrasTotal },
    ].filter((row) => row.amount > 0),
  }
}
