import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'private@example.test' }

function request(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

describe('personal deadlines API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.PRIVATE_HR_ACCOUNT_EMAIL = 'private@example.test'
  })

  it('GET richiede sessione', async () => {
    mockSupabase({ user: null })
    const { GET } = await import('@/app/api/deadlines/route')
    const response = await GET(new Request('http://localhost/api/deadlines'))
    expect(response.status).toBe(401)
  })

  it('GET blocca utente non autorizzato', async () => {
    mockSupabase({ user: { ...user, email: 'other@example.test' } })
    const { GET } = await import('@/app/api/deadlines/route')
    const response = await GET(new Request('http://localhost/api/deadlines'))
    expect(response.status).toBe(403)
  })

  it('POST valida input e ownership', async () => {
    const writes: unknown[] = []
    mockSupabase({ writes })
    const { POST } = await import('@/app/api/deadlines/route')
    const response = await POST(request({
      title: ' Assicurazione auto ',
      category: 'VEHICLE',
      due_date: '2026-09-30',
      priority: 'HIGH',
      recurrence: 'YEARLY',
      reminder_days_before: 30,
    }))

    expect(response.status).toBe(201)
    expect(writes[0]).toMatchObject({ user_id: user.id, title: 'Assicurazione auto', category: 'VEHICLE' })
  })

  it('POST rifiuta dati non validi', async () => {
    mockSupabase()
    const { POST } = await import('@/app/api/deadlines/route')
    const response = await POST(request({ title: '', category: 'OTHER', due_date: '31/08/2026' }))
    expect(response.status).toBe(400)
  })

  it('PATCH completa, riapre e filtra per user_id', async () => {
    const writes: unknown[] = []
    const filters: unknown[] = []
    mockSupabase({ writes, filters })
    const { PATCH } = await import('@/app/api/deadlines/[id]/route')

    let response = await PATCH(request({ status: 'COMPLETED' }), { params: Promise.resolve({ id: 'deadline-1' }) })
    expect(response.status).toBe(200)
    expect(writes[0]).toMatchObject({ status: 'COMPLETED' })
    expect((writes[0] as Record<string, unknown>).completed_at).toBeTruthy()

    response = await PATCH(request({ status: 'ACTIVE' }), { params: Promise.resolve({ id: 'deadline-1' }) })
    expect(response.status).toBe(200)
    expect(writes[1]).toMatchObject({ status: 'ACTIVE', completed_at: null })

    response = await PATCH(request({ status: 'CANCELLED' }), { params: Promise.resolve({ id: 'deadline-1' }) })
    expect(response.status).toBe(200)
    expect(writes[2]).toMatchObject({ status: 'CANCELLED', completed_at: null })
    expect(filters).toContainEqual({ column: 'user_id', value: user.id })
  })

  it('DELETE elimina solo record propri', async () => {
    const filters: unknown[] = []
    const writes: unknown[] = []
    mockSupabase({ filters, writes })
    const { DELETE } = await import('@/app/api/deadlines/[id]/route')
    const response = await DELETE(new Request('http://localhost/api/deadlines/deadline-1'), { params: Promise.resolve({ id: 'deadline-1' }) })
    expect(response.status).toBe(200)
    expect(writes).toContain('delete')
    expect(filters).toContainEqual({ column: 'user_id', value: user.id })
  })
})

function mockSupabase(options: { user?: typeof user | null; writes?: unknown[]; filters?: unknown[] } = {}) {
  const writes = options.writes ?? []
  const filters = options.filters ?? []
  const row = {
    id: 'deadline-1',
    user_id: user.id,
    title: 'Assicurazione auto',
    description: null,
    category: 'VEHICLE',
    due_date: '2026-09-30',
    status: 'ACTIVE',
    priority: 'HIGH',
    recurrence: 'YEARLY',
    reminder_days_before: 30,
    completed_at: null,
    created_at: '2026-08-09T00:00:00.000Z',
    updated_at: '2026-08-09T00:00:00.000Z',
  }
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === undefined ? user : options.user } }) },
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ column, value })
          return builder
        }),
        order: vi.fn(() => builder),
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
