import type { AdiCategory, FinanceScope } from './types'

export const AURORA_BENEFICIARY_NAME = 'Aurora'
export const AURORA_ACCOUNT_SUGGESTION = 'Aurora piano di accumulo'

export const FINANCE_SCOPE_LABELS: Record<FinanceScope, string> = {
  PERSONAL: 'Personale',
  DEPENDENT_AURORA: 'Aurora',
  ADI: 'ADI',
}

export const AURORA_SCOPE = 'DEPENDENT_AURORA' as const
export const LEGACY_AURORA_PURPOSE = 'DEPENDENT' as const

export const ADI_CATEGORY_LABELS: Record<AdiCategory, string> = {
  SUPERMERCATO: 'Supermercato',
  BENZINA: 'Benzina',
  ABBIGLIAMENTO_AURORA: 'Abbigliamento Aurora',
}

export const ADI_CATEGORIES = Object.keys(ADI_CATEGORY_LABELS) as AdiCategory[]

export const AURORA_USAGE_REASONS = [
  'Salute',
  'Terapia',
  'Istruzione',
  'Ausilio',
  'Investimento',
  'Trasferimento tra conti dedicati',
  'Altra necessità di Aurora',
] as const
