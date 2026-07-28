export const TRAVEL_AFFORDABILITY_ENGINE_VERSION = '1.1.0-travel'
export const MAX_TRAVEL_NAME_LENGTH = 150
export const MAX_TRAVEL_COST = 1_000_000
export const MAX_TRAVELERS = 100
export const MAX_TRAVEL_DAYS = 365
export const DEFAULT_TRAVEL_HORIZON_MONTHS = 24

export const TRANSPORT_MODE_LABELS = {
  car: 'Auto',
  plane: 'Aereo',
  train: 'Treno',
  ship: 'Nave',
  bus: 'Bus',
} as const

export const LODGING_TYPE_LABELS = {
  hotel: 'Hotel',
  apartment: 'Appartamento',
  resort: 'Villaggio',
  bb: 'B&B',
  camping: 'Campeggio',
  other: 'Altro',
} as const

export const MEAL_MODE_LABELS = {
  daily_budget: 'Budget giornaliero',
  total: 'Costo totale',
} as const
