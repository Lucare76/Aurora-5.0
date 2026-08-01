export type FinanceScope = 'PERSONAL' | 'DEPENDENT_AURORA' | 'ADI'
export type LegacyAssetPurpose = 'DEPENDENT'
export type AssetPurpose = FinanceScope | LegacyAssetPurpose
export type AdiEntryType = 'credit' | 'debit'
export type AdiCategory = 'SUPERMERCATO' | 'BENZINA' | 'ABBIGLIAMENTO_AURORA'
export type AuroraTransferDirection = 'PERSONAL_TO_AURORA' | 'AURORA_TO_PERSONAL' | 'AURORA_TO_AURORA' | 'PERSONAL_TO_PERSONAL'

export type DependentBeneficiary = {
  id: string
  user_id: string
  name: string
  relationship: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type AccountPurposeLink = {
  id: string
  user_id: string
  account_id: string
  beneficiary_id: string | null
  purpose: AssetPurpose
  label: string | null
  created_at: string
  updated_at: string
}

export type AdiEntry = {
  id: string
  user_id: string
  transaction_id: string | null
  entry_type: AdiEntryType
  adi_category: AdiCategory | null
  amount: number
  date: string
  reference_period: string | null
  description: string
  note: string | null
  funding_source: 'ADI'
  created_at: string
  updated_at: string
}

export type MinimalAccount = {
  id: string
  name: string
  balance: number
  currency: string
  is_active?: boolean
  type?: string
  color?: string | null
}

export type MinimalTransaction = {
  id: string
  account_id?: string
  type: string
  amount: number | string
  date: string
  description: string | null
  transfer_peer_id?: string | null
  category_id?: string | null
  destination_account_id?: string | null
  created_at?: string
}
