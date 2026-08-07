import { DATA_INTEGRITY_CENT_TOLERANCE, DATA_INTEGRITY_MAX_ISSUES_PER_SCAN, DATA_INTEGRITY_RULESET_VERSION, DATA_INTEGRITY_SEVERITY_PRIORITY, DATA_INTEGRITY_STATUS_PRIORITY } from './constants'
import { cents, createDataIntegrityFingerprint, normalizeEntityIds, normalizeText } from './fingerprint'
import { DATA_INTEGRITY_RULE_BY_CODE } from './registry'
import type { DataIntegrityInput, DataIntegrityIssue, DataIntegrityIssueDraft, DataIntegrityScanMode, DataIntegrityScanResult, DataIntegritySummary } from './types'

type Context = {
  accountIds: Set<string>
  categoryIds: Set<string>
  recurringIds: Set<string>
  transactionIds: Set<string>
  adiTransactionIds: Set<string>
  goalIds: Set<string>
  loanIds: Set<string>
  accountById: Map<string, DataIntegrityInput['accounts'][number]>
  accountScopeById: Map<string, string>
  categoryById: Map<string, DataIntegrityInput['categories'][number]>
  transactionById: Map<string, DataIntegrityInput['transactions'][number]>
  nowDate: string
}

export function scanDataIntegrity(input: DataIntegrityInput, mode: DataIntegrityScanMode = 'quick'): DataIntegrityScanResult {
  const context = buildContext(input)
  const drafts: DataIntegrityIssueDraft[] = []
  const add = (draft: DataIntegrityIssueDraft) => {
    if (drafts.length < DATA_INTEGRITY_MAX_ISSUES_PER_SCAN) drafts.push(draft)
  }

  scanTransactions(input, context, add)
  scanTransfers(input, context, add)
  scanAccounts(input, context, add)
  scanRecurring(input, context, add)
  scanLoans(input, context, add)
  scanBudgets(input, context, add)
  scanGoals(input, context, add)
  scanCategories(input, context, add)
  scanFinancialHealthSnapshots(input, add)
  scanNotifications(input, context, add)
  scanTemporal(input, add)

  const issues = drafts.map((draft) => materializeIssue(input.userId, draft))
  return {
    rulesetVersion: DATA_INTEGRITY_RULESET_VERSION,
    scannedAt: input.now,
    mode,
    issues: sortIssues(issues),
    summary: summarizeIssues(issues),
  }
}

export function summarizeIssues(issues: Pick<DataIntegrityIssue, 'severity' | 'status'>[]): DataIntegritySummary {
  const active = issues.filter((issue) => issue.status === 'open' || issue.status === 'acknowledged')
  const critical = active.filter((issue) => issue.severity === 'CRITICAL').length
  const warning = active.filter((issue) => issue.severity === 'WARNING').length
  const info = active.filter((issue) => issue.severity === 'INFO').length
  return {
    total: issues.length,
    open: issues.filter((issue) => issue.status === 'open').length,
    acknowledged: issues.filter((issue) => issue.status === 'acknowledged').length,
    ignored: issues.filter((issue) => issue.status === 'ignored').length,
    resolved: issues.filter((issue) => issue.status === 'resolved').length,
    stale: issues.filter((issue) => issue.status === 'stale').length,
    critical,
    warning,
    info,
    statusLabel: issues.length === 0 ? 'Nessun dato' : critical > 0 ? 'Attenzione urgente' : warning > 0 ? 'Da controllare' : 'Buono',
  }
}

export function sortIssues<T extends Pick<DataIntegrityIssue, 'severity' | 'status' | 'lastDetectedAt'>>(issues: T[]): T[] {
  return [...issues].sort((a, b) =>
    DATA_INTEGRITY_STATUS_PRIORITY[b.status] - DATA_INTEGRITY_STATUS_PRIORITY[a.status] ||
    DATA_INTEGRITY_SEVERITY_PRIORITY[b.severity] - DATA_INTEGRITY_SEVERITY_PRIORITY[a.severity] ||
    String(b.lastDetectedAt ?? '').localeCompare(String(a.lastDetectedAt ?? '')),
  )
}

