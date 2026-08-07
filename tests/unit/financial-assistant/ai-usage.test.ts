import { describe, expect, it, vi } from 'vitest'
import { normalizeOpenAiUsage } from '@/lib/financial-assistant/usage/openai'
import { fetchAiUsageSummary, recordAiUsage, summarize } from '@/lib/financial-assistant/usage/service'

describe('AI usage tracking', () => {
  it('normalizza la struttura usage della Responses API OpenAI', () => {
    expect(normalizeOpenAiUsage({
      usage: { input_tokens: 123, output_tokens: 45, total_tokens: 168 },
    }, 'gpt-4.1-mini')).toEqual({
      provider: 'OPENAI',
      model: 'gpt-4.1-mini',
      inputTokens: 123,
      outputTokens: 45,
      totalTokens: 168,
    })
  })

  it('ritorna null se OpenAI non restituisce usage', () => {
    expect(normalizeOpenAiUsage({}, 'gpt-4.1-mini')).toBeNull()
  })

  it('calcola total tokens se OpenAI non lo restituisce', () => {
    expect(normalizeOpenAiUsage({
      usage: { input_tokens: 10, output_tokens: 7 },
    }, 'gpt-4.1-mini')?.totalTokens).toBe(17)
  })

  it('normalizza valori token non validi a zero', () => {
    expect(normalizeOpenAiUsage({
      usage: { input_tokens: Number.NaN, output_tokens: -5, total_tokens: Number.POSITIVE_INFINITY },
    }, 'gpt-4.1-mini')).toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    })
  })

  it('ignora valori token non numerici', () => {
    expect(normalizeOpenAiUsage({
      usage: { input_tokens: '100' as unknown as number, output_tokens: undefined, total_tokens: undefined },
    }, 'gpt-4.1-mini')).toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    })
  })

  it('registra usage tramite RPC atomica senza payload sensibili', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    await recordAiUsage({
      supabase: { from: vi.fn(), rpc },
      userId: 'user-1',
      usage: {
        provider: 'OPENAI',
        model: 'gpt-4.1-mini',
        inputTokens: 1000,
        outputTokens: 2000,
        totalTokens: 3000,
      },
      now: new Date('2026-08-07T12:00:00Z'),
    })

    expect(rpc).toHaveBeenCalledWith('increment_ai_usage_daily', expect.objectContaining({
      p_user_id: 'user-1',
      p_provider: 'OPENAI',
      p_model: 'gpt-4.1-mini',
      p_input_tokens: 1000,
      p_output_tokens: 2000,
      p_total_tokens: 3000,
    }))
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/api-key|prompt|risposta|patrimonio|transaction_id|account_id/i)
  })

  it('aggrega due richieste stesso giorno e lascia null il costo se un provider non è prezzato', () => {
    const summary = summarize([
      row({ request_count: 1, input_tokens: 100, output_tokens: 50, total_tokens: 150, estimated_cost_usd: 0.001 }),
      row({ request_count: 1, provider: 'GEMINI', model: 'gemini-2.5-flash', input_tokens: 80, output_tokens: 20, total_tokens: 100, estimated_cost_usd: null }),
    ])

    expect(summary.requestCount).toBe(2)
    expect(summary.totalTokens).toBe(250)
    expect(summary.estimatedCost).toBeNull()
    expect(summary.providers).toEqual(['GEMINI', 'OPENAI'])
  })

  it('legge today e current_month senza esporre user_id', async () => {
    const rows = [
      row({ usage_date: '2026-08-07', request_count: 2, input_tokens: 100, output_tokens: 50, total_tokens: 150, estimated_cost_usd: 0.001 }),
      row({ usage_date: '2026-08-01', request_count: 1, input_tokens: 10, output_tokens: 5, total_tokens: 15, estimated_cost_usd: 0.0001 }),
    ]
    const supabase = querySupabase(rows)
    const result = await fetchAiUsageSummary({ supabase, userId: 'user-1', now: new Date('2026-08-07T10:00:00') })

    expect(result.today.requestCount).toBe(2)
    expect(result.currentMonth.requestCount).toBe(3)
    expect(JSON.stringify(result)).not.toContain('user-1')
  })
})

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    provider: 'OPENAI',
    model: 'gpt-4.1-mini',
    usage_date: '2026-08-07',
    request_count: 1,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: 0,
    last_request_at: '2026-08-07T10:00:00.000Z',
    ...overrides,
  }
}

function querySupabase(data: unknown[]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  }
  return { from: vi.fn(() => builder) }
}
