import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { buildPersonalOverviewPayload } from '@/lib/dashboard/personal-overview'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/dashboard/personal-overview', () => ({
  buildPersonalOverviewPayload: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const buildPayloadMock = vi.mocked(buildPersonalOverviewPayload)

describe('GET /api/dashboard/personal-overview', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('restituisce 401 senza autenticazione', async () => {
    mockSupabase({ authenticated: false })
    const { GET } = await import('@/app/api/dashboard/personal-overview/route')

    const response = await GET()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'UNAUTHENTICATED' })
  })

  it('restituisce payload base con header no-store', async () => {
    const supabase = mockSupabase()
    buildPayloadMock.mockResolvedValue({ generatedAt: '2026-07-15T10:00:00.000Z', attention: { items: [] } } as any)
    const { GET } = await import('@/app/api/dashboard/personal-overview/route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body.generatedAt).toBe('2026-07-15T10:00:00.000Z')
    expect(buildPayloadMock).toHaveBeenCalledWith(supabase, expect.objectContaining({ id: 'user-1' }))
  })

  it('sanitizza errori interni', async () => {
    mockSupabase()
    buildPayloadMock.mockRejectedValue(new Error('raw database detail'))
    const { GET } = await import('@/app/api/dashboard/personal-overview/route')

    const response = await GET()

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'PERSONAL_OVERVIEW_UNAVAILABLE' })
  })
})

function mockSupabase(options: { authenticated?: boolean } = {}) {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.authenticated === false ? null : { id: 'user-1', email: 'luca@example.test' },
        },
        error: null,
      }),
    },
  }
  createClientMock.mockResolvedValue(supabase as never)
  return supabase
}
