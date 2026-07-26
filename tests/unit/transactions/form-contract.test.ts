import { describe, expect, it } from 'vitest'

import { quickCommands } from '@/components/global-command-menu'
import { buildTransactionPayload, parseTransactionAmount } from '@/lib/transactions/form-contract'

const sourceAccountId = '00000000-0000-4000-8000-0000000000a1'
const destinationAccountId = '00000000-0000-4000-8000-0000000000b2'
const categoryId = '00000000-0000-4000-8000-0000000000d4'

describe('transaction form contract', () => {
  it('parses Italian decimal amounts for transfers', () => {
    expect(parseTransactionAmount('113,50')).toBe(113.5)
    expect(parseTransactionAmount('113.50')).toBe(113.5)
    expect(parseTransactionAmount(113.5)).toBe(113.5)
  })

  it('builds the frontend payload expected by the transfer API', () => {
    const payload = buildTransactionPayload({
      type: 'transfer',
      amount: '113,50',
      description: 'marathonbet',
      date: '2026-07-25',
      account_id: sourceAccountId,
      destination_account_id: destinationAccountId,
      category_id: categoryId,
      notes: '',
    })

    expect(payload).toEqual({
      account_id: sourceAccountId,
      type: 'transfer',
      amount: 113.5,
      description: 'MARATHONBET',
      notes: null,
      date: '2026-07-25',
      destination_account_id: destinationAccountId,
    })
    expect(payload).not.toHaveProperty('category_id')
  })

  it('keeps category optional for income and expense movements', () => {
    expect(buildTransactionPayload({
      type: 'expense',
      amount: '25,10',
      description: 'Spesa',
      date: '2026-07-25',
      account_id: sourceAccountId,
      category_id: '',
    })).toMatchObject({
      type: 'expense',
      amount: 25.1,
      category_id: null,
    })

    expect(buildTransactionPayload({
      type: 'income',
      amount: '99.90',
      description: 'Rimborso',
      date: '2026-07-25',
      account_id: sourceAccountId,
      category_id: categoryId,
    })).toMatchObject({
      type: 'income',
      amount: 99.9,
      category_id: categoryId,
    })
  })

  it('preserves empty descriptions so the API validation remains authoritative', () => {
    const payload = buildTransactionPayload({
      type: 'transfer',
      amount: '10',
      description: '',
      date: '2026-07-25',
      account_id: sourceAccountId,
      destination_account_id: destinationAccountId,
    })

    expect(payload.description).toBe('')
  })

  it('normalizes typed descriptions to uppercase before saving', () => {
    expect(buildTransactionPayload({
      type: 'expense',
      amount: '12',
      description: 'Deco supermercato',
      date: '2026-07-26',
      account_id: sourceAccountId,
    }).description).toBe('DECO SUPERMERCATO')
  })

  it('opens transfer creation from the command menu with the same form contract', () => {
    expect(quickCommands.find((command) => command.id === 'new-transfer')).toMatchObject({
      href: '/transactions?action=create&type=transfer',
      keywords: expect.arrayContaining(['giroconto', 'trasferimento']),
    })
  })
})
