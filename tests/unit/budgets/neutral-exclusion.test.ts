import { describe, expect, it, vi } from 'vitest'
import { listMonthlyBudgets } from '@/lib/budgets/service'

type Call = { method: string; args: unknown[] }

function chainable(data: unknown, calls: Call[]) {
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'in', 'is', 'gte', 'lte', 'order'] as const
  for (const method of methods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    })
  }
  ;(builder as { then: (resolve: (value: { data: unknown; error: null }) => unknown) => unknown }).then = (resolve) =>
    resolve({ data, error: null })
  return builder
}

function mockSupabase() {
  const transactionCalls: Call[] = []
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'budgets') return chainable([{ id: 'b1', category_id: 'cat-1', amount: 400 }], [])
      if (table === 'categories') return chainable([{ id: 'cat-1', name: 'Alimentari', icon: null, parent_id: null }], [])
      if (table === 'transactions') return chainable([], transactionCalls)
      return chainable([], [])
    }),
  }
  return { supabase, transactionCalls }
}

describe('10. il calcolo budget esclude i movimenti neutri (partite di giro) dalla spesa', () => {
  it('filtra le transazioni con is_neutral=false nella query di calcolo budget', async () => {
    const { supabase, transactionCalls } = mockSupabase()

    await listMonthlyBudgets(supabase as never, 2026, 7)

    expect(transactionCalls).toContainEqual({ method: 'eq', args: ['is_neutral', false] })
  })
})
