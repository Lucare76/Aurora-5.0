import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/00039_bank_reconciliation_and_neutral_transactions.sql', 'utf8')

describe('bank reconciliation migration', () => {
  it('aggiunge is_neutral alle transazioni con default false', () => {
    expect(sql).toContain('alter table public.transactions add column if not exists is_neutral boolean not null default false')
  })

  it('5. un giroconto non può mai essere marcato neutro (vincolo DB)', () => {
    expect(sql).toContain("check (type <> 'transfer' or is_neutral = false)")
  })

  it('crea la tabella account_reconciliations con gli stati richiesti', () => {
    expect(sql).toContain('create table if not exists public.account_reconciliations')
    expect(sql).toContain("check (status in ('reconciled', 'mismatch', 'pending', 'superseded'))")
  })

  it('calcola la differenza come colonna generata (mai una seconda fonte di verità scritta a mano)', () => {
    expect(sql).toContain('difference numeric(15, 2) generated always as (round(bank_balance - app_balance_snapshot, 2)) stored')
  })

  it('abilita RLS e policy ownership sulla tabella riconciliazioni', () => {
    expect(sql).toContain('alter table public.account_reconciliations enable row level security')
    expect(sql).toContain('(select auth.uid()) = user_id')
  })

  it('la sezione riconciliazioni non tocca mai accounts.balance (nessuna correzione automatica del saldo)', () => {
    const reconciliationSection = sql.slice(sql.indexOf('create table if not exists public.account_reconciliations'), sql.indexOf('3. create_transaction_atomic'))
    expect(reconciliationSection).not.toMatch(/update\s+public\.accounts\s+set\s+balance/i)
  })

  it('propaga is_neutral nelle RPC atomiche senza toccarne la matematica del saldo', () => {
    expect(sql).toContain('p_is_neutral')
    expect(sql).toContain("case when p_type = 'transfer' then false else coalesce(p_is_neutral, false) end")
  })
})
