import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountReconciliation, ReconciliationSourceType } from '@/types/database'
import { calculateReconciliationDifference, deriveReconciliationStatus, latestReconciliationByAccount } from '@/domain/accounting/reconciliation'

type ReconciliationSupabase = SupabaseClient

export class ReconciliationError extends Error {
  constructor(
    public readonly code: 'ACCOUNT_NOT_FOUND' | 'FETCH_FAILED' | 'CREATE_FAILED',
    message: string,
  ) {
    super(message)
    this.name = 'ReconciliationError'
  }
}

export type CreateReconciliationInput = {
  accountId: string
  statementDate: string
  bankBalance: number
  sourceType?: ReconciliationSourceType
  sourceReference?: string | null
}

/**
 * A Poste asset is intentionally linked 1:1 to the Aurora account that stores
 * its accounting principal. When the user reconciles that account with the
 * real Poste value, mirror the real value into Patrimonio while leaving
 * accounts.balance untouched.
 *
 * We deliberately restrict this to a single POSTE asset. Investment providers
 * such as Scalable may have multiple holdings linked to the same account, so a
 * blanket linked_account_id update would incorrectly assign the full account
 * value to every holding.
 */
async function syncLinkedPosteAssetFromReconciliation(
  supabase: ReconciliationSupabase,
  userId: string,
  input: CreateReconciliationInput,
  linkedAccountBalance: number,
) {
  const { data: asset, error: assetError } = await supabase
    .from('external_assets')
    .select('id,current_value')
    .eq('user_id', userId)
    .eq('linked_account_id', input.accountId)
    .eq('source_type', 'POSTE')
    .maybeSingle()

  if (assetError || !asset) return

  const currentValue = Number(asset.current_value ?? 0)
  if (calculateReconciliationDifference(input.bankBalance, currentValue) === 0) return

  const observedAt = `${input.statementDate}T12:00:00.000Z`
  const { error: updateError } = await supabase
    .from('external_assets')
    .update({
      current_value: input.bankBalance,
      observed_at: observedAt,
    })
    .eq('id', asset.id)
    .eq('user_id', userId)

  if (updateError) return

  await supabase.from('external_asset_snapshots').insert({
    user_id: userId,
    asset_id: asset.id,
    current_value: input.bankBalance,
    linked_account_balance: linkedAccountBalance,
    observed_at: observedAt,
  })
}

/**
 * Snapshots the current accounts.balance and compares it to the bank statement
 * balance the user typed in. This never writes to accounts.balance — the
 * reconciliation is a record of the comparison, not a correction (FASE 2/D:
 * "NON correggere automaticamente il saldo").
 *
 * For a 1:1 Poste asset linked to this account, the real reconciled value is
 * also mirrored to external_assets.current_value and its immutable snapshot
 * history. That makes Patrimonio reflect accrued interest/value changes
 * without creating income, transactions, or spendable liquidity.
 */
export async function createReconciliation(
  supabase: ReconciliationSupabase,
  userId: string,
  input: CreateReconciliationInput,
): Promise<AccountReconciliation> {
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id,balance')
    .eq('id', input.accountId)
    .eq('user_id', userId)
    .maybeSingle()

  if (accountError || !account) {
    throw new ReconciliationError('ACCOUNT_NOT_FOUND', 'Conto non trovato o non di proprietà dell’utente.')
  }

  const appBalanceSnapshot = Number((account as { balance: number }).balance)
  const difference = calculateReconciliationDifference(input.bankBalance, appBalanceSnapshot)
  const status = deriveReconciliationStatus(difference)

  const { data, error } = await supabase
    .from('account_reconciliations')
    .insert({
      user_id: userId,
      account_id: input.accountId,
      statement_date: input.statementDate,
      bank_balance: input.bankBalance,
      app_balance_snapshot: appBalanceSnapshot,
      status,
      source_type: input.sourceType ?? 'manual',
      source_reference: input.sourceReference ?? null,
      reconciled_at: status === 'reconciled' ? new Date().toISOString() : null,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new ReconciliationError('CREATE_FAILED', 'Impossibile salvare la riconciliazione.')
  }

  await syncLinkedPosteAssetFromReconciliation(supabase, userId, input, appBalanceSnapshot)

  return data as AccountReconciliation
}

export async function listReconciliationHistory(
  supabase: ReconciliationSupabase,
  userId: string,
  accountId: string,
  limit = 50,
): Promise<AccountReconciliation[]> {
  const { data, error } = await supabase
    .from('account_reconciliations')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .order('statement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new ReconciliationError('FETCH_FAILED', 'Impossibile caricare lo storico riconciliazioni.')
  return (data ?? []) as AccountReconciliation[]
}

/**
 * The "current" reconciliation for a conto is the one with the latest
 * statement_date, tied only by created_at — never insertion order alone
 * (see compareReconciliationRecency). Ordering the query this way, rather
 * than by created_at, is what makes a retroactively-inserted older statement
 * correctly rank below an already-on-file newer one.
 */
export async function getLatestReconciliation(
  supabase: ReconciliationSupabase,
  userId: string,
  accountId: string,
): Promise<AccountReconciliation | null> {
  const { data, error } = await supabase
    .from('account_reconciliations')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .order('statement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return (data as AccountReconciliation | null) ?? null
}

export async function listLatestReconciliationsByAccount(
  supabase: ReconciliationSupabase,
  userId: string,
): Promise<Map<string, AccountReconciliation>> {
  const { data, error } = await supabase
    .from('account_reconciliations')
    .select('*')
    .eq('user_id', userId)
    .order('statement_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return new Map()
  return latestReconciliationByAccount((data ?? []) as AccountReconciliation[])
}
