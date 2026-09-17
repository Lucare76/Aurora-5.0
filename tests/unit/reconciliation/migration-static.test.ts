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

  it('4. la policy UPDATE verifica ownership di account_id (non solo user_id), come la INSERT', () => {
    const updatePolicy = sql.slice(
      sql.indexOf('create policy "Users can update own account reconciliations"'),
      sql.indexOf('create policy "Users can delete own account reconciliations"'),
    )
    expect(updatePolicy).toContain('with check')
    expect(updatePolicy).toContain('(select auth.uid()) = user_id')
    expect(updatePolicy).toContain('exists (')
    expect(updatePolicy).toContain('select 1 from public.accounts a')
    expect(updatePolicy).toContain('where a.id = account_id and a.user_id = (select auth.uid())')
  })

  it('la differenza cent-based non ammette tolleranza oltre l\'arrotondamento (nessun "<= 0.01" residuo nei commenti)', () => {
    expect(sql).not.toMatch(/<=\s*0[.,]01/)
    expect(sql).toContain('differenza = 0.00 => reconciled')
  })

  it('2. il trigger di supersede confronta (statement_date, created_at) e non il solo ordine di inserimento', () => {
    const triggerFn = sql.slice(
      sql.indexOf('function public.supersede_previous_reconciliations()'),
      sql.indexOf('drop trigger if exists supersede_previous_reconciliations'),
    )
    expect(triggerFn).toContain('(existing.statement_date, existing.created_at) > (new.statement_date, new.created_at)')
    expect(triggerFn).toContain('(statement_date, created_at) < (new.statement_date, new.created_at)')
    // Un inserimento retroattivo deve superare se stesso, non le righe più recenti già a sistema.
    expect(triggerFn).toContain("where id = new.id")
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
