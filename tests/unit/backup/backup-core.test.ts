import { describe, expect, it } from 'vitest'

import {
  canonicalizeAuroraBackup,
  calculateRecordCounts,
  computeBackupChecksum,
  detectBackupDuplicates,
  inspectAuroraBackup,
  normalizeAuroraBackup,
  validateAuroraBackup,
  validateBackupRelationships,
  verifyBackupChecksum,
  type AuroraBackupV1,
} from '@/lib/backup'
import {
  cloneBackup,
  createCompleteBackup,
  createMinimalBackup,
  ids,
} from '../../fixtures/backup/backup-fixtures'

describe('Aurora Backup v1 core', () => {
  describe('versionamento e root', () => {
    it('accetta un backup v1 valido con checksum corretto', () => {
      const backup = withChecksum(createMinimalBackup())

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(true)
      expect(result.normalizedBackup?.schemaVersion).toBe(1)
    })

    it('rifiuta root non oggetto senza lanciare eccezioni', () => {
      const result = inspectAuroraBackup('not-json')

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('INVALID_ROOT')
    })

    it('rifiuta formato errato', () => {
      const backup = withChecksum({ ...createMinimalBackup(), format: 'other-format' as 'aurora-backup' })

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('UNKNOWN_FORMAT')
    })

    it('rifiuta schemaVersion mancante', () => {
      const backup = withChecksum(createMinimalBackup()) as Partial<AuroraBackupV1>
      delete backup.schemaVersion

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('SCHEMA_VERSION_MISSING')
    })

    it('rifiuta schemaVersion futura', () => {
      const backup = withChecksum({ ...createMinimalBackup(), schemaVersion: 99 as 1 })

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('FUTURE_SCHEMA_VERSION')
    })
  })

  describe('schema', () => {
    it('accetta backup completo valido', () => {
      const result = inspectAuroraBackup(withChecksum(createCompleteBackup()))

      expect(result.valid).toBe(true)
      expect(result.recordCounts.transactions).toBe(2)
    })

    it('rifiuta date impossibili', () => {
      const backup = withChecksum(createCompleteBackup())
      backup.data.transactions[0].date = '2026-99-99'

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('SCHEMA_VALIDATION_ERROR')
    })

    it('rifiuta importi non validi', () => {
      const backup = createCompleteBackup()
      backup.data.transactions[0].amount = Number.NaN

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('SCHEMA_VALIDATION_ERROR')
    })

    it('rifiuta enum non riconosciuti', () => {
      const backup = withChecksum(createCompleteBackup())
      backup.data.accounts[0].type = 'bank' as AuroraBackupV1['data']['accounts'][number]['type']

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('SCHEMA_VALIDATION_ERROR')
    })

    it('rifiuta campi obbligatori mancanti', () => {
      const backup = withChecksum(createCompleteBackup()) as unknown as { data: { accounts: Array<Record<string, unknown>> } }
      delete backup.data.accounts[0].id

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('SCHEMA_VALIDATION_ERROR')
    })
  })

  describe('immutabilita e normalizzazione', () => {
    it('la validazione non muta input', () => {
      const backup = withChecksum(createCompleteBackup())
      const before = JSON.stringify(backup)

      validateAuroraBackup(backup)

      expect(JSON.stringify(backup)).toBe(before)
    })

    it('la normalizzazione non muta input e ordina collezioni per ID', () => {
      const backup = withChecksum(createCompleteBackup())
      backup.data.accounts.reverse()
      const before = JSON.stringify(backup)

      const normalized = normalizeAuroraBackup(backup)

      expect(JSON.stringify(backup)).toBe(before)
      expect(normalized.data.accounts[0].id < normalized.data.accounts[1].id).toBe(true)
    })

    it('la canonicalizzazione non muta input', () => {
      const backup = withChecksum(createCompleteBackup())
      const before = JSON.stringify(backup)

      canonicalizeAuroraBackup(backup)

      expect(JSON.stringify(backup)).toBe(before)
    })
  })

  describe('record counts', () => {
    it('calcola conteggi corretti', () => {
      const counts = calculateRecordCounts(createCompleteBackup())

      expect(counts).toMatchObject({ accounts: 2, categories: 3, transactions: 2 })
    })

    it('rileva conteggi errati', () => {
      const backup = withChecksum(createCompleteBackup())
      backup.integrity.recordCounts.accounts = 99

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('RECORD_COUNT_MISMATCH')
    })

    it('rileva conteggi mancanti', () => {
      const backup = withChecksum(createCompleteBackup())
      delete backup.integrity.recordCounts.accounts

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('RECORD_COUNT_MISSING')
    })

    it('segnala conteggi aggiuntivi non riconosciuti come warning', () => {
      const backup = withChecksum(createCompleteBackup())
      ;(backup.integrity.recordCounts as Record<string, number>).unknown = 1
      backup.integrity.checksum = computeBackupChecksum(backup)

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(true)
      expect(codes(result)).toContain('UNKNOWN_RECORD_COUNT')
    })
  })

  describe('checksum e canonicalizzazione', () => {
    it('stesso contenuto logico produce stesso checksum anche con ordine chiavi diverso', () => {
      const a = createCompleteBackup()
      const b = cloneBackup(a)
      b.data.accounts = [...b.data.accounts].reverse()

      expect(computeBackupChecksum(a)).toBe(computeBackupChecksum(b))
    })

    it('modifica record produce checksum diverso', () => {
      const a = createCompleteBackup()
      const b = cloneBackup(a)
      b.data.accounts[0].balance = 123

      expect(computeBackupChecksum(a)).not.toBe(computeBackupChecksum(b))
    })

    it('verifica checksum corretto', () => {
      const issues = verifyBackupChecksum(withChecksum(createCompleteBackup()))

      expect(issues).toHaveLength(1)
      expect(issues[0].code).toBe('CHECKSUM_VALID')
    })

    it('rileva checksum errato', () => {
      const backup = withChecksum(createCompleteBackup())
      backup.integrity.checksum = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'

      expect(verifyBackupChecksum(backup).map((item) => item.code)).toContain('CHECKSUM_MISMATCH')
    })

    it('rileva checksum assente', () => {
      const backup = createCompleteBackup()

      expect(verifyBackupChecksum(backup).map((item) => item.code)).toContain('CHECKSUM_MISSING')
    })

    it('rileva formato checksum non valido', () => {
      const backup = createCompleteBackup()
      backup.integrity.checksum = 'not-a-checksum'

      expect(verifyBackupChecksum(backup).map((item) => item.code)).toContain('CHECKSUM_FORMAT_INVALID')
    })
  })

  describe('duplicati', () => {
    it('non segnala duplicati su backup valido', () => {
      expect(detectBackupDuplicates(createCompleteBackup()).filter((item) => item.severity === 'error')).toEqual([])
    })

    it('segnala duplicato identico come warning', () => {
      const backup = createCompleteBackup()
      backup.data.accounts.push(cloneBackup(backup.data.accounts[0]))

      const issues = detectBackupDuplicates(backup)

      expect(issues.map((item) => item.code)).toContain('DUPLICATE_ID_IDENTICAL')
    })

    it('segnala collisione stesso ID con contenuto differente come errore', () => {
      const backup = createCompleteBackup()
      backup.data.accounts.push({ ...cloneBackup(backup.data.accounts[0]), name: 'Altro nome' })

      const issues = detectBackupDuplicates(backup)

      expect(issues.map((item) => item.code)).toContain('DUPLICATE_ID_CONFLICT')
    })

    it('gestisce stessi ID in collezioni diverse senza collisione globale', () => {
      const backup = createCompleteBackup()
      backup.data.categories[0].id = backup.data.accounts[0].id

      const issues = detectBackupDuplicates(backup)

      expect(issues.map((item) => item.code)).not.toContain('DUPLICATE_ID_CONFLICT')
    })

    it('segnala categorie duplicate per chiave logica', () => {
      const backup = createCompleteBackup()
      backup.data.categories.push({ ...cloneBackup(backup.data.categories[1]), id: '20000000-0000-4000-8000-000000000099' })

      const issues = detectBackupDuplicates(backup)

      expect(issues.map((item) => item.code)).toContain('DUPLICATE_CATEGORY_LOGICAL_KEY')
    })
  })

  describe('relazioni', () => {
    it('accetta relazioni valide', () => {
      const issues = validateBackupRelationships(createCompleteBackup())

      expect(issues.filter((item) => item.severity === 'error')).toEqual([])
    })

    it('rileva account transazione mancante', () => {
      const backup = createCompleteBackup()
      backup.data.transactions[0].account_id = '10000000-0000-4000-8000-000000000099'

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('TRANSACTION_ACCOUNT_MISSING')
    })

    it('rileva categoria transazione mancante', () => {
      const backup = createCompleteBackup()
      backup.data.transactions[0].category_id = '20000000-0000-4000-8000-000000000099'

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('TRANSACTION_CATEGORY_MISSING')
    })

    it('rileva categoria padre mancante', () => {
      const backup = createCompleteBackup()
      backup.data.categories[2].parent_id = '20000000-0000-4000-8000-000000000099'

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('CATEGORY_PARENT_MISSING')
    })

    it('rileva ciclo tra categorie', () => {
      const backup = createCompleteBackup()
      backup.data.categories[1].parent_id = ids.categoryChild

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('CATEGORY_CYCLE')
    })

    it('rileva transfer orfano', () => {
      const backup = createCompleteBackup()
      backup.data.transactions[1].transfer_peer_id = '30000000-0000-4000-8000-000000000099'

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('TRANSFER_PEER_MISSING')
    })

    it('rileva peer transfer legacy non reciproco', () => {
      const backup = createCompleteBackup()
      backup.data.transactions[1].transfer_peer_id = ids.transaction

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('TRANSFER_PEER_INCOHERENT')
    })

    it('rileva budget con categoria mancante', () => {
      const backup = createCompleteBackup()
      backup.data.budgets[0].category_id = '20000000-0000-4000-8000-000000000099'

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('BUDGET_CATEGORY_MISSING')
    })

    it('rileva ricorrenza con conto mancante', () => {
      const backup = createCompleteBackup()
      backup.data.recurringRules[0].account_id = '10000000-0000-4000-8000-000000000099'

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('RECURRING_ACCOUNT_MISSING')
    })

    it('rileva pagamento prestito orfano', () => {
      const backup = createCompleteBackup()
      backup.data.loanPayments[0].loan_id = '60000000-0000-4000-8000-000000000099'

      expect(codesFromIssues(validateBackupRelationships(backup))).toContain('LOAN_PAYMENT_LOAN_MISSING')
    })
  })

  describe('sicurezza e orchestratore', () => {
    it('user_id viene segnalato come non attendibile ma non invalida il backup', () => {
      const result = inspectAuroraBackup(withChecksum(createMinimalBackup()))

      expect(result.valid).toBe(true)
      expect(codes(result)).toContain('UNTRUSTED_USER_ID')
    })

    it('chiavi pericolose vengono rifiutate senza crash', () => {
      const input = JSON.parse('{"format":"aurora-backup","schemaVersion":1,"__proto__":{"polluted":true}}') as unknown

      const result = inspectAuroraBackup(input)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('DANGEROUS_KEY')
    })

    it('input oltre limite record viene segnalato come errore schema', () => {
      const backup = createMinimalBackup()
      backup.data.accounts = Array.from({ length: 100_001 }, (_, index) => ({
        ...backup.data.accounts[0],
        id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      }))

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('SCHEMA_VALIDATION_ERROR')
    })

    it('inspect restituisce risultato completo per backup valido', () => {
      const result = inspectAuroraBackup(withChecksum(createCompleteBackup()))

      expect(result.valid).toBe(true)
      expect(result.backup).not.toBeNull()
      expect(result.normalizedBackup).not.toBeNull()
      expect(result.checksum).toMatch(/^sha256:/)
      expect(result.summary.errorCount).toBe(0)
    })

    it('warning non rende automaticamente invalido il backup', () => {
      const backup = withChecksum(createCompleteBackup())
      ;(backup.integrity.recordCounts as Record<string, number>).unknown = 1
      backup.integrity.checksum = computeBackupChecksum(backup)

      const result = inspectAuroraBackup(backup)

      expect(result.valid).toBe(true)
      expect(result.summary.warningCount).toBeGreaterThan(0)
    })

    it('valid false quando ci sono errori', () => {
      const result = inspectAuroraBackup(createCompleteBackup())

      expect(result.valid).toBe(false)
      expect(codes(result)).toContain('CHECKSUM_MISSING')
    })
  })
})

function withChecksum(backup: AuroraBackupV1): AuroraBackupV1 {
  const copy = cloneBackup(backup)
  copy.integrity.checksum = computeBackupChecksum(copy)
  return copy
}

function codes(result: { issues: Array<{ code: string }> }): string[] {
  return result.issues.map((item) => item.code)
}

function codesFromIssues(issues: Array<{ code: string }>): string[] {
  return issues.map((item) => item.code)
}