function buildContext(input: DataIntegrityInput): Context {
  return {
    accountIds: new Set(input.accounts.map((item) => item.id)),
    categoryIds: new Set(input.categories.map((item) => item.id)),
    recurringIds: new Set(input.recurringRules.map((item) => item.id)),
    transactionIds: new Set(input.transactions.map((item) => item.id)),
    adiTransactionIds: new Set((input.adiEntries ?? []).map((item) => item.transaction_id).filter((id): id is string => Boolean(id))),
    goalIds: new Set(input.goals.map((item) => item.id)),
    loanIds: new Set(input.loans.map((item) => item.id)),
    accountById: new Map(input.accounts.map((item) => [item.id, item])),
    accountScopeById: buildAccountScopeById(input),
    categoryById: new Map(input.categories.map((item) => [item.id, item])),
    transactionById: new Map(input.transactions.map((item) => [item.id, item])),
    nowDate: input.now.slice(0, 10),
  }
}

function buildAccountScopeById(input: DataIntegrityInput): Map<string, string> {
  const scopes = new Map(input.accounts.map((account) => [account.id, 'PERSONAL']))
  for (const link of input.accountPurposeLinks ?? []) {
    scopes.set(link.account_id, link.purpose === 'DEPENDENT' ? 'AURORA' : 'PERSONAL')
  }
  return scopes
}

function materializeIssue(userId: string, draft: DataIntegrityIssueDraft): DataIntegrityIssue {
  const rule = DATA_INTEGRITY_RULE_BY_CODE.get(draft.ruleCode)
  if (!rule) throw new Error(`Unknown data integrity rule: ${draft.ruleCode}`)
  const entityIds = normalizeEntityIds(draft.entityIds)
  const fingerprint = createDataIntegrityFingerprint({
    userId,
    ruleCode: draft.ruleCode,
    entityType: draft.entityType,
    entityIds,
  })
  return {
    userId,
    fingerprint,
    rulesetVersion: DATA_INTEGRITY_RULESET_VERSION,
    ruleCode: draft.ruleCode,
    category: rule.category,
    severity: draft.severity ?? rule.defaultSeverity,
    status: draft.status ?? 'open',
    title: draft.title ?? rule.title,
    description: draft.description ?? rule.description,
    explanation: draft.explanation,
    impact: draft.impact,
    recommendation: draft.recommendation,
    confidence: draft.confidence ?? 'medium',
    entityType: draft.entityType,
    entityIds,
    evidence: draft.evidence,
    allowedActions: rule.allowedActions,
    sourcePath: draft.sourcePath,
  }
}

function groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFor(item)
    map.set(key, [...(map.get(key) ?? []), item])
  }
  return map
}

