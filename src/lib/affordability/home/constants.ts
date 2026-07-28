export const HOME_AFFORDABILITY_ENGINE_VERSION = '1.1.0-home'

export const MAX_HOME_NAME_LENGTH = 150
export const MAX_HOME_PRICE = 50_000_000
export const MAX_MORTGAGE_YEARS = 50
export const MAX_MORTGAGE_MONTHS = MAX_MORTGAGE_YEARS * 12
export const MAX_OWNERSHIP_YEARS = 60
export const MAX_SURFACE_SQM = 20_000
export const DEFAULT_HOME_HORIZON_MONTHS = 360
export const DEFAULT_HOME_OWNERSHIP_YEARS = 20

export const HOME_CONDITION_LABELS = {
  new_build: 'Nuova costruzione',
  used: 'Usato',
} as const

export const HOME_PURPOSE_LABELS = {
  primary_home: 'Prima casa',
  other_home: 'Altra abitazione',
} as const

export const HOME_PAYMENT_MODE_LABELS = {
  IMMEDIATE: 'Pagamento immediato',
  MORTGAGE: 'Mutuo',
} as const

export const MORTGAGE_RATE_TYPE_LABELS = {
  fixed: 'Tasso fisso',
  variable: 'Tasso variabile',
} as const

export const CURRENT_HOUSING_LABELS = {
  rent: 'Affitto',
  mortgage: 'Mutuo attuale',
  owned_no_mortgage: 'Casa di proprietà senza mutuo',
  other: 'Altra sistemazione',
} as const

export const HOME_MISSING_COST_LABELS = {
  notary: 'notaio',
  taxes: 'imposte iniziali',
  agency: 'agenzia immobiliare',
  renovation: 'ristrutturazione',
  furnishing: 'arredamento',
  condominium: 'condominio',
  utilities: 'utenze',
  insurance: 'assicurazione casa',
  recurringTaxes: 'imposte ricorrenti',
  maintenance: 'manutenzione',
  residualValue: 'valore residuo stimato',
  residualDebt: 'debito residuo stimato',
} as const
