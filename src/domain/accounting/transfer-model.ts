export type TransferReferenceKind =
  | 'none'
  | 'peer_transaction'
  | 'destination_account'
  | 'ambiguous'
  | 'orphan'
  | 'invalid'

export type TransferTransactionLike = {
  id: string
  user_id: string
  account_id: string
  type: string
  amount: number
  transfer_peer_id: string | null
}

export type TransferAccountLike = {
  id: string
  user_id: string
}

export type LegacyPeerTransactionTransfer = {
  kind: 'peer_transaction'
  sourceAccountId: string
  peerTransactionId: string
  destinationAccountId: string
  reason: 'valid_reciprocal_peer'
}

export type DestinationAccountTransfer = {
  kind: 'destination_account'
  sourceAccountId: string
  destinationAccountId: string
  peerTransactionId: null
  reason: 'valid_destination_account'
}

export type AmbiguousTransferReference = {
  kind: 'ambiguous'
  sourceAccountId: string
  destinationAccountId: string | null
  peerTransactionId: string | null
  reason: 'reference_matches_account_and_transaction'
}

export type OrphanTransferReference = {
  kind: 'orphan'
  sourceAccountId: string
  destinationAccountId: null
  peerTransactionId: null
  reason: 'reference_not_found'
}

export type InvalidTransferReference = {
  kind: 'invalid'
  sourceAccountId: string
  destinationAccountId: string | null
  peerTransactionId: string | null
  reason:
    | 'non_transfer_reference'
    | 'peer_not_reciprocal'
    | 'peer_amount_mismatch'
    | 'peer_same_account'
    | 'peer_wrong_owner'
    | 'destination_same_as_source'
    | 'destination_wrong_owner'
}

export type NoTransferReference = {
  kind: 'none'
  sourceAccountId: string
  destinationAccountId: null
  peerTransactionId: null
  reason: 'no_reference'
}

export type ClassifiedTransfer =
  | LegacyPeerTransactionTransfer
  | DestinationAccountTransfer
  | AmbiguousTransferReference
  | OrphanTransferReference
  | InvalidTransferReference
  | NoTransferReference

export type ClassifyTransferReferenceInput = {
  transaction: TransferTransactionLike
  peerTransaction?: TransferTransactionLike | null
  destinationAccount?: TransferAccountLike | null
  sourceAccount?: TransferAccountLike | null
}

export function classifyTransferReference({
  transaction,
  peerTransaction = null,
  destinationAccount = null,
  sourceAccount = null,
}: ClassifyTransferReferenceInput): ClassifiedTransfer {
  const referenceId = transaction.transfer_peer_id
  const sourceAccountId = transaction.account_id

  if (!referenceId) {
    return {
      kind: 'none',
      sourceAccountId,
      destinationAccountId: null,
      peerTransactionId: null,
      reason: 'no_reference',
    }
  }

  const matchesPeer = peerTransaction?.id === referenceId
  const matchesDestination = destinationAccount?.id === referenceId

  if (matchesPeer && matchesDestination) {
    return {
      kind: 'ambiguous',
      sourceAccountId,
      destinationAccountId: destinationAccount.id,
      peerTransactionId: peerTransaction.id,
      reason: 'reference_matches_account_and_transaction',
    }
  }

  if (transaction.type !== 'transfer' && !matchesPeer) {
    return {
      kind: 'invalid',
      sourceAccountId,
      destinationAccountId: matchesDestination ? destinationAccount.id : null,
      peerTransactionId: null,
      reason: 'non_transfer_reference',
    }
  }

  if (matchesPeer) {
    return classifyPeerTransaction(transaction, peerTransaction)
  }

  if (matchesDestination) {
    return classifyDestinationAccount(transaction, destinationAccount, sourceAccount)
  }

  return {
    kind: 'orphan',
    sourceAccountId,
    destinationAccountId: null,
    peerTransactionId: null,
    reason: 'reference_not_found',
  }
}

function classifyPeerTransaction(
  transaction: TransferTransactionLike,
  peerTransaction: TransferTransactionLike,
): ClassifiedTransfer {
  if (peerTransaction.user_id !== transaction.user_id) {
    return invalidPeer(transaction, peerTransaction, 'peer_wrong_owner')
  }

  if (peerTransaction.transfer_peer_id !== transaction.id) {
    return invalidPeer(transaction, peerTransaction, 'peer_not_reciprocal')
  }

  if (peerTransaction.account_id === transaction.account_id) {
    return invalidPeer(transaction, peerTransaction, 'peer_same_account')
  }

  if (peerTransaction.amount !== transaction.amount) {
    return invalidPeer(transaction, peerTransaction, 'peer_amount_mismatch')
  }

  return {
    kind: 'peer_transaction',
    sourceAccountId: transaction.account_id,
    destinationAccountId: peerTransaction.account_id,
    peerTransactionId: peerTransaction.id,
    reason: 'valid_reciprocal_peer',
  }
}

function classifyDestinationAccount(
  transaction: TransferTransactionLike,
  destinationAccount: TransferAccountLike,
  sourceAccount: TransferAccountLike | null,
): ClassifiedTransfer {
  if (sourceAccount && sourceAccount.user_id !== transaction.user_id) {
    return {
      kind: 'invalid',
      sourceAccountId: transaction.account_id,
      destinationAccountId: destinationAccount.id,
      peerTransactionId: null,
      reason: 'destination_wrong_owner',
    }
  }

  if (destinationAccount.user_id !== transaction.user_id) {
    return {
      kind: 'invalid',
      sourceAccountId: transaction.account_id,
      destinationAccountId: destinationAccount.id,
      peerTransactionId: null,
      reason: 'destination_wrong_owner',
    }
  }

  if (destinationAccount.id === transaction.account_id) {
    return {
      kind: 'invalid',
      sourceAccountId: transaction.account_id,
      destinationAccountId: destinationAccount.id,
      peerTransactionId: null,
      reason: 'destination_same_as_source',
    }
  }

  return {
    kind: 'destination_account',
    sourceAccountId: transaction.account_id,
    destinationAccountId: destinationAccount.id,
    peerTransactionId: null,
    reason: 'valid_destination_account',
  }
}

function invalidPeer(
  transaction: TransferTransactionLike,
  peerTransaction: TransferTransactionLike,
  reason: InvalidTransferReference['reason'],
): InvalidTransferReference {
  return {
    kind: 'invalid',
    sourceAccountId: transaction.account_id,
    destinationAccountId: peerTransaction.account_id,
    peerTransactionId: peerTransaction.id,
    reason,
  }
}