function isDate(value: string | null | undefined) {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(new Date(value).getTime())
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to.slice(0, 10)}T00:00:00`).getTime() - new Date(`${from.slice(0, 10)}T00:00:00`).getTime()) / 86400000)
}

function stableReceiptValue(receiptData: Record<string, unknown> | null, keys: string[]): string {
  if (!receiptData) return ''
  for (const key of keys) {
    const value = receiptData[key]
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = normalizeText(String(value))
      if (normalized) return normalized
    }
  }
  return ''
}

function transactionScope(tx: DataIntegrityInput['transactions'][number], context: Context): string {
  if (context.adiTransactionIds.has(tx.id)) return 'ADI'
  return context.accountScopeById.get(tx.account_id) ?? 'PERSONAL'
}

function transactionSourceFingerprint(tx: DataIntegrityInput['transactions'][number]): string {
  return stableReceiptValue(tx.receipt_data, [
    'external_transaction_id',
    'externalTransactionId',
    'transaction_id',
    'transactionId',
    'import_fingerprint',
    'importFingerprint',
    'source_id',
    'sourceId',
    'fingerprint',
    'idempotency_key',
  ])
}

function duplicateIdentityKey(tx: DataIntegrityInput['transactions'][number], context: Context, includeCategory: boolean): string {
  const parts = [
    transactionScope(tx, context),
    tx.account_id,
    tx.type,
    cents(Number(tx.amount)),
    tx.date,
    normalizeText(tx.description),
    transactionSourceFingerprint(tx) || 'no-source',
  ]
  if (includeCategory) parts.push(tx.category_id ?? 'none')
  return parts.join('|')
}

function isOrdinaryTransaction(tx: DataIntegrityInput['transactions'][number]): boolean {
  return tx.type !== 'transfer' && !tx.transfer_peer_id
}

function scanTransactions(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  const normalTransactions = input.transactions.filter(isOrdinaryTransaction)
  const duplicateCandidates = normalTransactions.filter((tx) => !tx.recurring_id)
  for (const tx of input.transactions) {
    if (!context.accountIds.has(tx.account_id)) add(issue('TRANSACTION_ORPHAN_ACCOUNT', 'transaction', [tx.id], 'Il movimento punta a un conto non trovato.', 'Il saldo del conto e i report potrebbero essere incompleti.', 'Apri il movimento e assegna un conto valido.', [{ label: 'Conto', value: tx.account_id, kind: 'entity' }], `/transactions?id=${tx.id}`))
    if (tx.category_id && !context.categoryIds.has(tx.category_id)) add(issue('TRANSACTION_ORPHAN_CATEGORY', 'transaction', [tx.id, tx.category_id], 'Il movimento usa una categoria non presente.', 'Report, budget e classificazioni potrebbero non essere affidabili.', 'Riassegna una categoria esistente.', [{ label: 'Categoria', value: tx.category_id, kind: 'entity' }], `/transactions?id=${tx.id}`))
    if (tx.recurring_id && !context.recurringIds.has(tx.recurring_id)) add(issue('TRANSACTION_ORPHAN_RECURRING', 'transaction', [tx.id, tx.recurring_id], 'Il movimento punta a una ricorrenza non presente.', 'La ricorrenza potrebbe non essere piu tracciabile.', 'Verifica il movimento o scollega la ricorrenza se non esiste piu.', [{ label: 'Ricorrenza', value: tx.recurring_id, kind: 'entity' }], `/transactions?id=${tx.id}`))
    if (!Number.isFinite(Number(tx.amount)) || Number(tx.amount) <= 0) add(issue('TRANSACTION_INVALID_AMOUNT', 'transaction', [tx.id], 'Il movimento ha un importo non valido.', 'Un importo non valido puo alterare saldi e report.', 'Correggi l importo tramite il flusso movimento.', [{ label: 'Importo', value: Number(tx.amount), kind: 'money' }], `/transactions?id=${tx.id}`))
    if (isOrdinaryTransaction(tx) && !tx.category_id) add(issue('TRANSACTION_MISSING_CATEGORY', 'transaction', [tx.id], 'Il movimento non ha una categoria.', 'Budget e report per categoria saranno meno precisi.', 'Assegna una categoria coerente.', [{ label: 'Descrizione', value: tx.description ?? '', kind: 'text' }], `/transactions?id=${tx.id}`))
    if (isDate(tx.date) && daysBetween(context.nowDate, tx.date) > 365) add(issue('TRANSACTION_FUTURE_ANOMALY', 'transaction', [tx.id], 'Il movimento e molto lontano nel futuro.', 'Potrebbe trattarsi di un errore di data o di una previsione inserita come movimento reale.', 'Verifica la data del movimento.', [{ label: 'Data', value: tx.date, kind: 'date' }], `/transactions?id=${tx.id}`))
  }

  for (const rows of groupBy(duplicateCandidates, (tx) => duplicateIdentityKey(tx, context, true)).values()) {
    if (rows.length <= 1) continue
    add(issue('TRANSACTION_EXACT_DUPLICATE', 'transaction', rows.map((tx) => tx.id), 'Movimenti duplicati probabili rilevati.', 'Il saldo potrebbe essere duplicato se una delle righe e stata inserita due volte.', 'Confronta i movimenti ed elimina l eventuale duplicato tramite il flusso esistente.', [
      { label: 'Movimenti', value: rows.length, kind: 'count' },
      { label: 'Importo', value: rows[0].amount, kind: 'money' },
      { label: 'Data', value: rows[0].date, kind: 'date' },
      { label: 'Perimetro', value: transactionScope(rows[0], context), kind: 'text' },
    ], '/transactions'))
  }

  for (const rows of groupBy(duplicateCandidates, (tx) => duplicateIdentityKey(tx, context, false)).values()) {
    const ids = new Set(rows.map((tx) => tx.category_id ?? 'none'))
    if (rows.length > 1 && ids.size > 1) add(issue('TRANSACTION_POSSIBLE_DUPLICATE', 'transaction', rows.map((tx) => tx.id), 'Movimenti molto simili rilevati.', 'Potrebbe esserci un duplicato, ma la categoria differente richiede verifica manuale.', 'Apri i movimenti e conferma se sono operazioni distinte.', [
      { label: 'Movimenti simili', value: rows.length, kind: 'count' },
      { label: 'Descrizione', value: rows[0].description ?? '', kind: 'text' },
    ], '/transactions'))
  }
}

function scanTransfers(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  for (const tx of input.transactions.filter((row) => row.type === 'transfer')) {
    if (!tx.transfer_peer_id) {
      add(issue('TRANSFER_MISSING_COUNTERPART', 'transfer', [tx.id], 'Il giroconto non ha destinazione.', 'Il saldo del conto origine potrebbe essere stato movimentato senza accredito coerente.', 'Ricrea o riallinea il giroconto con preview atomica.', [], `/transactions?id=${tx.id}`))
      continue
    }
    if (context.accountIds.has(tx.transfer_peer_id)) {
      if (tx.transfer_peer_id === tx.account_id) add(issue('TRANSFER_SAME_ACCOUNT', 'transfer', [tx.id, tx.account_id], 'Origine e destinazione coincidono.', 'Il giroconto non sposta denaro tra conti distinti.', 'Seleziona una destinazione diversa con preview.', [], `/transactions?id=${tx.id}`))
      continue
    }
    const peer = context.transactionById.get(tx.transfer_peer_id)
    if (!peer) {
      add(issue('TRANSFER_LEGACY_PEER_ORPHAN', 'transfer', [tx.id, tx.transfer_peer_id], 'La controparte legacy non esiste.', 'Un lato del giroconto potrebbe essere stato eliminato o importato male.', 'Verifica il giroconto e ricrea la controparte solo dopo preview.', [], `/transactions?id=${tx.id}`))
      continue
    }
    if (peer.transfer_peer_id !== tx.id) add(issue('TRANSFER_LEGACY_PEER_INCOHERENT', 'transfer', [tx.id, peer.id], 'La relazione legacy non e reciproca.', 'La coppia potrebbe essere stata modificata solo da un lato.', 'Riallinea la coppia solo dopo preview.', [], `/transactions?id=${tx.id}`))
    if (cents(Number(peer.amount)) !== cents(Number(tx.amount))) add(issue('TRANSFER_LEGACY_AMOUNT_MISMATCH', 'transfer', [tx.id, peer.id], 'I due lati hanno importi diversi.', 'Il patrimonio complessivo potrebbe risultare alterato.', 'Riallinea gli importi solo dopo preview.', [
      { label: 'Importo origine', value: tx.amount, kind: 'money' },
      { label: 'Importo controparte', value: peer.amount, kind: 'money' },
    ], `/transactions?id=${tx.id}`))
  }
}

function scanAccounts(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  for (const account of input.accounts) {
    if (!Number.isFinite(Number(account.balance))) add(issue('ACCOUNT_BALANCE_NON_FINITE', 'account', [account.id], 'Il saldo memorizzato non e numerico.', 'Saldo, patrimonio e dashboard potrebbero non essere calcolabili.', 'Correggi il saldo del conto tramite il flusso conti.', [{ label: 'Conto', value: account.name, kind: 'text' }], `/accounts?account=${account.id}`))
    if (!account.is_active && input.transactions.some((tx) => tx.account_id === account.id && tx.date > context.nowDate)) add(issue('ACCOUNT_INACTIVE_WITH_FUTURE_TRANSACTIONS', 'account', [account.id], 'Il conto inattivo contiene movimenti futuri.', 'Le previsioni potrebbero includere un conto che non usi piu.', 'Verifica se il conto deve tornare attivo o se i movimenti vanno spostati.', [{ label: 'Conto', value: account.name, kind: 'text' }], `/accounts?account=${account.id}`))
  }
}

function scanRecurring(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  for (const rule of input.recurringRules) {
    if (!context.accountIds.has(rule.account_id)) add(issue('RECURRING_ORPHAN_ACCOUNT', 'recurring_rule', [rule.id, rule.account_id], 'La ricorrenza punta a un conto mancante.', 'Le istanze future non possono essere materializzate correttamente.', 'Apri la ricorrenza e seleziona un conto valido.', [], `/recurring?rule=${rule.id}`))
    if (rule.category_id && !context.categoryIds.has(rule.category_id)) add(issue('RECURRING_ORPHAN_CATEGORY', 'recurring_rule', [rule.id, rule.category_id], 'La ricorrenza punta a una categoria mancante.', 'Le istanze future potrebbero nascere senza classificazione corretta.', 'Aggiorna la categoria della ricorrenza.', [], `/recurring?rule=${rule.id}`))
    if ((rule.end_date && rule.end_date < rule.start_date) || (rule.end_date && rule.next_due_date > rule.end_date)) add(issue('RECURRING_INVALID_DATES', 'recurring_rule', [rule.id], 'Le date della ricorrenza sono incoerenti.', 'La materializzazione futura potrebbe essere errata.', 'Correggi inizio, fine o prossima data.', [
      { label: 'Inizio', value: rule.start_date, kind: 'date' },
      { label: 'Fine', value: rule.end_date, kind: 'date' },
      { label: 'Prossima', value: rule.next_due_date, kind: 'date' },
    ], `/recurring?rule=${rule.id}`))
    if (rule.is_active && !rule.next_due_date) add(issue('RECURRING_ACTIVE_WITHOUT_NEXT_DATE', 'recurring_rule', [rule.id], 'Ricorrenza attiva senza prossima data.', 'Aurora non sa quando generare la prossima istanza.', 'Ricalcola o imposta la prossima data con preview.', [], `/recurring?rule=${rule.id}`))
  }

  for (const rows of groupBy(input.transactions.filter((tx) => tx.recurring_id), (tx) => [tx.recurring_id, tx.account_id, tx.date, tx.type, cents(Number(tx.amount))].join('|')).values()) {
    if (rows.length > 1) add(issue('RECURRING_DUPLICATE_INSTANCE', 'transaction', rows.map((tx) => tx.id), 'Istanza ricorrente duplicata.', 'La stessa ricorrenza sembra aver generato piu movimenti uguali.', 'Confronta le istanze prima di eliminare eventuali duplicati.', [{ label: 'Istanze', value: rows.length, kind: 'count' }], '/transactions'))
  }
}

function scanLoans(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  for (const loan of input.loans) {
    if (loan.remaining < -DATA_INTEGRITY_CENT_TOLERANCE) add(issue('LOAN_REMAINING_NEGATIVE', 'loan', [loan.id], 'Il residuo prestito e negativo.', 'Il riepilogo prestiti puo risultare errato.', 'Verifica i pagamenti registrati e il residuo.', [{ label: 'Residuo', value: loan.remaining, kind: 'money' }], `/loans?loan=${loan.id}`))
    if (loan.remaining - loan.amount > DATA_INTEGRITY_CENT_TOLERANCE) add(issue('LOAN_REMAINING_EXCEEDS_AMOUNT', 'loan', [loan.id], 'Il residuo supera il capitale iniziale.', 'Il saldo netto prestiti potrebbe essere sovrastimato.', 'Verifica importo iniziale e pagamenti.', [], `/loans?loan=${loan.id}`))
    if (loan.is_settled && loan.remaining > DATA_INTEGRITY_CENT_TOLERANCE) add(issue('LOAN_SETTLED_WITH_REMAINING', 'loan', [loan.id], 'Prestito saldato con residuo positivo.', 'La sezione prestiti puo mostrare uno stato incoerente.', 'Riapri o riallinea il prestito dal flusso esistente.', [], `/loans?loan=${loan.id}`))
  }
  for (const rows of groupBy(input.loanPayments, (payment) => [payment.loan_id, cents(Number(payment.amount)), payment.paid_at.slice(0, 10)].join('|')).values()) {
    if (rows.length > 1) add(issue('LOAN_DUPLICATE_PAYMENT', 'loan_payment', rows.map((row) => row.id), 'Pagamenti prestito identici.', 'Il residuo del prestito potrebbe essere stato ridotto due volte.', 'Verifica i pagamenti prima di eliminare duplicati.', [{ label: 'Pagamenti', value: rows.length, kind: 'count' }], '/loans'))
  }
  for (const payment of input.loanPayments) {
    if (!context.loanIds.has(payment.loan_id)) add(issue('LOAN_DUPLICATE_PAYMENT', 'loan_payment', [payment.id, payment.loan_id], 'Pagamento collegato a prestito mancante.', 'Il pagamento non puo essere ricondotto a un prestito valido.', 'Verifica il pagamento e il prestito associato.', [], '/loans'))
  }
}

function scanBudgets(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  for (const budget of input.budgets) {
    if (!context.categoryIds.has(budget.category_id)) add(issue('BUDGET_ORPHAN_CATEGORY', 'budget', [budget.id, budget.category_id], 'Il budget punta a una categoria mancante.', 'Il confronto spese/budget potrebbe non funzionare.', 'Riassegna o ricrea il budget su una categoria esistente.', [], `/budgets/${budget.id}`))
    if (budget.amount <= 0) add(issue('BUDGET_INVALID_AMOUNT', 'budget', [budget.id], 'Il budget ha limite non positivo.', 'Il progresso budget non puo essere interpretato correttamente.', 'Imposta un importo maggiore di zero.', [{ label: 'Importo', value: budget.amount, kind: 'money' }], `/budgets/${budget.id}`))
    if (budget.month < 1 || budget.month > 12 || budget.year < 1900 || budget.year > 3000) add(issue('BUDGET_INVALID_PERIOD', 'budget', [budget.id], 'Il periodo budget non e valido.', 'Il budget potrebbe non comparire nella vista corretta.', 'Correggi mese e anno del budget.', [], `/budgets/${budget.id}`))
  }
  for (const rows of groupBy(input.budgets, (budget) => [budget.category_id, budget.month, budget.year].join('|')).values()) {
    if (rows.length > 1) add(issue('BUDGET_DUPLICATE_SCOPE', 'budget', rows.map((row) => row.id), 'Budget duplicati per stesso ambito.', 'La spesa potrebbe essere confrontata con limiti duplicati.', 'Mantieni un solo budget per categoria e mese se non desideri sovrapposizioni.', [{ label: 'Budget', value: rows.length, kind: 'count' }], '/budgets'))
  }
}

function scanGoals(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  for (const goal of input.goals) {
    if (goal.target_amount <= 0) add(issue('GOAL_INVALID_TARGET', 'goal', [goal.id], 'Target obiettivo non valido.', 'Il progresso non puo essere calcolato correttamente.', 'Imposta un target maggiore di zero.', [], `/goals/${goal.id}`))
    if (goal.current_amount < 0) add(issue('GOAL_CURRENT_NEGATIVE', 'goal', [goal.id], 'Accumulo obiettivo negativo.', 'Il riepilogo obiettivi puo essere incoerente.', 'Verifica i versamenti collegati.', [], `/goals/${goal.id}`))
    if (goal.status === 'COMPLETED' && goal.current_amount + DATA_INTEGRITY_CENT_TOLERANCE < goal.target_amount) add(issue('GOAL_COMPLETED_UNDER_TARGET', 'goal', [goal.id], 'Obiettivo completato sotto target.', 'Lo stato non rispecchia l avanzamento reale.', 'Lascia che il trigger di stato riallinei il valore o riapri l obiettivo.', [], `/goals/${goal.id}`))
    if (goal.status === 'ACTIVE' && goal.current_amount >= goal.target_amount && goal.target_amount > 0) add(issue('GOAL_REACHED_NOT_COMPLETED', 'goal', [goal.id], 'Obiettivo raggiunto ancora attivo.', 'La UI potrebbe non mostrare il completamento atteso.', 'Verifica lo stato dopo l ultimo versamento.', [], `/goals/${goal.id}`))
  }
  const contributionsByGoal = groupBy(input.goalContributions, (row) => row.goal_id)
  for (const goal of input.goals) {
    const sum = (contributionsByGoal.get(goal.id) ?? []).reduce((total, row) => total + Number(row.amount), 0)
    if (Math.abs(cents(sum) - cents(Number(goal.current_amount))) > 1) add(issue('GOAL_CONTRIBUTIONS_MISMATCH', 'goal', [goal.id], 'Versamenti e accumulato non coincidono.', 'Il current_amount dovrebbe riflettere la somma dei versamenti.', 'Verifica versamenti e trigger obiettivo.', [
      { label: 'Somma versamenti', value: sum, kind: 'money' },
      { label: 'Accumulo', value: goal.current_amount, kind: 'money' },
    ], `/goals/${goal.id}`))
  }
  for (const contribution of input.goalContributions) {
    if (!context.goalIds.has(contribution.goal_id)) add(issue('GOAL_CONTRIBUTIONS_MISMATCH', 'goal_contribution', [contribution.id, contribution.goal_id], 'Versamento collegato a obiettivo mancante.', 'Il versamento non puo aggiornare un obiettivo valido.', 'Verifica o elimina il versamento orfano.', [], '/goals'))
  }
  for (const rows of groupBy(input.goalContributions, (row) => [row.goal_id, row.date, cents(Number(row.amount)), normalizeText(row.note)].join('|')).values()) {
    if (rows.length > 1) add(issue('GOAL_DUPLICATE_CONTRIBUTION', 'goal_contribution', rows.map((row) => row.id), 'Versamenti obiettivo identici.', 'L accumulo dell obiettivo potrebbe essere gonfiato.', 'Controlla lo storico versamenti prima di eliminarne uno.', [], `/goals/${rows[0].goal_id}`))
  }
}

function scanCategories(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  for (const category of input.categories) {
    if (category.parent_id === category.id) add(issue('CATEGORY_PARENT_SELF', 'category', [category.id], 'La categoria usa se stessa come padre.', 'La gerarchia categorie puo generare cicli nella UI.', 'Rimuovi o modifica la categoria padre.', [], '/categories'))
    if (category.parent_id && !context.categoryIds.has(category.parent_id)) add(issue('CATEGORY_PARENT_MISSING', 'category', [category.id, category.parent_id], 'Categoria padre non trovata.', 'La sottocategoria potrebbe non comparire correttamente.', 'Scegli una categoria padre esistente o rendila radice.', [], '/categories'))
  }
  for (const rows of groupBy(input.categories, (category) => [category.type, category.parent_id ?? 'root', normalizeText(category.name)].join('|')).values()) {
    if (rows.length > 1) add(issue('CATEGORY_DUPLICATE_NAME', 'category', rows.map((row) => row.id), 'Categorie duplicate nello stesso livello.', 'La classificazione puo diventare ambigua.', 'Valuta un merge manuale con preview, senza modifiche automatiche.', [{ label: 'Categorie', value: rows.length, kind: 'count' }], '/categories'))
  }
  for (const tx of input.transactions.filter((row) => row.category_id && row.type !== 'transfer')) {
    const category = context.categoryById.get(tx.category_id!)
    if (!category) continue
    if ((tx.type === 'income' && category.type === 'expense') || (tx.type === 'expense' && category.type === 'income')) add(issue('CATEGORY_TYPE_MISMATCH', 'category', [tx.id, category.id], 'Categoria usata con tipo opposto.', 'Report per entrate/uscite potrebbero essere classificati male.', 'Riassegna una categoria dello stesso tipo del movimento.', [
      { label: 'Tipo movimento', value: tx.type, kind: 'text' },
      { label: 'Tipo categoria', value: category.type, kind: 'text' },
    ], `/transactions?id=${tx.id}`))
  }
}

function scanFinancialHealthSnapshots(input: DataIntegrityInput, add: (draft: DataIntegrityIssueDraft) => void) {
  for (const snapshot of input.financialHealthSnapshots) {
    if (snapshot.total_score != null && (snapshot.total_score < 0 || snapshot.total_score > 100)) add(issue('FINANCIAL_HEALTH_SNAPSHOT_SCORE_OUT_OF_RANGE', 'financial_health_snapshot', [snapshot.id], 'Lo score snapshot e fuori range.', 'Lo storico salute finanziaria puo essere distorto.', 'Rigenera lo snapshot con il motore ufficiale.', [{ label: 'Score', value: snapshot.total_score, kind: 'count' }], '/financial-health'))
    if (!snapshot.calculation_version) add(issue('FINANCIAL_HEALTH_SNAPSHOT_VERSION_MISSING', 'financial_health_snapshot', [snapshot.id], 'Lo snapshot non indica la versione di calcolo.', 'Non e possibile confrontare con sicurezza versioni future.', 'Rigenera lo snapshot con il motore ufficiale.', [], '/financial-health'))
    if (snapshot.period_key > input.now.slice(0, 7)) add(issue('FINANCIAL_HEALTH_SNAPSHOT_SCORE_OUT_OF_RANGE', 'financial_health_snapshot', [snapshot.id], 'Snapshot riferito a periodo futuro.', 'Lo storico potrebbe contenere una data errata.', 'Verifica periodo e rigenera se necessario.', [{ label: 'Periodo', value: snapshot.period_key, kind: 'date' }], '/financial-health'))
  }
  for (const rows of groupBy(input.financialHealthSnapshots, (snapshot) => [snapshot.period_key, snapshot.calculation_version].join('|')).values()) {
    if (rows.length > 1) add(issue('FINANCIAL_HEALTH_SNAPSHOT_DUPLICATE', 'financial_health_snapshot', rows.map((row) => row.id), 'Snapshot duplicati per periodo e versione.', 'Lo storico potrebbe mostrare punti ridondanti.', 'Mantieni lo snapshot piu utile o rigenera lo storico.', [{ label: 'Snapshot', value: rows.length, kind: 'count' }], '/financial-health'))
  }
  const currentMonth = input.now.slice(0, 7)
  if (!input.financialHealthSnapshots.some((snapshot) => snapshot.period_key === currentMonth)) add(issue('FINANCIAL_HEALTH_SNAPSHOT_OUTDATED', 'financial_health_snapshot', [currentMonth], 'Nessuno snapshot per il mese corrente.', 'Lo storico dello score non include l ultimo periodo.', 'Salva uno snapshot dalla pagina salute finanziaria.', [{ label: 'Mese', value: currentMonth, kind: 'date' }], '/financial-health'))
}

function scanNotifications(input: DataIntegrityInput, context: Context, add: (draft: DataIntegrityIssueDraft) => void) {
  const active = input.notifications.filter((n) => !n.archived_at && !n.resolved_at)
  for (const rows of groupBy(active, (n) => n.dedupe_key).values()) {
    if (rows.length > 1) add(issue('NOTIFICATION_DUPLICATE_ACTIVE', 'notification', rows.map((row) => row.id), 'Avvisi attivi duplicati.', 'Il centro notifiche puo mostrare lo stesso problema piu volte.', 'Mantieni un solo avviso per dedupe key.', [{ label: 'Avvisi', value: rows.length, kind: 'count' }], '/notifications'))
  }
  for (const notification of input.notifications) {
    if (notification.resolved_at && !notification.is_read) add(issue('NOTIFICATION_RESOLVED_UNREAD', 'notification', [notification.id], 'Avviso risolto ma non letto.', 'Il contatore non letti puo essere meno utile.', 'Apri o marca letto l avviso se necessario.', [], '/notifications'))
    if (notification.source_id && notification.source_type && !sourceExists(notification.source_type, notification.source_id, context)) add(issue('NOTIFICATION_SOURCE_ORPHAN', 'notification', [notification.id, notification.source_id], 'La sorgente dell avviso non esiste piu.', 'L avviso potrebbe non rappresentare piu un problema reale.', 'Verifica o risolvi l avviso.', [{ label: 'Sorgente', value: notification.source_type, kind: 'text' }], '/notifications'))
  }
}

function sourceExists(sourceType: string, sourceId: string, context: Context) {
  if (sourceType === 'account') return context.accountIds.has(sourceId)
  if (sourceType === 'transaction') return context.transactionIds.has(sourceId)
  if (sourceType === 'category') return context.categoryIds.has(sourceId)
  if (sourceType === 'budget') return true
  if (sourceType === 'goal') return context.goalIds.has(sourceId)
  if (sourceType === 'loan') return context.loanIds.has(sourceId)
  if (sourceType === 'recurring') return context.recurringIds.has(sourceId)
  return true
}

function scanTemporal(input: DataIntegrityInput, add: (draft: DataIntegrityIssueDraft) => void) {
  const rows = [
    ...input.accounts.map((row) => ({ id: row.id, entity: 'account', created_at: row.created_at, updated_at: row.updated_at, path: `/accounts?account=${row.id}` })),
    ...input.transactions.map((row) => ({ id: row.id, entity: 'transaction', created_at: row.created_at, updated_at: row.updated_at, path: `/transactions?id=${row.id}` })),
    ...input.recurringRules.map((row) => ({ id: row.id, entity: 'recurring_rule', created_at: row.created_at, updated_at: row.updated_at, path: `/recurring?rule=${row.id}` })),
    ...input.budgets.map((row) => ({ id: row.id, entity: 'budget', created_at: row.created_at, updated_at: row.updated_at, path: `/budgets/${row.id}` })),
    ...input.goals.map((row) => ({ id: row.id, entity: 'goal', created_at: row.created_at, updated_at: row.updated_at, path: `/goals/${row.id}` })),
    ...input.loans.map((row) => ({ id: row.id, entity: 'loan', created_at: row.created_at, updated_at: row.updated_at, path: `/loans?loan=${row.id}` })),
  ]
  for (const row of rows) {
    if (row.created_at && row.updated_at && row.created_at > row.updated_at) add(issue('TEMPORAL_CREATED_AFTER_UPDATED', row.entity, [row.id], 'created_at e successivo a updated_at.', 'Audit e ordinamenti temporali potrebbero essere fuorvianti.', 'Verifica il record: non viene corretto automaticamente.', [
      { label: 'Creato', value: row.created_at, kind: 'date' },
      { label: 'Aggiornato', value: row.updated_at, kind: 'date' },
    ], row.path))
  }
}

function issue(
  ruleCode: DataIntegrityIssueDraft['ruleCode'],
  entityType: string,
  entityIds: string[],
  explanation: string,
  impact: string,
  recommendation: string,
  evidence: DataIntegrityIssueDraft['evidence'],
  sourcePath?: string,
): DataIntegrityIssueDraft {
  return { ruleCode, entityType, entityIds, explanation, impact, recommendation, evidence, sourcePath }
}
