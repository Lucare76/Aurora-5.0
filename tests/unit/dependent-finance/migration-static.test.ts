import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/00030_dependent_finance_and_adi.sql', 'utf8')

describe('dependent finance migration', () => {
  it('crea il modello minimo per beneficiari, collegamenti conto e ADI', () => {
    expect(sql).toContain('create table if not exists public.dependent_beneficiaries')
    expect(sql).toContain('create table if not exists public.account_purpose_links')
    expect(sql).toContain('create table if not exists public.finance_transfer_metadata')
    expect(sql).toContain('create table if not exists public.adi_entries')
  })

  it('abilita RLS e policy ownership su tutte le nuove tabelle', () => {
    for (const table of ['dependent_beneficiaries', 'account_purpose_links', 'finance_transfer_metadata', 'adi_entries']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain('(select auth.uid()) = user_id')
    }
  })

  it('supporta i tre perimetri contabili espliciti', () => {
    expect(sql).toContain("'PERSONAL', 'DEPENDENT_AURORA', 'ADI'")
    expect(sql).toContain("purpose text not null default 'DEPENDENT_AURORA'")
    expect(sql).toContain("purpose in ('PERSONAL', 'DEPENDENT_AURORA', 'ADI', 'DEPENDENT')")
  })

  it('limita ADI alle categorie ammesse e importi positivi', () => {
    expect(sql).toContain("adi_category in ('SUPERMERCATO', 'BENZINA', 'ABBIGLIAMENTO_AURORA')")
    expect(sql).toContain('adi_entries_amount_positive check (amount > 0)')
    expect(sql).toContain("funding_source = 'ADI'")
  })

  it('resta non distruttiva', () => {
    expect(sql.toLowerCase()).not.toContain('drop table')
    expect(sql.toLowerCase()).not.toContain('truncate')
    expect(sql.toLowerCase()).not.toContain('delete from')
  })
})
