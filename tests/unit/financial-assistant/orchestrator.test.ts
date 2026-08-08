import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runFinancialAssistantQuery } from '@/lib/financial-assistant/orchestrator'
import { resetAssistantRateLimit } from '@/lib/financial-assistant/rate-limit'

const USER = { id: 'user-1', email: 'luca_renna@hotmail.com' } as never
const originalFlag = process.env.FINANCIAL_ASSISTANT_ENABLED
const originalPrivateEmail = process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL

function queryBuilder(data: unknown[] | null = [], onSelect?: (columns: string) => void) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn((columns: string) => {
    onSelect?.(columns)
    return builder
  })
  for (const method of ['eq', 'gte', 'lte', 'order', 'limit'] as const) {
    builder[method] = vi.fn(() => builder)
  }
  ;(builder as { then: (resolve: (value: { data: unknown[] | null; error: null }) => unknown) => unknown }).then = (resolve) => resolve({ data, error: null })
  return builder
}

function supabase(fixtures: Record<string, unknown[] | null> = {}, onSelect?: (table: string, columns: string) => void) {
  return {
    from: vi.fn((table: string) => queryBuilder(fixtures[table] ?? [], (columns) => onSelect?.(table, columns))),
  }
}

const fixtures = {
  accounts: [{ id: 'acc-1', name: 'Bancoposta', type: 'checking', balance: 1000, currency: 'EUR', is_active: true }],
  account_purpose_links: [],
  categories: [{ id: 'cat-1', name: 'Stipendio', type: 'income', parent_id: null, color: null, icon: null }],
  budgets: [{ id: 'budget-1', category_id: 'cat-1', amount: 500, month: 8, year: 2026 }],
  savings_goals: [{ id: 'goal-1', name: 'Fondo', target_amount: 1000, current_amount: 250, status: 'ACTIVE', target_date: null }],
  recurring_rules: [],
  loans: [],
  transactions: [
    { id: 'tx-1', account_id: 'acc-1', transfer_peer_id: null, category_id: 'cat-1', amount: 200, type: 'income', description: 'STIPENDIO', date: '2026-08-02' },
    { id: 'tx-2', account_id: 'acc-1', transfer_peer_id: null, category_id: null, amount: 50, type: 'expense', description: 'SPESA', date: '2026-08-03' },
  ],
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  resetAssistantRateLimit()
  process.env.FINANCIAL_ASSISTANT_ENABLED = 'true'
  process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = 'luca_renna@hotmail.com'
})

afterEach(() => {
  vi.restoreAllMocks()
  if (originalFlag === undefined) delete process.env.FINANCIAL_ASSISTANT_ENABLED
  else process.env.FINANCIAL_ASSISTANT_ENABLED = originalFlag
  if (originalPrivateEmail === undefined) delete process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL
  else process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL = originalPrivateEmail
})

describe('financial assistant orchestrator', () => {
  it('restituisce un riepilogo personale read-only con evidence e citations', async () => {
    const result = await runFinancialAssistantQuery({
      supabase: supabase(fixtures),
      runtime: { user: USER, email: 'luca_renna@hotmail.com', now: new Date('2026-08-06T12:00:00Z') },
      body: { intent: 'personal.financial_summary', period: 'CURRENT_MONTH' },
    })
    expect(result.status).toBe('OK')
    expect(result.readOnly).toBe(true)
    expect(result.evidence.some((item) => item.metric === 'patrimonio_personale')).toBe(true)
    expect(result.citations.length).toBeGreaterThanOrEqual(2)
  })

  it('blocca Aurora per un account non autorizzato', async () => {
    const result = await runFinancialAssistantQuery({
      supabase: supabase(fixtures),
      runtime: { user: USER, email: 'altra@example.com', now: new Date('2026-08-06T12:00:00Z') },
      body: { intent: 'aurora.savings_summary' },
    })
    expect(result.status).toBe('FORBIDDEN')
  })

  it('risponde NEEDS_INPUT per affordability senza costo', async () => {
    const result = await runFinancialAssistantQuery({
      supabase: supabase(fixtures),
      runtime: { user: USER, email: 'luca_renna@hotmail.com', now: new Date('2026-08-06T12:00:00Z') },
      body: { intent: 'affordability.car', parameters: {} },
    })
    expect(result.status).toBe('NEEDS_INPUT')
    expect(result.missingInputs[0].field).toBe('price')
  })

  it('non esegue metodi di scrittura Supabase', async () => {
    const db = supabase(fixtures)
    await runFinancialAssistantQuery({
      supabase: db,
      runtime: { user: USER, email: 'luca_renna@hotmail.com', now: new Date('2026-08-06T12:00:00Z') },
      body: { intent: 'personal.income_expense_summary' },
    })
    expect(db.from).toHaveBeenCalled()
    for (const call of db.from.mock.results) {
      const builder = call.value as Record<string, unknown>
      expect(builder.insert).toBeUndefined()
      expect(builder.update).toBeUndefined()
      expect(builder.delete).toBeUndefined()
      expect(builder.upsert).toBeUndefined()
    }
  })

  it('usa tabelle e colonne reali dello schema Supabase corrente', async () => {
    const selected = new Map<string, string>()
    const db = supabase(fixtures, (table, columns) => selected.set(table, columns))
    await runFinancialAssistantQuery({
      supabase: db,
      runtime: { user: USER, email: 'luca_renna@hotmail.com', now: new Date('2026-08-06T12:00:00Z') },
      body: { intent: 'personal.income_expense_summary' },
    })

    expect(db.from).toHaveBeenCalledWith('recurring_rules')
    expect(db.from).not.toHaveBeenCalledWith('recurring_transactions')
    expect(selected.get('transactions')).not.toContain('destination_account_id')
    expect(selected.get('loans')).toContain('counterpart')
    expect(selected.get('loans')).not.toContain('person_name')
  })
})
