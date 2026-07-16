import { describe, expect, it } from 'vitest'

import type { Account, Transaction } from '@/types/database'

import { adaptTransactionRow } from './transaction-adapter'

const userId = 'user-1'
const sourceAccount = account({ id: 'account-source' })
const destinationAccount = account({ id: 'account-destination' })

describe('adaptTransactionRow', () => {
  it('adapts income records without transfer metadata', () => {
    const adapted = adaptTransactionRow(transaction({ type: 'income', transfer_peer_id: null }))

    expect(adapted).toMatchObject({
      userId,
      accountId: sourceAccount.id,
      categoryId: 'category-1',
      sourceAccountId: sourceAccount.id,
      destinationAccountId: null,
      peerTransactionId: null,
      transferReferenceKind: 'none',
    })
  })

  it('adapts expense records without transfer metadata', () => {
    const adapted = adaptTransactionRow(transaction({ type: 'expense', transfer_peer_id: null }))

    expect(adapted.transferReferenceKind).toBe('none')
    expect(adapted.destinationAccountId).toBeNull()
  })

  it('adapts legacy peer transaction transfers', () => {
    const source = transaction({
      id: 'tx-out',
      type: 'expense',
      transfer_peer_id: 'tx-in',
    })
    const peer = transaction({
      id: 'tx-in',
      account_id: destinationAccount.id,
      type: 'income',
      transfer_peer_id: 'tx-out',
    })

    const adapted = adaptTransactionRow(source, { peerTransaction: peer })

    expect(adapted).toMatchObject({
      transferReferenceKind: 'peer_transaction',
      destinationAccountId: destinationAccount.id,
      peerTransactionId: 'tx-in',
    })
  })

  it('adapts new destination-account transfers', () => {
    const adapted = adaptTransactionRow(
      transaction({ type: 'transfer', transfer_peer_id: destinationAccount.id }),
      { sourceAccount, destinationAccount },
    )

    expect(adapted).toMatchObject({
      transferReferenceKind: 'destination_account',
      destinationAccountId: destinationAccount.id,
      peerTransactionId: null,
    })
  })

  it('adapts invalid transfer records explicitly', () => {
    const adapted = adaptTransactionRow(
      transaction({ type: 'transfer', transfer_peer_id: sourceAccount.id }),
      { sourceAccount, destinationAccount: sourceAccount },
    )

    expect(adapted.transferReferenceKind).toBe('invalid')
    expect(adapted.transferReference.reason).toBe('destination_same_as_source')
  })

  it('preserves records without category', () => {
    const adapted = adaptTransactionRow(
      transaction({
        category_id: null,
        type: 'expense',
        transfer_peer_id: null,
      }),
    )

    expect(adapted.categoryId).toBeNull()
    expect(adapted.transferReferenceKind).toBe('none')
  })
})

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    user_id: userId,
    account_id: sourceAccount.id,
    category_id: 'category-1',
    type: 'transfer',
    amount: 100,
    description: 'Test',
    notes: null,
    date: '2026-03-10',
    transfer_peer_id: destinationAccount.id,
    recurring_id: null,
    receipt_url: null,
    receipt_data: null,
    created_at: '2026-03-10T00:00:00.000Z',
    updated_at: '2026-03-10T00:00:00.000Z',
    ...overrides,
  }
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-source',
    user_id: userId,
    name: 'Conto',
    type: 'checking',
    color: null,
    icon: null,
    balance: 0,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-03-10T00:00:00.000Z',
    updated_at: '2026-03-10T00:00:00.000Z',
    ...overrides,
  }
}
