import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountReconciliation, ReconciliationSourceType } from '@/types/database'
import { latestReconciliationByAccount } from '@/domain/accounting/reconciliation'

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

export type ReconciliationPatrimonioSync = 'updated' | 'unchanged' | 'skipped'

export type CreateReconciliationResult = {
  reconciliation: AccountReconciliation
  patrimonioSync: ReconciliationPatrimonioSync
  observedAt: string | null
}

/**
 * Creates the reconciliation through a single database RPC.
 *
 * The RPC atomically:
 * - snapshots accounts.balance without changing it;
 * - inserts account_reconciliations;
 * - if exactly one external asset is linked 1:1, updates its real value;
 * - inserts the immutable external asset snapshot.
 *
 * Zero or multiple linked assets are intentionally skipped so a provider with
 * several holdings (for example Scalable) never receives the whole account
 * value on every holding.
 */
export async function createReconciliation(
  supabase: ReconciliationSupabase,
  _userId: string,
  input: CreateReconciliationInput,
): Promise<CreateReconciliationResult> {
  const { data, error } = await supabase.rpc('create_reconciliation_atomic', {
    p_account_id: input.accountId,
    p_statement_date: input.statementDate,
    p_bank_balance: input.bankBalance,
    p_source_type: input.sourceType ?? 'manual',
    p_source_reference: input.sourceReference ?? null,
  })

  if (error || !data) {
    const message = error?.message?.toLowerCase() ?? ''
    if (message.includes('account not found') || message.includes('not owned')) {
      throw new ReconciliationError('ACCOUNT_NOT_FOUND', 'Conto non trovato o non di proprietà dell’utente.')
    }
    throw new ReconciliationError('CREATE_FAILED', 'Impossibile salvare la riconciliazione.')
  }

  const payload = data as {
    reconciliation?: AccountReconciliation
    patrimonio_sync?: ReconciliationPatrimonioSync
    observed_at?: string | null
  }

  if (!payload.reconciliation) {
    throw new ReconciliationError('CREATE_FAILED', 'Risposta non valida durante la riconciliazione.')
  }

  return {
    reconciliation: payload.reconciliation,
    patrimonioSync: payload.patrimonio_sync ?? 'skipped',
    observedAt: payload.observed_at ?? null,
  }
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
