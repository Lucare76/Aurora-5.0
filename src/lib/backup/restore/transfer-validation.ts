import type { AuroraBackupV1 } from '../types'
import type { DryRunIssue, TransferValidationResult } from './types'

export function validateRestoreTransfers(backup: AuroraBackupV1): TransferValidationResult {
  const accountIds = new Set(backup.data.accounts.map((account) => account.id))
  const transactionById = new Map(backup.data.transactions.map((tx) => [tx.id, tx]))
  const issues: DryRunIssue[] = []
  let valid = 0
  let legacyRecoverable = 0
  let ambiguous = 0
  let blocked = 0
  const seenPairs = new Set<string>()

  const transferRows = backup.data.transactions.filter((tx) => tx.type === 'transfer')

  for (const tx of transferRows) {
    if (!tx.transfer_peer_id) {
      blocked += 1
      issues.push(issue('TRANSFER_PEER_EMPTY', 'error', tx.id, 'Trasferimento senza conto destinazione o peer.'))
      continue
    }

    if (accountIds.has(tx.transfer_peer_id)) {
      if (tx.transfer_peer_id === tx.account_id) {
        blocked += 1
        issues.push(issue('TRANSFER_SAME_ACCOUNT', 'error', tx.id, 'Conto origine e destinazione coincidono.'))
      } else {
        valid += 1
      }
      continue
    }

    const peer = transactionById.get(tx.transfer_peer_id)
    if (!peer) {
      blocked += 1
      issues.push(issue('TRANSFER_PEER_ORPHAN', 'error', tx.id, 'Peer transfer non presente nel backup.'))
      continue
    }

    const pairKey = [tx.id, peer.id].sort().join(':')
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    if (peer.transfer_peer_id !== tx.id || peer.amount !== tx.amount || peer.account_id === tx.account_id) {
      ambiguous += 1
      issues.push(issue('TRANSFER_LEGACY_AMBIGUOUS', 'error', tx.id, 'Coppia transfer legacy ambigua.'))
    } else {
      legacyRecoverable += 1
      issues.push(issue('TRANSFER_LEGACY_RECOVERABLE', 'warning', tx.id, 'Transfer legacy recuperabile in restore futuro.'))
    }
  }

  return {
    total: transferRows.length,
    valid,
    legacyRecoverable,
    ambiguous,
    blocked,
    transfersNeutral: blocked === 0 && ambiguous === 0,
    issues,
  }
}

function issue(code: string, severity: 'error' | 'warning', id: string, message: string): DryRunIssue {
  return {
    code,
    severity,
    path: ['transactions', id, 'transfer_peer_id'],
    message,
  }
}
