import type { AffordabilityClassification, AffordabilityResult } from '../types'

export type TransportMode = 'car' | 'plane' | 'train' | 'ship' | 'bus'
export type LodgingType = 'hotel' | 'apartment' | 'resort' | 'bb' | 'camping' | 'other'
export type MealMode = 'daily_budget' | 'total'

export interface TravelPayment {
  label: string
  amount: number
  date: string
}

export interface TravelInput {
  simulationName: string
  destination?: string | null
  country?: string | null
  currency: string
  travelers: number
  adults?: number | null
  children?: number | null
  bookingDate: string
  departureDate: string
  returnDate: string

  transportMode?: TransportMode | null
  transport?: {
    mainTrip?: number | null
    fuel?: number | null
    tolls?: number | null
    parking?: number | null
    taxi?: number | null
    transfers?: number | null
    rentalCar?: number | null
    other?: number | null
  } | null

  lodgingType?: LodgingType | null
  lodging?: {
    totalCost?: number | null
    deposit?: number | null
    balance?: number | null
    securityDeposit?: number | null
    cleaning?: number | null
    touristTax?: number | null
  } | null

  meals?: {
    mode?: MealMode | null
    dailyBudgetPerPerson?: number | null
    totalCost?: number | null
  } | null

  activities?: {
    excursions?: number | null
    museums?: number | null
    parks?: number | null
    events?: number | null
    beach?: number | null
    sports?: number | null
    rentals?: number | null
    other?: number | null
  } | null

  extras?: {
    shopping?: number | null
    souvenirs?: number | null
    travelInsurance?: number | null
    roaming?: number | null
    tips?: number | null
    contingency?: number | null
    other?: number | null
  } | null

  payments?: TravelPayment[] | null

  currentMonthlySaving?: number | null
  minimumLiquidityMonths?: number | null
  maxInstallmentToMarginRatio?: number | null
  horizonMonths?: number | null
  includeGoalContributions?: boolean | null

  compareWithTravel?: TravelComparisonInput | null
}

export interface TravelComparisonInput {
  label: string
  totalCost: number
  departureDate: string
  returnDate: string
  upfrontCost?: number | null
}

export interface TravelCosts {
  durationDays: number
  nights: number
  travelers: number
  transportTotal: number
  lodgingTotal: number
  mealsTotal: number
  activitiesTotal: number
  extrasTotal: number
  totalTripCost: number
  upfrontCost: number
  duringTripCost: number
  afterReturnCost: number
  suggestedMonthlySaving: number
  monthsUntilDeparture: number
  maxSustainableBudgetLow: number | null
  maxSustainableBudgetHigh: number | null
  missingCosts: string[]
  payments: TravelPayment[]
  breakdown: Array<{ label: string; amount: number }>
}

export interface TravelComparisonSide {
  label: string
  totalCost: number
  durationDays: number
  liquidityAfter: number
  coverageMonthsAfter: number | null
  classification: AffordabilityClassification
  classificationLabel: string
}

export interface TravelComparisonResult {
  travelA: TravelComparisonSide
  travelB: TravelComparisonSide
  insight: {
    lowerCost: 'A' | 'B' | 'equal'
    shorterDuration: 'A' | 'B' | 'equal'
    betterLiquidity: 'A' | 'B' | 'equal'
    betterSustainability: 'A' | 'B' | 'equal'
  }
}

export type TravelAffordabilityResult = AffordabilityResult & {
  travelMetrics: TravelCosts
  travelComparison: TravelComparisonResult | null
  departureShiftComparison: Array<{
    label: string
    departureDate: string
    suggestedMonthlySaving: number
    liquidityAfter: number
    classification: AffordabilityClassification
    classificationLabel: string
  }>
}
