import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canAccessPrivateFinance } from '@/lib/access/private-finance-access'
import { createClient } from '@/lib/supabase/server'
import { AURORA_ACCOUNT_SUGGESTION, AURORA_BENEFICIARY_NAME, AURORA_SCOPE } from '@/lib/dependent-finance/constants'
import {
  buildAuroraScopeSummary,
  classifyTransferDirection,
  filterAccountsByScope,
  getAccountScopeMap,
} from '@/lib/dependent-finance/calculations'
import type { AccountPurposeLink, FinanceScope } from '@/lib/dependent-finance/types'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Data non valida')
const money = z.number().finite().positive()

const accountType = z.enum(['checking', 'savings', 'cash', 'credit', 'investment', 'other'])

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('linkAccount'), accountId: uuid }).strict(),
  z.object({
    action: z.literal('createAccount'),
    name: z.string().trim().min(1).max(120),
    type: accountType,
    balance: z.number().finite().default(0),
    currency: z.string().trim().min(3).max(3).default('EUR'),
    color: z.string().trim().max(40).nullable().optional(),
    icon: z.string().trim().max(40).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }).strict(),
  z.object({
    action: z.literal('updateAccount'),
    accountId: uuid,
    name: z.string().trim().min(1).max(120).optional(),
    type: accountType.optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    color: z.string().trim().max(40).nullable().optional(),
    icon: z.string().trim().max(40).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  }).strict(),
  z.object({
    action: z.literal('createTransaction'),
    type: z.enum(['income', 'expense']),
    accountId: uuid,
    amount: money,
    date: isoDate,
    description: z.string().trim().min(1).max(500),
    categoryId: uuid.nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  }).strict(),
  z.object({
    action: z.literal('updateTransaction'),
    transactionId: uuid,
    type: z.enum(['income', 'expense']),
    accountId: uuid,
    amount: money,
    date: isoDate,
    description: z.string().trim().min(1).max(500),
    categoryId: uuid.nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  }).strict(),
  z.object({
    action: z.literal('deleteTransaction'),
    transactionId: uuid,
  }).strict(),
  z.object({
    action: z.literal('createTransfer'),
    sourceAccountId: uuid,
    destinationAccountId: uuid,
    amount: money,
    date: isoDate,
    description: z.string().trim().min(1).max(500),
    reason: z.string().trim().max(500).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    idempotencyKey: z.string().trim().max(120).nullable().optional(),
  }).strict().refine((data) => data.sourceAccountId !== data.destinationAccountId, {
    message: 'I conti del giroconto devono essere diversi.',
    path: ['destinationAccountId'],
  }),
])

type Supabase = Awaited<ReturnType<typeof createClient>>

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function forbidden() {
  return json({ error: { code: 'FORBIDDEN', message: 'Accesso non autorizzato.' } }, 403)
}

async function requireAuroraAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, response: json({ error: 'Non autenticato' }, 401) }
  if (!canAccessPrivateFinance(user.email)) return { supabase, user, response: forbidden() }

  return { supabase, user, response: null }
}

function isMissingSchemaError(error: unknown): boolean {
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''
  return code === '42P01' || code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(message)
}

async function getAuroraBeneficiary(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from('dependent_beneficiaries')
    .upsert({ user_id: userId, name: AURORA_BENEFICIARY_NAME, relationship: 'figlia' }, { onConflict: 'user_id,name' })
    .select()
    .single()
  if (isMissingSchemaError(error)) throw new Error('SCHEMA_NOT_READY')
  if (error || !data) throw new Error('BENEFICIARY_FAILED')
  return data
}

async function readScopeLinks(supabase: Supabase, userId: string): Promise<AccountPurposeLink[]> {
  const { data, error } = await supabase
    .from('account_purpose_links')
    .select('*')
    .eq('user_id', userId)
  if (error) return []
  return (data ?? []) as AccountPurposeLink[]
}

async function linkAuroraAccount(supabase: Supabase, userId: string, accountId: string) {
  const beneficiary = await getAuroraBeneficiary(supabase, userId)
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id,user_id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle()

  if (accountError) throw new Error('ACCOUNT_VERIFY_FAILED')
  if (!account) throw new Error('ACCOUNT_NOT_FOUND')

  const { error } = await supabase
    .from('account_purpose_links')
    .upsert({
      user_id: userId,
      account_id: accountId,
      beneficiary_id: beneficiary.id,
      purpose: AURORA_SCOPE,
      label: 'Risparmi di Aurora',
    } as any, { onConflict: 'user_id,account_id' })

  if (error) throw new Error('LINK_FAILED')
  return { accountId, beneficiaryId: beneficiary.id }
}

