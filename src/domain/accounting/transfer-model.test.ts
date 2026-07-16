import { describe, expect, it } from 'vitest'

import { classifyTransferReference, type TransferTransactionLike } from './transfer-model'

const userId = 'user-1'
const otherUserId = 'user-2'
const sourceAccount = { id: 'account-source', user_id: userId }
const destinationAccount = { id: 'account-destination', user_id: userId }

describe('classifyTransferReference', () => {
  it('classifies transactions without reference as none', () => {
    expect(classifyTransferReference({ transaction: tx({ transfer_peer_id: null }) })).toMatchObject({
      kind: 'none',
      destinationAccountId: null,
      peerTransactionId: null,
    })
  })

  it('classifies a valid reciprocal peer transaction', () => {
    const transaction = tx({ id: 'tx-out', transfer_peer_id: 'tx-in', type: 'expense' })
    const peerTransaction = tx({
      id: 'tx-in',
      account_id: destinationAccount.id,
      transfer_peer_id: 'tx-out',
      type: 'income',
    })

    expect(classifyTransferReference({ transaction, peerTransaction })).toMatchObject({
      kind: 'peer_transaction',
      sourceAccountId: sourceAccount.id,
      destinationAccountId: destinationAccount.id,
      peerTransactionId: 'tx-in',
    })
  })

  it('classifies a valid destination account reference', () => {
    expect(
      classifyTransferReference({
        transaction: tx({ transfer_peer_id: destinationAccount.id }),
        sourceAccount,
        destinationAccount,
      }),
    ).toMatchObject({
      kind: 'destination_account',
      destinationAccountId: destinationAccount.id,
      peerTransactionId: null,
    })
  })

  it('classifies a reference matching both account and transaction as ambiguous', () => {
    const sharedId = 'shared-id'

    expect(
      classifyTransferReference({
        transaction: tx({ transfer_peer_id: sharedId }),
        peerTransaction: tx({ id: sharedId, account_id: 'peer-account', transfer_peer_id: 'tx-1' }),
        destinationAccount: { id: sharedId, user_id: userId },
      }),
    ).toMatchObject({
      kind: 'ambiguous',
      destinationAccountId: sharedId,
      peerTransactionId: sharedId,
    })
  })

  it('classifies missing references as orphan', () => {
    expect(
      classifyTransferReference({
        transaction: tx({ transfer_peer_id: 'missing-reference' }),
      }),
    ).toMatchObject({
      kind: 'orphan',
      reason: 'reference_not_found',
    })
  })

  it('classifies non reciprocal peers as invalid', () => {
    expect(
      classifyTransferReference({
        transaction: tx({ id: 'tx-out', transfer_peer_id: 'tx-in' }),
        peerTransaction: tx({
          id: 'tx-in',
          account_id: destinationAccount.id,
          transfer_peer_id: 'another-tx',
        }),
      }),
    ).toMatchObject({
      kind: 'invalid',
      reason: 'peer_not_reciprocal',
    })
  })

  it('classifies peers with different amounts as invalid', () => {
    expect(
      classifyTransferReference({
        transaction: tx({ id: 'tx-out', transfer_peer_id: 'tx-in', amount: 100 }),
        peerTransaction: tx({
          id: 'tx-in',
          account_id: destinationAccount.id,
          transfer_peer_id: 'tx-out',
          amount: 99,
        }),
      }),
    ).toMatchObject({
      kind: 'invalid',
      reason: 'peer_amount_mismatch',
    })
  })

  it('classifies same source and destination account as invalid', () => {
    expect(
      classifyTransferReference({
        transaction: tx({ transfer_peer_id: sourceAccount.id }),
        sourceAccount,
        destinationAccount: sourceAccount,
      }),
    ).toMatchObject({
      kind: 'invalid',
      reason: 'destination_same_as_source',
    })
  })

  it('classifies references owned by another user as invalid', () => {
    expect(
      classifyTransferReference({
        transaction: tx({ transfer_peer_id: destinationAccount.id }),
        sourceAccount,
        destinationAccount: { ...destinationAccount, user_id: otherUserId },
      }),
    ).toMatchObject({
      kind: 'invalid',
      reason: 'destination_wrong_owner',
    })
  })
})

function tx(overrides: Partial<TransferTransactionLike> = {}): TransferTransactionLike {
  return {
    id: 'tx-1',
    user_id: userId,
    account_id: sourceAccount.id,
    type: 'transfer',
    amount: 100,
    transfer_peer_id: destinationAccount.id,
    ...overrides,
  }
}
