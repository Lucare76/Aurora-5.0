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
 * Snapshots the current accounts.balance and compares it to the bank statement
 * balance the user typed in. This never writes to accounts.balance — the
 * reconciliation is a record of the comparison, not a correction (FASE 2/D:
 * "NON correggere automaticamente il saldo").
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