async function assertAuroraAccount(supabase: Supabase, userId: string, accountId: string) {
  const [accountRes, links] = await Promise.all([
    supabase.from('accounts').select('id,user_id,is_active,currency').eq('id', accountId).eq('user_id', userId).maybeSingle(),
    readScopeLinks(supabase, userId),
  ])
  if (accountRes.error) throw new Error('ACCOUNT_VERIFY_FAILED')
  if (!accountRes.data) throw new Error('ACCOUNT_NOT_FOUND')
  const scope = getAccountScopeMap(links).get(accountId) ?? 'PERSONAL'
  if (scope !== 'DEPENDENT_AURORA') throw new Error('AURORA_SCOPE_REQUIRED')
  return accountRes.data
}

async function assertAuroraTransaction(supabase: Supabase, userId: string, transactionId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id,user_id,account_id,transfer_peer_id,type')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error('TRANSACTION_VERIFY_FAILED')
  if (!data) throw new Error('TRANSACTION_NOT_FOUND')

  const links = await readScopeLinks(supabase, userId)
  const scopes = getAccountScopeMap(links)
  const accountScope = scopes.get(data.account_id) ?? 'PERSONAL'
  const peerScope = data.transfer_peer_id ? scopes.get(data.transfer_peer_id) ?? 'PERSONAL' : 'PERSONAL'
  if (accountScope !== 'DEPENDENT_AURORA' && peerScope !== 'DEPENDENT_AURORA') {
    throw new Error('AURORA_SCOPE_REQUIRED')
  }

  return data
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'UNKNOWN'
  const map: Record<string, [string, number]> = {
    BENEFICIARY_FAILED: ['Beneficiario Aurora non configurabile.', 500],
    SCHEMA_NOT_READY: ['Schema Aurora/ADI non ancora attivo su questo ambiente. Applica la migration 00030 prima di usare questa funzione.', 503],
    ACCOUNT_VERIFY_FAILED: ['Conto non verificabile.', 500],
    ACCOUNT_NOT_FOUND: ['Conto non trovato o non autorizzato.', 404],
    TRANSACTION_VERIFY_FAILED: ['Movimento non verificabile.', 500],
    TRANSACTION_NOT_FOUND: ['Movimento non trovato o non autorizzato.', 404],
    LINK_FAILED: ['Collegamento del conto non riuscito.', 500],
    AURORA_SCOPE_REQUIRED: ['Seleziona un conto del perimetro Aurora.', 400],
    PERSONAL_DESTINATION_REASON_REQUIRED: ['Indica il motivo del trasferimento dal patrimonio di Aurora al personale.', 400],
    RPC_FAILED: ['Operazione contabile Aurora non riuscita.', 500],
  }
  const [safeMessage, status] = map[message] ?? ['Operazione Aurora non riuscita.', 500]
  return json({ error: safeMessage }, status)
}

