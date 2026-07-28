import type { FuelType, CarCondition, InsuranceFrequency, FuelCostMode, CarPaymentMode } from './types'

export const MAX_CAR_NAME_LENGTH = 150
export const MAX_OWNERSHIP_YEARS = 20
export const MAX_ANNUAL_KM = 300_000
export const MAX_CAR_PRICE = 10_000_000
export const MAX_INSTALLMENTS = 360
export const DEFAULT_CAR_HORIZON_MONTHS = 24

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  gasoline: 'Benzina',
  diesel: 'Diesel',
  lpg: 'GPL',
  methane: 'Metano',
  hybrid: 'Ibrida',
  plugin_hybrid: 'Ibrida plug-in',
  electric: 'Elettrica',
  other: 'Altra',
}

export const CAR_CONDITION_LABELS: Record<CarCondition, string> = {
  new: 'Nuova',
  used: 'Usata',
}

export const INSURANCE_FREQUENCY_LABELS: Record<InsuranceFrequency, string> = {
  monthly: 'Mensile',
  semiannual: 'Semestrale',
  annual: 'Annuale',
}

export const FUEL_COST_MODE_LABELS: Record<FuelCostMode, string> = {
  monthly_estimate: 'Stima mensile',
  usage_calculation: 'Calcolo da utilizzo',
}

export const CAR_PAYMENT_MODE_LABELS: Record<CarPaymentMode, string> = {
  IMMEDIATE: 'Pagamento immediato',
  FINANCING: 'Finanziamento',
}

export const MONTH_LABELS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]
