import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/adi/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

const USER = { id: 'user-1' }

function request(body: unknown): Request {
  return { json: () => Promise.resolve(body), url: 'http://localhost/api/adi' } as Request
}

function query(data: unknown, error: unknown = null) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'insert', 'single'] as const) {
    builder[method] = vi.fn(() => builder)
  }
  ;(builder as { then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => unknown }).then = (resolve) => resolve({ data, error })
  return builder
}

function supabaseMock(options: {
  user?: typeof USER | null
  entries?: unknown[]
  inserted?: unknown
  transaction?: unknown
} = {}) {
  const entries = options.entries ?? []
  const inserted = options.inserted ?? { id: 'entry-1' }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === undefined ? USER : options.user } }) },
    from: vi.fn((table: string) => {
      if (table === 'adi_entries') {
        const builder = query(entries)
        ;(builder.insert as ReturnType<typeof vi.fn>).mockReturnValue(query(inserted))
        return builder
      }
      if (table === 'transactions') return query(options.transaction ?? null)
      return query([])
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock())
})

describe('/api/adi', () => {
  it('richiede autenticazione', async () => {
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock({ user: null }))
    const res = await POST(request({}))
    expect(res.status).toBe(401)
  })

  it('restituisce il saldo ADI', async () => {
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock({
      entries: [
        { entry_type: 'credit', amount: 500, date: '2026-08-01', adi_category: null },
        { entry_type: 'debit', amount: 120, date: '2026-08-02', adi_category: 'SUPERMERCATO' },
      ],
    }))
    const res = await GET({ url: 'http://localhost/api/adi' } as Request)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.summary.balance).toBe(380)
  })

  it('rifiuta categorie ADI non ammesse', async () => {
    const res = await POST(request({
      entryType: 'debit',
      amount: 10,
      date: '2026-08-01',
      adiCategory: 'RISTORANTE',
      description: 'Spesa',
      paidWithAdi: true,
    }))
    expect(res.status).toBe(400)
  })

  it('registra un accredito valido', async () => {
    const res = await POST(request({
      entryType: 'credit',
      amount: 500,
      date: '2026-08-01',
      referencePeriod: '2026-08',
      description: 'ADI agosto 2026',
    }))
    expect(res.status).toBe(201)
  })

  it('blocca una spesa superiore al saldo disponibile', async () => {
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock({
      entries: [{ entry_type: 'credit', amount: 50, date: '2026-08-01', adi_category: null }],
    }))
    const res = await POST(request({
      entryType: 'debit',
      amount: 60,
      date: '2026-08-02',
      adiCategory: 'BENZINA',
      description: 'Benzina',
      paidWithAdi: true,
    }))
    expect(res.status).toBe(409)
  })

  it('registra una spesa valida marcata come pagata con ADI', async () => {
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock({
      entries: [{ entry_type: 'credit', amount: 100, date: '2026-08-01', adi_category: null }],
    }))
    const res = await POST(request({
      entryType: 'debit',
      amount: 40,
      date: '2026-08-02',
      adiCategory: 'ABBIGLIAMENTO_AURORA',
      description: 'Vestiti Aurora',
      paidWithAdi: true,
    }))
    expect(res.status).toBe(201)
  })

  it('rifiuta una transazione collegata non dell utente', async () => {
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseMock({
      entries: [{ entry_type: 'credit', amount: 100, date: '2026-08-01', adi_category: null }],
      transaction: null,
    }))
    const res = await POST(request({
      entryType: 'debit',
      amount: 40,
      date: '2026-08-02',
      adiCategory: 'SUPERMERCATO',
      description: 'Spesa',
      transactionId: '11111111-1111-4111-8111-111111111111',
      paidWithAdi: true,
    }))
    expect(res.status).toBe(404)
  })
})
