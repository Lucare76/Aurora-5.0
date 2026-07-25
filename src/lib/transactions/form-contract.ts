import type { TransactionType } from '@/types/database'

type TransactionFormValues = {
  type: TransactionType
  amount: number | string
  description: string
  date: string
  account_id: string
  destination_account_id?: string | null
  category_id?: string | null
  notes?: string | null
}

type TransactionPayload = {
  account_id: string
  type: TransactionType
  amount: number
  description: string
  notes: string | null
  date: string
  category_id?: string | null
  destination_account_id?: string | null
}

export function parseTransactionAmount(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return Number.NaN
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return Number.NaN
  return Number(normalized)
}

export function buildTransactionPayload(values: TransactionFormValues): TransactionPayload {
  const payload: TransactionPayload = {
    account_id: values.account_id,
    type: values.type,
    amount: parseTransactionAmount(values.amount),
    description: values.description,
    notes: values.notes || null,
    date: values.date,
  }

  if (values.type === 'transfer') {
    payload.destination_account_id = values.destination_account_id ?? ''
    return payload
  }

  payload.category_id = values.category_id || null
  return payload
}
