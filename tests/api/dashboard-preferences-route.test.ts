import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_DASHBOARD_PREFERENCES } from '@/lib/dashboard/preferences'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const userId = '11111111-1111-4111-8111-111111111111'

function makeSelectBuilder(row: unknown = null, error: unknown = null) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: row, error }))
  return builder
}

function makeUpsertBuilder(row: unknown = null, error: unknown = null) {
  const builder: Record<string, unknown> = {}
  builder.upsert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve({ data: row, error }))
  return builder
}

function mockSupabase(options: { authenticated?: boolean; row?: unknown; queryError?: unknown; upsertError?: unknown } = {}) {
  const selectBuilder = makeSelectBuilder(options.row ?? null, options.queryError ?? null)
  const upsertBuilder = makeUpsertBuilder(options.row ?? {
    user_id: userId,
    visible_widgets: DEFAULT_DASHBOARD_PREFERENCES.visibleWidgets,
    widget_order: DEFAULT_DASHBOARD_PREFERENCES.widgetOrder,
    compact_mode: false,
    default_period: 'current_month',
  }, options.upsertError ?? null)

  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.authenticated === false ? null : { id: userId, email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: selectBuilder.select,
      eq: selectBuilder.eq,
      maybeSingle: selectBuilder.maybeSingle,
      upsert: upsertBuilder.upsert,
    })),
  } as never)

  return { selectBuilder, upsertBuilder }
}

describe('dashboard preferences API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('GET returns 401 for unauthenticated users', async () => {
    mockSupabase({ authenticated: false })
    const { GET } = await import('@/app/api/dashboard/preferences/route')

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('GET returns defaults when no database row exists', async () => {
    mockSupabase()
    const { GET } = await import('@/app/api/dashboard/preferences/route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.preferences).toEqual(DEFAULT_DASHBOARD_PREFERENCES)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('PUT rejects invalid preference payloads', async () => {
    mockSupabase()
    const { PUT } = await import('@/app/api/dashboard/preferences/route')

    const response = await PUT(new Request('http://localhost/api/dashboard/preferences', {
      method: 'PUT',
      body: JSON.stringify({ compactMode: 'yes' }),
    }))

    expect(response.status).toBe(400)
  })

  it('PUT upserts normalized user-scoped preferences', async () => {
    const { upsertBuilder } = mockSupabase()
    const { PUT } = await import('@/app/api/dashboard/preferences/route')

    const response = await PUT(new Request('http://localhost/api/dashboard/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        visibleWidgets: ['summary', 'unknown'],
        widgetOrder: ['summary'],
        compactMode: true,
        defaultPeriod: 'previous_month',
      }),
    }))

    expect(response.status).toBe(200)
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId,
      visible_widgets: ['summary'],
      compact_mode: true,
      default_period: 'previous_month',
    }), { onConflict: 'user_id' })
  })
})
