import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'private@example.test' }

function request(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

describe('personal timeline API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = 'private@example.test'
  })

  it('GET richiede sessione', async () => {
    mockSupabase({ user: null })
    const { GET } = await import('@/app/api/timeline/route')
    const response = await GET(new Request('http://localhost/api/timeline'))
    expect(response.status).toBe(401)
  })

  it('GET blocca utente non autorizzato', async () => {
    mockSupabase({ user: { ...user, email: 'other@example.test' } })
    const { GET } = await import('@/app/api/timeline/route')
    const response = await GET(new Request('http://localhost/api/timeline'))
    expect(response.status).toBe(403)
  })

  it('GET applica filtri, ricerca e paginazione', async () => {
    const filters: unknown[] = []
    const ranges: unknown[] = []
    mockSupabase({ filters, ranges })
    const { GET } = await import('@/app/api/timeline/route')
    const response = await GET(new Request('http://localhost/api/timeline?subject=AURORA&category=SCHOOL&year=2026&search=scuola&limit=25&offset=25'))
    expect(response.status).toBe(200)
    expect(filters).toContainEqual({ method: 'eq', column: 'user_id', value: user.id })
    expect(filters).toContainEqual({ method: 'eq', column: 'subject', value: 'AURORA' })
    expect(filters).toContainEqual({ method: 'eq', column: 'category', value: 'SCHOOL' })
    expect(ranges).toContainEqual({ from: 25, to: 49 })
  })

  it('POST valida input, normalizza tag e assegna ownership server-side', async () => {
    const writes: unknown[] = []
    mockSupabase({ writes })
    const { POST } = await import('@/app/api/timeline/route')
    const response = await POST(request({
      title: ' Visita scuola ',
      subject: 'AURORA',
      category: 'SCHOOL',
      event_date: '2026-08-09',
      end_date: null,
      tags: 'Scuola, scuola, Documento',
      importance: 'HIGH',
    }))
    expect(response.status).toBe(201)
    expect(writes[0]).toMatchObject({ user_id: user.id, title: 'Visita scuola', tags: ['scuola', 'documento'] })
  })

  it('POST rifiuta date e subject invalidi', async () => {
    mockSupabase()
    const { POST } = await import('@/app/api/timeline/route')
    const response = await POST(request({ title: 'x', subject: 'EMAIL', category: 'OTHER', event_date: '31/08/2026' }))
    expect(response.status).toBe(400)
  })

  it('PATCH modifica solo record propri', async () => {
    const writes: unknown[] = []
    const filters: unknown[] = []
    mockSupabase({ writes, filters })
    const { PATCH } = await import('@/app/api/timeline/[id]/route')
    const response = await PATCH(request({ title: 'Aggiornato', location: '' }), { params: Promise.resolve({ id: 'event-1' }) })
    expect(response.status).toBe(200)
    expect(writes[0]).toMatchObject({ title: 'Aggiornato', location: null })
    expect(filters).toContainEqual({ method: 'eq', column: 'user_id', value: user.id })
  })

  it('DELETE elimina solo record propri', async () => {
    const writes: unknown[] = []
    const filters: unknown[] = []
    mockSupabase({ writes, filters })
    const { DELETE } = await import('@/app/api/timeline/[id]/route')
    const response = await DELETE(new Request('http://localhost/api/timeline/event-1'), { params: Promise.resolve({ id: 'event-1' }) })
    expect(response.status).toBe(200)
    expect(writes).toContain('delete')
    expect(filters).toContainEqual({ method: 'eq', column: 'user_id', value: user.id })
  })
})

function mockSupabase(options: { user?: typeof user | null; writes?: unknown[]; filters?: unknown[]; ranges?: unknown[] } = {}) {
  const writes = options.writes ?? []
  const filters = options.filters ?? []
  const ranges = options.ranges ?? []
  const row = {
    id: 'event-1',
    user_id: user.id,
    event_date: '2026-08-09',
    end_date: null,
    title: 'Visita scuola',
    description: null,
    category: 'SCHOOL',
    subject: 'AURORA',
    location: null,
    provider: null,
    tags: ['scuola'],
    importance: 'HIGH',
    created_at: '2026-08-09T10:00:00.000Z',
    updated_at: '2026-08-09T10:00:00.000Z',
  }
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === undefined ? user : options.user } }) },
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ method: 'eq', column, value })
          return builder
        }),
        gte: vi.fn((column: string, value: unknown) => {
          filters.push({ method: 'gte', column, value })
          return builder
        }),
        lte: vi.fn((column: string, value: unknown) => {
          filters.push({ method: 'lte', column, value })
          return builder
        }),
        or: vi.fn((value: string) => {
          filters.push({ method: 'or', value })
          return builder
        }),
        order: vi.fn(() => builder),
        range: vi.fn((from: number, to: number) => {
          ranges.push({ from, to })
          return Promise.resolve({ data: [row], error: null, count: 1 })
        }),
        single: vi.fn(() => Promise.resolve({ data: row, error: null })),
        insert: vi.fn((value: unknown) => {
          writes.push(value)
          return builder
        }),
        update: vi.fn((value: unknown) => {
          writes.push(value)
          return builder
        }),
        delete: vi.fn(() => {
          writes.push('delete')
          return builder
        }),
        then: (resolve: (value: unknown) => void) => resolve({ data: [row], error: null }),
      }
      return builder
    }),
  } as never)
}
