import { describe, expect, it } from 'vitest'

import {
  buildIdMapping,
  buildRestorePlan,
  checkAccountEmpty,
  computeBackupChecksum,
  detectRestoreCollisions,
  runRestoreDryRun,
  summarizeDryRunForLog,
  validateRestoreTransfers,
  type CurrentUserDataSnapshot,
  type AuroraBackupV1,
} from '@/lib/backup'
import { cloneBackup, createCompleteBackup, createMinimalBackup, ids } from '../../fixtures/backup/backup-fixtures'

describe('Aurora Backup restore dry-run core', () => {
  it('considera vuoto un account con solo profilo tecnico e audit log', () => {
    const result = checkAccountEmpty({ ...emptySnapshot(), profileExists: true, auditLogs: [{ id: ids.audit }] })

    expect(result.isEmpty).toBe(true)
    expect(result.ignoredCollections).toContain('profile')
    expect(result.ignoredCollections).toContain('auditLogs')
  })

  it('blocca account con conto, categoria utente o transazione', () => {
    const result = checkAccountEmpty({
      ...emptySnapshot(),
      accounts: [{ id: ids.account }],
      categories: [{ id: ids.categoryExpense, name: 'Casa', is_default: false }],
      transactions: [{ id: ids.transaction }],
    })

    expect(result.isEmpty).toBe(false)
    expect(result.blockingCollections).toEqual(['accounts', 'categories', 'transactions'])
  })

  it('ignora categorie default automatiche nella definizione di vuoto', () => {
    const result = checkAccountEmpty({
      ...emptySnapshot(),
      categories: [{ id: ids.categoryExpense, name: 'Casa', is_default: true }],
    })

    expect(result.isEmpty).toBe(true)
    expect(result.ignoredCollections).toContain('defaultCategories')
  })

  it('propone preservazione ID su snapshot vuoto senza mutare il backup', () => {
    const backup = withChecksum(createCompleteBackup())
    const before = JSON.stringify(backup)

    const mapping = buildIdMapping(backup, emptySnapshot())

    expect(JSON.stringify(backup)).toBe(before)
    expect(mapping.every((item) => item.strategy === 'preserve')).toBe(true)
    expect(mapping[0].oldId).toBe(mapping[0].proposedId)
  })

  it('marca mapping bloccato quando uno UUID collide con snapshot corrente', () => {
    const mapping = buildIdMapping(withChecksum(createMinimalBackup()), {
      ...emptySnapshot(),
      accounts: [{ id: ids.account }],
    })

    expect(mapping.find((item) => item.oldId === ids.account)?.strategy).toBe('blocked')
  })

  it('rileva collisione UUID e duplicato logico conto', () => {
    const result = detectRestoreCollisions(withChecksum(createMinimalBackup()), {
      ...emptySnapshot(),
      accounts: [{ id: ids.account, name: 'Conto demo', type: 'checking' }],
    })

    expect(result.collisions).toHaveLength(1)
    expect(result.logicalDuplicates).toHaveLength(1)
  })

  it('genera piano deterministico con conti prima dei movimenti e prestiti prima pagamenti', () => {
    const plan = buildRestorePlan(withChecksum(createCompleteBackup())).steps

    expect(plan.find((step) => step.collection === 'accounts')?.sequence).toBeLessThan(
      plan.find((step) => step.collection === 'normalTransactions')?.sequence ?? 99,
    )
    expect(plan.find((step) => step.collection === 'loans')?.sequence).toBeLessThan(
      plan.find((step) => step.collection === 'loanPayments')?.sequence ?? 99,
    )
  })

  it('calcola ready_with_warnings per backup valido con soli warning recuperabili', () => {
    const backup = withChecksum(createCompleteBackup())
    const result = runRestoreDryRun({
      backup,
      inspectionIssues: [
        { code: 'CHECKSUM_VALID', severity: 'info', path: ['integrity', 'checksum'], message: 'ok' },
        { code: 'APP_VERSION_OLD', severity: 'warning', path: ['appVersion'], message: 'Versione vecchia' },
      ],
      snapshot: emptySnapshot(),
    })

    expect(result.readiness).toBe('ready_with_warnings')
    expect(result.accountingPreview.totalIncome).toBe(1000)
    expect(result.accountingPreview.totalExpense).toBe(0)
    expect(result.accountingPreview.totalNetWorth).toBe(1500)
    expect(result.summary.backupRecords).toBeGreaterThan(0)
  })

  it('calcola ready quando non ci sono warning o errori', () => {
    const backup = withChecksum(createMinimalBackup())
    const result = runRestoreDryRun({
      backup,
      inspectionIssues: [],
      snapshot: emptySnapshot(),
    })

    expect(result.readiness).toBe('ready')
    expect(result.summary.creatableRecords).toBe(result.summary.backupRecords)
  })

  it('blocca dry-run per account non vuoto', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: { ...emptySnapshot(), accounts: [{ id: '99999999-9999-4999-8999-999999999999' }] },
    })

    expect(result.readiness).toBe('blocked')
    expect(result.issues.map((issue) => issue.code)).toContain('CURRENT_ACCOUNT_NOT_EMPTY')
  })

  it('blocca dry-run per relazione mancante', () => {
    const backup = withChecksum(createCompleteBackup())
    backup.data.transactions[0].account_id = '99999999-9999-4999-8999-999999999999'

    const result = runRestoreDryRun({ backup, inspectionIssues: [], snapshot: emptySnapshot() })

    expect(result.readiness).toBe('blocked')
    expect(result.missingReferences.length).toBeGreaterThan(0)
  })

  it('valida trasferimento one-row verso conto destinazione e conserva neutralita', () => {
    const result = validateRestoreTransfers(withChecksum(createCompleteBackup()))

    expect(result.total).toBe(1)
    expect(result.valid).toBe(1)
    expect(result.transfersNeutral).toBe(true)
  })

  it('blocca trasferimento orfano o ambiguo', () => {
    const backup = withChecksum(createCompleteBackup())
    backup.data.transactions[1].transfer_peer_id = '99999999-9999-4999-8999-999999999999'

    const result = validateRestoreTransfers(backup)

    expect(result.blocked).toBe(1)
    expect(result.issues.map((issue) => issue.code)).toContain('TRANSFER_PEER_ORPHAN')
  })

  it('rileva transfer legacy recuperabile come warning non mutante', () => {
    const backup = withChecksum(createCompleteBackup())
    backup.data.transactions = [
      {
        ...backup.data.transactions[0],
        id: '30000000-0000-4000-8000-000000000010',
        type: 'transfer',
        category_id: null,
        transfer_peer_id: '30000000-0000-4000-8000-000000000011',
        amount: 25,
      },
      {
        ...backup.data.transactions[0],
        id: '30000000-0000-4000-8000-000000000011',
        type: 'transfer',
        account_id: ids.account2,
        category_id: null,
        transfer_peer_id: '30000000-0000-4000-8000-000000000010',
        amount: 25,
      },
    ]

    const result = validateRestoreTransfers(backup)

    expect(result.legacyRecoverable).toBe(1)
    expect(result.issues.map((issue) => issue.code)).toContain('TRANSFER_LEGACY_RECOVERABLE')
  })

  // --- riconciliazione categorie predefinite ---

  it('account con categorie default equivalenti al backup produce readiness ready', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.readiness).toBe('ready')
  })

  it('categoria default equivalente non appare come duplicato bloccante', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.logicalDuplicates.filter((d) => d.blocking)).toHaveLength(0)
    expect(result.issues.filter((i) => i.code === 'RESTORE_LOGICAL_DUPLICATE' && i.severity === 'error')).toHaveLength(0)
  })

  it('categoria default equivalente appare in reconciledDefaultCategories e nel conteggio', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.reconciledDefaultCategories).toHaveLength(1)
    expect(result.reconciledDefaultCategories[0].backupCategoryId).toBe(ids.categoryIncome)
    expect(result.summary.reconciledCategories).toBe(1)
  })

  it('sottocategoria del backup usa parent_id del backup senza generare missing references', () => {
    // createCompleteBackup: Stipendio (default parent), Casa (non-default parent), Affitto (child di Casa)
    // Snapshot: Stipendio come default → riconciliata; Casa e Affitto sono nuove
    const result = runRestoreDryRun({
      backup: withChecksum(createCompleteBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.readiness).toBe('ready')
    expect(result.missingReferences).toHaveLength(0)
    // Affitto (child di Casa) non genera missing reference perché Casa è nel backup
    expect(result.reconciledDefaultCategories).toHaveLength(1)
  })

  it('id mapping marca come preserve le categorie default riconciliate, non blocked', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          // stessa UUID del backup → sarebbe blocked senza la fix
          { id: ids.categoryIncome, name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.readiness).toBe('ready')
    const mapping = result.idMapping.find((m) => m.oldId === ids.categoryIncome)
    expect(mapping?.strategy).toBe('preserve')
  })

  it('categoria utente duplicata (non default) resta bloccante', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createCompleteBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000099', name: 'Casa', type: 'expense', parent_id: null, is_default: false },
        ],
      },
    })
    expect(result.readiness).toBe('blocked')
    expect(result.issues.some((i) => i.code === 'RESTORE_LOGICAL_DUPLICATE' && i.severity === 'error')).toBe(true)
  })

  it('due categorie del backup che puntano allo stesso default genera blocked per ambiguita', () => {
    // Creo un backup con due categorie aventi la stessa chiave (Stipendio income)
    const backup = withChecksum(createMinimalBackup())
    backup.data.categories.push({
      id: 'ee000000-0000-4000-8000-000000000001',
      user_id: ids.user,
      name: 'Stipendio',
      type: 'income',
      parent_id: null,
      is_default: true,
      sort_order: 99,
    })
    backup.integrity.recordCounts.categories = 2

    const result = runRestoreDryRun({
      backup,
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.readiness).toBe('blocked')
    expect(result.issues.some((i) => i.severity === 'error' && i.message.toLowerCase().includes('ambiguit'))).toBe(true)
  })

  it('stesso nome ma tipo diverso rispetto a default esistente genera blocked', () => {
    // Backup ha Stipendio expense, snapshot default ha Stipendio income → conflict
    const backup = withChecksum(createMinimalBackup())
    backup.data.categories[0] = { ...backup.data.categories[0], type: 'expense' }

    const result = runRestoreDryRun({
      backup,
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.readiness).toBe('blocked')
    expect(result.issues.some((i) => i.severity === 'error' && i.message.toLowerCase().includes('tipo'))).toBe(true)
  })

  it('categoria default snapshot senza equivalente nel backup non blocca il ripristino', () => {
    // Snapshot ha Extra income (default) che non esiste nel backup → viene eliminata dalla RPC, nessun errore
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
          { id: 'dd000000-0000-4000-8000-000000000002', name: 'Extra', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.readiness).toBe('ready')
    // Solo Stipendio è riconciliata; Extra è ignorata (verrà eliminata dalla RPC)
    expect(result.reconciledDefaultCategories).toHaveLength(1)
  })

  it('FK non rimappabile (categoria transazione mancante nel backup) resta bloccante', () => {
    const backup = withChecksum(createCompleteBackup())
    backup.data.transactions[0].category_id = '99999999-9999-4999-8999-999999999999'

    const result = runRestoreDryRun({ backup, inspectionIssues: [], snapshot: emptySnapshot() })

    expect(result.readiness).toBe('blocked')
    expect(result.missingReferences.length).toBeGreaterThan(0)
  })

  it('conteggi summary corretti con categorie riconciliate', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    expect(result.summary.reconciledCategories).toBe(1)
    expect(result.summary.duplicates).toBe(0)
    expect(result.summary.blockingErrors).toBe(0)
    // creatableRecords = tutti i record del backup (anche quelli riconciliati vengono inseriti dalla RPC)
    expect(result.summary.creatableRecords).toBe(result.summary.backupRecords)
  })

  it('summarizeDryRunForLog include reconciledCategories', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [
          { id: 'dd000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: true },
        ],
      },
    })
    const log = summarizeDryRunForLog(result)
    expect(log.reconciledCategories).toBe(1)
    expect(log.blockingErrors).toBe(0)
  })

  // --- dettaglio issues, alias collection, log safety ---

  it('popola arrays issues e logicalDuplicates quando rileva duplicato categoria', () => {
    // snapshot ha categoria con stesso nome/tipo ma UUID diverso (is_default:true → account vuoto)
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [{ id: 'ff000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: false }],
      },
    })

    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.logicalDuplicates.length).toBeGreaterThan(0)
    expect(result.issues.some((i) => i.code === 'RESTORE_LOGICAL_DUPLICATE')).toBe(true)
  })

  it('il contatore blockingErrors corrisponde agli issues con severity error', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [{ id: 'ff000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: false }],
      },
    })

    const countedErrors = result.issues.filter((i) => i.severity === 'error').length
    expect(result.summary.blockingErrors).toBe(countedErrors)
  })

  it('parentCategories e childCategories mostrano blocked quando categories ha duplicati logici', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [{ id: 'ff000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: false }],
      },
    })

    const parentStep = result.restorePlan.find((s) => s.collection === 'parentCategories')
    const childStep = result.restorePlan.find((s) => s.collection === 'childCategories')
    expect(parentStep?.status).toBe('blocked')
    expect(childStep?.status).toBe('blocked')
  })

  it('normalTransactions mostra blocked per relazione mancante su transazione normale', () => {
    const backup = withChecksum(createCompleteBackup())
    backup.data.transactions[0].account_id = '99999999-9999-4999-8999-999999999999'

    const result = runRestoreDryRun({ backup, inspectionIssues: [], snapshot: emptySnapshot() })

    const step = result.restorePlan.find((s) => s.collection === 'normalTransactions')
    expect(step?.status).toBe('blocked')
  })

  it('creatableRecords è sempre 0 quando readiness è blocked', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [{ id: 'ff000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: false }],
      },
    })

    expect(result.readiness).toBe('blocked')
    expect(result.summary.creatableRecords).toBe(0)
  })

  it('summarizeDryRunForLog include errorCodes e sectionsWithErrors senza dati sensibili', () => {
    const result = runRestoreDryRun({
      backup: withChecksum(createMinimalBackup()),
      inspectionIssues: [],
      snapshot: {
        ...emptySnapshot(),
        categories: [{ id: 'ff000000-0000-4000-8000-000000000001', name: 'Stipendio', type: 'income', parent_id: null, is_default: false }],
      },
    })

    const log = summarizeDryRunForLog(result)
    expect(log.errorCodes).toContain('RESTORE_LOGICAL_DUPLICATE')
    expect(log.sectionsWithErrors.some((s) => s.startsWith('parentCategories'))).toBe(true)
    expect(log).not.toHaveProperty('userId')
    expect(log).not.toHaveProperty('backup')
    expect(log).not.toHaveProperty('idMapping')
  })
})

function withChecksum(backup: AuroraBackupV1): AuroraBackupV1 {
  const copy = cloneBackup(backup)
  copy.integrity.checksum = computeBackupChecksum(copy)
  return copy
}

function emptySnapshot(): CurrentUserDataSnapshot {
  return {
    profileExists: false,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
    loans: [],
    loanPayments: [],
    birthdays: [],
    birthdayReminderLog: [],
    auditLogs: [],
  }
}
