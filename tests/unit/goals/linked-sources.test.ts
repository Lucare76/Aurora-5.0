import { describe, expect, it } from 'vitest'
import { buildGoalLinkedAggregate } from '@/lib/goals/linked-sources'

describe('linked goal sources', () => {
  it('uses only the latest snapshot for each source and sums included values', () => {
    const sources = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: '99999999-9999-4999-8999-999999999999',
        goal_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        provider: 'SCALABLE' as const,
        source_type: 'POSITION' as const,
        external_key: 'world',
        display_name: 'MSCI World',
        currency: 'EUR',
        include_in_goal: true,
        metadata: {},
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        user_id: '99999999-9999-4999-8999-999999999999',
        goal_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        provider: 'SCALABLE' as const,
        source_type: 'POSITION' as const,
        external_key: 'vwce',
        display_name: 'Vanguard',
        currency: 'EUR',
        include_in_goal: false,
        metadata: {},
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ]

    const snapshots = [
      {
        id: 's1',
        source_id: sources[0].id,
        user_id: sources[0].user_id,
        value: 5500,
        quantity: 43.7,
        unit_price: 125,
        monthly_plan_amount: 100,
        next_plan_date: '2026-10-01',
        observed_at: '2026-09-17T08:00:00Z',
        metadata: {},
        created_at: '2026-09-17T08:00:00Z',
      },
      {
        id: 's2',
        source_id: sources[0].id,
        user_id: sources[0].user_id,
        value: 5577.5,
        quantity: 43.703978,
        unit_price: 127.62,
        monthly_plan_amount: 100,
        next_plan_date: '2026-10-01',
        observed_at: '2026-09-18T05:56:00Z',
        metadata: {},
        created_at: '2026-09-18T05:56:00Z',
      },
      {
        id: 's3',
        source_id: sources[1].id,
        user_id: sources[1].user_id,
        value: 4052.35,
        quantity: 24.125452,
        unit_price: 167.97,
        monthly_plan_amount: 4000,
        next_plan_date: '2026-10-16',
        observed_at: '2026-09-18T05:56:00Z',
        metadata: {},
        created_at: '2026-09-18T05:56:00Z',
      },
    ]

    const aggregate = buildGoalLinkedAggregate(sources, snapshots).get(sources[0].goal_id)
    expect(aggregate?.totalValue).toBe(5577.5)
    expect(aggregate?.monthlyPlanAmount).toBe(100)
    expect(aggregate?.sources[0].latestSnapshot?.id).toBe('s2')
    expect(aggregate?.sources[1].latestSnapshot?.id).toBe('s3')
  })
})
