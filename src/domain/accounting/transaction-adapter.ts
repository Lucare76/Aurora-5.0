import type { Account, Transaction, TransactionType } from '@/types/database'

import {
  classifyTransferReference,
  type ClassifiedTransfer,
  type TransferAccountLike,
  type TransferTransactionLike,
} from './transfer-model'

export type AppTransaction = {
  id: string
  userId: string
  date: string
  type: TransactionType
  amount: number
  description: string | null
  notes: string | null
  accountId: string
  sourceAccountId: string
  categoryId: string | null
  recurringId: string | null
  receiptUrl: string | null
  receiptData: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  destinationAccountId: string | null
  peerTransactionId: string | null
  transferReferenceKind: ClassifiedTransfer['kind']
  transferReference: ClassifiedTransfer
}

export type AdaptTransactionContext = {
  peerTransaction?: Transaction | null
  destinationAccount?: Account | null
  sourceAccount?: Account | null
}

export function adaptTransactionRow(
  transaction: Transaction,
  context: AdaptTransactionContext = {},
): AppTransaction {
  const transferReference = classifyTransferReference({
    transaction: toTransferTransaction(transaction),
    peerTransaction: context.peerTransaction ? toTransferTransaction(context.peerTransaction) : null,
    destinationAccount: context.destinationAccount
      ? toTransferAccount(context.destinationAccount)
      : null,
    sourceAccount: context.sourceAccount ? toTransferAccount(context.sourceAccount) : null,
  })

  return {
    id: transaction.id,
    userId: transaction.user_id,
    date: transaction.date,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    notes: transaction.notes,
    accountId: transaction.account_id,
    sourceAccountId: transaction.account_id,
    categoryId: transaction.category_id,
    recurringId: transaction.recurring_id,
    receiptUrl: transaction.receipt_url,
    receiptData: transaction.receipt_data,
    createdAt: transaction.created_at,
    updatedAt: transaction.updated_at,
    destinationAccountId: transferReference.destinationAccountId,
    peerTransactionId: transferReference.peerTransactionId,
    transferReferenceKind: transferReference.kind,
    transferReference,
  }
}

export function adaptTransactionRows(
  transactions: Transaction[],
  context: {
    accounts?: Account[]
    peerTransactions?: Transaction[]
  } = {},
): AppTransaction[] {
  const accountById = new Map((context.accounts ?? []).map((account) => [account.id, account]))
  const peerById = new Map(
    (context.peerTransactions ?? []).map((transaction) => [transaction.id, transaction]),
  )

  return transactions.map((transaction) =>
    adaptTransactionRow(transaction, {
      sourceAccount: accountById.get(transaction.account_id) ?? null,
      destinationAccount: transaction.transfer_peer_id
        ? accountById.get(transaction.transfer_peer_id) ?? null
        : null,
      peerTransaction: transaction.transfer_peer_id
        ? peerById.get(transaction.transfer_peer_id) ?? null
        : null,
    }),
  )
}

function toTransferTransaction(transaction: Transaction): TransferTransactionLike {
  return {
    id: transaction.id,
    user_id: transaction.user_id,
    account_id: transaction.account_id,
    type: transaction.type,
    amount: transaction.amount,
    transfer_peer_id: transaction.transfer_peer_id,
  }
}

function toTransferAccount(account: Account): TransferAccountLike {
  return {
    id: account.id,
    user_id: account.user_id,
  }
}