export async function GET() {
  const { supabase, user, response } = await requireAuroraAccess()
  if (response) return response

  const [accountsRes, beneficiariesRes, links] = await Promise.all([
    supabase.from('accounts').select('id,name,balance,currency,is_active,type,color,icon').eq('user_id', user.id).order('sort_order', { ascending: true }),
    supabase.from('dependent_beneficiaries').select('*').eq('user_id', user.id).eq('name', AURORA_BENEFICIARY_NAME).maybeSingle(),
    readScopeLinks(supabase, user.id),
  ])

  if (accountsRes.error) {
    console.error('[aurora] accounts query failed', accountsRes.error)
    return json({
      error: 'Configurazione Aurora non disponibile.',
      ...(process.env.NODE_ENV !== 'production' ? { details: { table: 'accounts', message: accountsRes.error.message, code: (accountsRes.error as { code?: string }).code } } : {}),
    }, 500)
  }

  const accounts = accountsRes.data ?? []
  const schemaReady = !isMissingSchemaError(beneficiariesRes.error)
  if (beneficiariesRes.error && schemaReady) {
    console.error('[aurora] dependent beneficiaries query failed', beneficiariesRes.error)
    return json({
      error: 'Configurazione Aurora non disponibile.',
      ...(process.env.NODE_ENV !== 'production' ? { details: { table: 'dependent_beneficiaries', message: beneficiariesRes.error.message, code: (beneficiariesRes.error as { code?: string }).code } } : {}),
    }, 500)
  }

  const suggestedAccount = accounts.find((account) => account.name.toLowerCase() === AURORA_ACCOUNT_SUGGESTION.toLowerCase()) ?? null
  let beneficiary = schemaReady ? beneficiariesRes.data ?? null : null
  let effectiveLinks = links
  let auroraAccounts = filterAccountsByScope(accounts, effectiveLinks, 'DEPENDENT_AURORA')

  if (schemaReady && auroraAccounts.length === 0 && suggestedAccount) {
    try {
      await linkAuroraAccount(supabase, user.id, suggestedAccount.id)
      effectiveLinks = await readScopeLinks(supabase, user.id)
      auroraAccounts = filterAccountsByScope(accounts, effectiveLinks, 'DEPENDENT_AURORA')
      beneficiary = (await supabase.from('dependent_beneficiaries').select('*').eq('user_id', user.id).eq('name', AURORA_BENEFICIARY_NAME).maybeSingle()).data ?? beneficiary
    } catch (autoLinkError) {
      console.warn('[aurora] suggested account auto-link skipped', { name: autoLinkError instanceof Error ? autoLinkError.message : 'unknown' })
    }
  }

  const linkedAccount = auroraAccounts[0] ?? null
  const auroraIds = auroraAccounts.map((account) => account.id)

  const transactionsRes = auroraIds.length > 0
    ? await supabase
      .from('transactions')
      .select('id,account_id,type,amount,date,description,notes,category_id,transfer_peer_id,created_at')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1000)
    : { data: [], error: null }

  if (transactionsRes.error) return json({ error: 'Movimenti Aurora non disponibili.' }, 500)

  const transactions = (transactionsRes.data ?? []).map((tx) => ({
    ...tx,
    destination_account_id: tx.type === 'transfer' ? tx.transfer_peer_id : null,
  }))

  const auroraPatrimony = buildAuroraScopeSummary({ accounts: auroraAccounts, transactions, links: effectiveLinks })

  return json({
    data: {
      beneficiary,
      linkedAccount,
      suggestedAccount,
      accounts,
      auroraAccounts,
      links: effectiveLinks,
      transactions,
      summary: auroraPatrimony,
      schemaReady,
      schemaMessage: schemaReady ? null : 'Lo schema Aurora/ADI non è ancora attivo su questo ambiente. Applica la migration 00030 prima di impostare conti fonte o registrare movimenti dedicati.',
    },
  })
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireAuroraAccess()
  if (response) return response

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return json({
      error: 'Dati Aurora non validi.',
      field: parsed.error.issues[0]?.path.join('.') ?? 'payload',
      details: process.env.NODE_ENV === 'production' ? undefined : parsed.error.flatten(),
    }, 400)
  }

  try {
    const body = parsed.data
    if (body.action === 'linkAccount') {
      return json({ data: await linkAuroraAccount(supabase, user.id, body.accountId) }, 201)
    }

    if (body.action === 'createAccount') {
      const { data: account, error } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: body.name,
          type: body.type,
          balance: body.balance,
          currency: body.currency,
          is_active: true,
          sort_order: 0,
          color: body.color ?? null,
          icon: body.icon ?? null,
        } as any)
        .select()
        .single()
      if (error || !account) return json({ error: 'Creazione conto Aurora non riuscita.' }, 500)
      await linkAuroraAccount(supabase, user.id, account.id)
      return json({ data: account }, 201)
    }

    if (body.action === 'updateAccount') {
      await assertAuroraAccount(supabase, user.id, body.accountId)
      const payload: Record<string, unknown> = {}
      if (body.name !== undefined) payload.name = body.name
      if (body.type !== undefined) payload.type = body.type
      if (body.currency !== undefined) payload.currency = body.currency
      if (body.color !== undefined) payload.color = body.color
      if (body.icon !== undefined) payload.icon = body.icon
      if (body.isActive !== undefined) payload.is_active = body.isActive
      const { data, error } = await supabase.from('accounts').update(payload).eq('id', body.accountId).eq('user_id', user.id).select().single()
      if (error) return json({ error: 'Modifica conto Aurora non riuscita.' }, 500)
      return json({ data })
    }

    if (body.action === 'createTransaction') {
      await assertAuroraAccount(supabase, user.id, body.accountId)
      const { data, error } = await supabase.rpc('create_transaction_atomic', {
        p_account_id: body.accountId,
        p_type: body.type,
        p_amount: body.amount,
        p_date: body.date,
        p_description: body.description,
        p_category_id: body.categoryId ?? null,
        p_notes: body.notes ?? null,
        p_destination_account_id: null,
        p_recurring_id: null,
      })
      if (error) throw new Error('RPC_FAILED')
      return json({ data }, 201)
    }

    if (body.action === 'updateTransaction') {
      await assertAuroraAccount(supabase, user.id, body.accountId)
      const original = await assertAuroraTransaction(supabase, user.id, body.transactionId)
      if (original.type === 'transfer') return json({ error: 'Modifica i giroconti Aurora dalla sezione trasferimenti.' }, 400)

      const { data, error } = await supabase.rpc('update_transaction_atomic', {
        p_transaction_id: body.transactionId,
        p_account_id: body.accountId,
        p_type: body.type,
        p_amount: body.amount,
        p_date: body.date,
        p_description: body.description,
        p_category_id: body.categoryId ?? null,
        p_notes: body.notes ?? null,
        p_destination_account_id: null,
        p_clear_category: body.categoryId === null,
      })
      if (error) throw new Error('RPC_FAILED')
      return json({ data })
    }

    if (body.action === 'deleteTransaction') {
      await assertAuroraTransaction(supabase, user.id, body.transactionId)
      const { error } = await supabase.rpc('delete_transaction_atomic', {
        p_transaction_id: body.transactionId,
      })
      if (error) throw new Error('RPC_FAILED')
      return json({ success: true })
    }

    const links = await readScopeLinks(supabase, user.id)
    const [source, destination] = await Promise.all([
      supabase.from('accounts').select('id,user_id,is_active,currency').eq('id', body.sourceAccountId).eq('user_id', user.id).maybeSingle(),
      supabase.from('accounts').select('id,user_id,is_active,currency').eq('id', body.destinationAccountId).eq('user_id', user.id).maybeSingle(),
    ])
    if (source.error || destination.error) return json({ error: 'Conti non verificabili.' }, 500)
    if (!source.data || !destination.data) return json({ error: 'Conto di origine o destinazione non autorizzato.' }, 404)
    const direction = classifyTransferDirection(body.sourceAccountId, body.destinationAccountId, links)
    if (direction === 'AURORA_TO_PERSONAL' && !body.reason) throw new Error('PERSONAL_DESTINATION_REASON_REQUIRED')
    if (direction === 'PERSONAL_TO_PERSONAL') return json({ error: 'Usa i movimenti personali per un giroconto personale.' }, 400)
    if (direction === 'AURORA_TO_AURORA' || direction === 'AURORA_TO_PERSONAL') await assertAuroraAccount(supabase, user.id, body.sourceAccountId)
    if (direction === 'AURORA_TO_AURORA' || direction === 'PERSONAL_TO_AURORA') await assertAuroraAccount(supabase, user.id, body.destinationAccountId)

    const { data, error } = await supabase.rpc('create_transaction_atomic', {
      p_account_id: body.sourceAccountId,
      p_type: 'transfer',
      p_amount: body.amount,
      p_date: body.date,
      p_description: body.description,
      p_category_id: null,
      p_notes: body.notes ?? body.reason ?? null,
      p_destination_account_id: body.destinationAccountId,
      p_recurring_id: null,
    })
    if (error) throw new Error('RPC_FAILED')

    const created = Array.isArray(data) ? data[0] : data
    if (created?.id) {
      await supabase.from('finance_transfer_metadata').insert({
        user_id: user.id,
        source_transaction_id: created.id,
        destination_transaction_id: created.id,
        source_scope: (getAccountScopeMap(links).get(body.sourceAccountId) ?? 'PERSONAL') as FinanceScope,
        destination_scope: (getAccountScopeMap(links).get(body.destinationAccountId) ?? 'PERSONAL') as FinanceScope,
        reason: body.reason ?? null,
        note: body.notes ?? null,
        idempotency_key: body.idempotencyKey ?? null,
      } as any)
    }

    return json({ data, direction }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
