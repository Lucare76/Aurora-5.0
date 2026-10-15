import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import {
  seasonalContext,
  getSeasonalPayload,
} from '@/lib/seasonal-plan/service'
import { emptyPlan } from '@/lib/seasonal-plan/schema'
import { GET, PUT } from '@/app/api/seasonal-plan/route'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/seasonal-plan/service', async (original) => ({
  ...(await original<typeof import('@/lib/seasonal-plan/service')>()),
  seasonalContext: vi.fn(),
  getSeasonalPayload: vi.fn(),
}))
const account = '11111111-1111-4111-8111-111111111111'
const upsert = vi.fn()
const client = {
  auth: { getUser: vi.fn() },
  from: vi.fn(() => ({ upsert })),
  rpc: vi.fn(),
}
const plan = () => ({ ...emptyPlan('2026-10-15', [account]), reviewed: true })
const request = (p: unknown, preview = false) =>
  new Request(
    `http://localhost/api/seasonal-plan${preview ? '?preview=true' : ''}`,
    { method: 'PUT', body: JSON.stringify(p) },
  )
beforeEach(() => {
  vi.clearAllMocks()
  client.auth.getUser.mockResolvedValue({ data: { user: { id: 'owner' } } })
  vi.mocked(createClient).mockResolvedValue(client as never)
  vi.mocked(seasonalContext).mockResolvedValue({
    today: '2026-10-15',
    accounts: [
      {
        id: account,
        name: 'Banca',
        type: 'checking',
        balance: 1000,
        currency: 'EUR',
        is_active: true,
        is_hidden: false,
      },
    ],
    rules: [],
    installments: { plans: [], payments: [] },
    posted: [],
  })
  upsert.mockResolvedValue({ error: null })
})
describe('seasonal plan route', () => {
  it('requires authentication for reading and saving', async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect((await GET()).status).toBe(401)
    expect((await PUT(request(plan()))).status).toBe(401)
    expect(upsert).not.toHaveBeenCalled()
    expect(getSeasonalPayload).not.toHaveBeenCalled()
  })
  it('previews without any financial or persistence writes', async () => {
    const r = await PUT(request(plan(), true))
    expect(r.status).toBe(200)
    expect((await r.json()).forecast.spendableConfirmed).toBe(1000)
    expect(client.from).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
    expect(r.headers.get('Cache-Control')).toBe('no-store')
  })
  it('uses the authenticated owner, ignores spoofed user_id and writes simulation metadata only', async () => {
    expect((await PUT(request({ ...plan(), user_id: 'other' }))).status).toBe(
      200,
    )
    expect(client.from).toHaveBeenCalledExactlyOnceWith('seasonal_cash_plans')
    expect(upsert.mock.calls[0][0]).toMatchObject({
      user_id: 'owner',
      config: plan(),
    })
    expect(upsert.mock.calls[0][0].config).not.toHaveProperty('user_id')
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('rejects unknown, non-liquid or dedicated accounts and malformed amounts', async () => {
    expect((await PUT(request({ ...plan(), reserve: -1 }))).status).toBe(400)
    expect(
      (
        await PUT(
          request({
            ...plan(),
            account_ids: ['22222222-2222-4222-8222-222222222222'],
          }),
        )
      ).status,
    ).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('does not hide a database error behind a zero balance or success', async () => {
    vi.mocked(seasonalContext).mockRejectedValue(new Error('scope unavailable'))
    const r = await PUT(request(plan()))
    expect(r.status).toBe(500)
    expect(upsert).not.toHaveBeenCalled()
  })
})
