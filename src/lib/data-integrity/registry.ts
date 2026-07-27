import type { DataIntegrityRuleCode, DataIntegrityRuleDefinition } from './types'
import { DATA_INTEGRITY_RULESET_VERSION } from './constants'

const commonActions = ['open_record', 'acknowledge', 'ignore', 'reopen'] as const

export const DATA_INTEGRITY_RULES: DataIntegrityRuleDefinition[] = [
  rule('TRANSACTION_EXACT_DUPLICATE', 'transactions', 'CRITICAL', 'Transazione duplicata certa', 'Due o piu movimenti condividono conto, tipo, data, importo, descrizione e categoria.', ['delete_duplicate_via_existing_flow']),
  rule('TRANSACTION_POSSIBLE_DUPLICATE', 'transactions', 'WARNING', 'Possibile transazione duplicata', 'Movimenti molto simili richiedono verifica manuale.', ['delete_duplicate_via_existing_flow']),
  rule('TRANSACTION_MISSING_CATEGORY', 'transactions', 'INFO', 'Movimento senza categoria', 'Un movimento non di giroconto non ha categoria associata.', ['recategorize']),
  rule('TRANSACTION_INVALID_AMOUNT', 'transactions', 'CRITICAL', 'Importo movimento non valido', 'Un movimento ha importo nullo, negativo o non finito.', []),
  rule('TRANSACTION_ORPHAN_ACCOUNT', 'references', 'CRITICAL', 'Movimento con conto mancante', 'Un movimento punta a un conto non presente tra i dati utente.', []),
  rule('TRANSACTION_ORPHAN_CATEGORY', 'references', 'WARNING', 'Movimento con categoria mancante', 'Un movimento punta a una categoria non presente tra i dati utente.', ['recategorize']),
  rule('TRANSACTION_ORPHAN_RECURRING', 'references', 'WARNING', 'Movimento con ricorrenza mancante', 'Un movimento punta a una ricorrenza non presente tra i dati utente.', []),
  rule('TRANSACTION_FUTURE_ANOMALY', 'temporal', 'INFO', 'Movimento molto futuro', 'Un movimento e registrato oltre un anno nel futuro.', []),
  rule('TRANSFER_MISSING_COUNTERPART', 'transfers', 'CRITICAL', 'Giroconto senza destinazione', 'Un giroconto non indica conto destinazione o controparte legacy.', ['repair_transfer_with_preview']),
  rule('TRANSFER_SAME_ACCOUNT', 'transfers', 'CRITICAL', 'Giroconto sullo stesso conto', 'Origine e destinazione del giroconto coincidono.', ['repair_transfer_with_preview']),
  rule('TRANSFER_LEGACY_PEER_ORPHAN', 'transfers', 'CRITICAL', 'Controparte giroconto mancante', 'Un giroconto legacy punta a una transazione non esistente.', ['repair_transfer_with_preview']),
  rule('TRANSFER_LEGACY_PEER_INCOHERENT', 'transfers', 'CRITICAL', 'Giroconto legacy non reciproco', 'La controparte non punta al movimento originario.', ['repair_transfer_with_preview']),
  rule('TRANSFER_LEGACY_AMOUNT_MISMATCH', 'transfers', 'CRITICAL', 'Importi giroconto diversi', 'I due lati del giroconto legacy hanno importi diversi.', ['repair_transfer_with_preview']),
  rule('ACCOUNT_BALANCE_NON_FINITE', 'balances', 'CRITICAL', 'Saldo conto non valido', 'Un conto ha saldo non numerico o non finito.', []),
  rule('ACCOUNT_INACTIVE_WITH_FUTURE_TRANSACTIONS', 'balances', 'INFO', 'Conto inattivo con movimenti futuri', 'Un conto inattivo contiene movimenti con data futura.', []),
  rule('RECURRING_ORPHAN_ACCOUNT', 'recurring', 'WARNING', 'Ricorrenza con conto mancante', 'Una ricorrenza punta a un conto non presente.', []),
  rule('RECURRING_ORPHAN_CATEGORY', 'recurring', 'WARNING', 'Ricorrenza con categoria mancante', 'Una ricorrenza punta a una categoria non presente.', []),
  rule('RECURRING_INVALID_DATES', 'recurring', 'WARNING', 'Ricorrenza con date incoerenti', 'La data fine precede la data inizio o la prossima data e fuori intervallo.', []),
  rule('RECURRING_ACTIVE_WITHOUT_NEXT_DATE', 'recurring', 'WARNING', 'Ricorrenza attiva senza prossima data', 'Una ricorrenza attiva non ha prossima esecuzione valorizzata.', []),
  rule('RECURRING_DUPLICATE_INSTANCE', 'recurring', 'WARNING', 'Istanza ricorrente duplicata', 'La stessa ricorrenza ha generato piu movimenti identici nello stesso giorno.', ['delete_duplicate_via_existing_flow']),
  rule('LOAN_REMAINING_NEGATIVE', 'loans', 'CRITICAL', 'Residuo prestito negativo', 'Il capitale residuo di un prestito e sotto zero.', []),
  rule('LOAN_REMAINING_EXCEEDS_AMOUNT', 'loans', 'WARNING', 'Residuo prestito superiore al capitale', 'Il residuo supera l importo iniziale del prestito.', []),
  rule('LOAN_SETTLED_WITH_REMAINING', 'loans', 'WARNING', 'Prestito saldato con residuo', 'Un prestito chiuso conserva un capitale residuo positivo.', []),
  rule('LOAN_DUPLICATE_PAYMENT', 'loans', 'WARNING', 'Pagamento prestito duplicato', 'Pagamenti identici risultano registrati sullo stesso prestito.', []),
  rule('BUDGET_ORPHAN_CATEGORY', 'budgets', 'WARNING', 'Budget con categoria mancante', 'Un budget punta a una categoria non presente.', []),
  rule('BUDGET_INVALID_AMOUNT', 'budgets', 'WARNING', 'Budget con importo non valido', 'Il limite budget e minore o uguale a zero.', []),
  rule('BUDGET_INVALID_PERIOD', 'budgets', 'WARNING', 'Budget con periodo non valido', 'Mese o anno del budget sono fuori dai limiti ammessi.', []),
  rule('BUDGET_DUPLICATE_SCOPE', 'budgets', 'WARNING', 'Budget duplicato', 'Esistono piu budget per stessa categoria e mese.', []),
  rule('GOAL_INVALID_TARGET', 'goals', 'WARNING', 'Obiettivo con target non valido', 'Il target dell obiettivo e minore o uguale a zero.', []),
  rule('GOAL_CURRENT_NEGATIVE', 'goals', 'WARNING', 'Obiettivo con accumulato negativo', 'L importo accumulato dell obiettivo e sotto zero.', []),
  rule('GOAL_COMPLETED_UNDER_TARGET', 'goals', 'WARNING', 'Obiettivo completato sotto target', 'Lo stato completato non e coerente con l importo accumulato.', []),
  rule('GOAL_REACHED_NOT_COMPLETED', 'goals', 'INFO', 'Obiettivo raggiunto ancora attivo', 'L obiettivo ha raggiunto il target ma non risulta completato.', []),
  rule('GOAL_CONTRIBUTIONS_MISMATCH', 'goals', 'WARNING', 'Versamenti non allineati all accumulato', 'La somma dei versamenti non coincide con il current_amount memorizzato.', []),
  rule('GOAL_DUPLICATE_CONTRIBUTION', 'goals', 'WARNING', 'Versamento duplicato', 'Due versamenti identici sono registrati sullo stesso obiettivo.', []),
  rule('CATEGORY_DUPLICATE_NAME', 'categories', 'INFO', 'Categoria duplicata', 'Categorie dello stesso tipo e stesso livello hanno nome normalizzato uguale.', []),
  rule('CATEGORY_PARENT_MISSING', 'categories', 'WARNING', 'Categoria padre mancante', 'Una sottocategoria punta a una categoria padre non presente.', []),
  rule('CATEGORY_PARENT_SELF', 'categories', 'WARNING', 'Categoria padre uguale a se stessa', 'Una categoria usa se stessa come parent.', []),
  rule('CATEGORY_TYPE_MISMATCH', 'categories', 'INFO', 'Categoria usata con tipo diverso', 'Una categoria entrata/spesa e usata con movimento di tipo opposto.', ['recategorize']),
  rule('FINANCIAL_HEALTH_SNAPSHOT_DUPLICATE', 'financial_health', 'INFO', 'Snapshot duplicato', 'Esistono piu snapshot per stesso periodo e versione.', ['refresh_snapshot']),
  rule('FINANCIAL_HEALTH_SNAPSHOT_SCORE_OUT_OF_RANGE', 'financial_health', 'WARNING', 'Score snapshot fuori range', 'Uno snapshot ha punteggio fuori dall intervallo 0-100.', ['refresh_snapshot']),
  rule('FINANCIAL_HEALTH_SNAPSHOT_VERSION_MISSING', 'financial_health', 'INFO', 'Versione snapshot mancante', 'Uno snapshot non indica la versione di calcolo.', ['refresh_snapshot']),
  rule('FINANCIAL_HEALTH_SNAPSHOT_OUTDATED', 'financial_health', 'INFO', 'Snapshot non aggiornato', 'Non risultano snapshot recenti per il mese corrente.', ['refresh_snapshot']),
  rule('NOTIFICATION_DUPLICATE_ACTIVE', 'notifications', 'INFO', 'Avviso duplicato', 'Avvisi attivi condividono lo stesso fingerprint operativo.', []),
  rule('NOTIFICATION_SOURCE_ORPHAN', 'notifications', 'INFO', 'Avviso con sorgente non trovata', 'Un avviso punta a una sorgente che non esiste piu.', []),
  rule('NOTIFICATION_RESOLVED_UNREAD', 'notifications', 'INFO', 'Avviso risolto ancora non letto', 'Un avviso risolto resta marcato come non letto.', []),
  rule('TEMPORAL_CREATED_AFTER_UPDATED', 'temporal', 'INFO', 'Date tecniche incoerenti', 'Un record ha created_at successivo a updated_at.', []),
]

export const DATA_INTEGRITY_RULE_BY_CODE = new Map(DATA_INTEGRITY_RULES.map((item) => [item.code, item]))
export const DATA_INTEGRITY_RULE_CODES = DATA_INTEGRITY_RULES.map((item) => item.code)

export function isDataIntegrityRuleCode(value: unknown): value is DataIntegrityRuleCode {
  return typeof value === 'string' && (DATA_INTEGRITY_RULE_CODES as string[]).includes(value)
}

function rule(
  code: DataIntegrityRuleCode,
  category: DataIntegrityRuleDefinition['category'],
  defaultSeverity: DataIntegrityRuleDefinition['defaultSeverity'],
  title: string,
  description: string,
  extraActions: readonly DataIntegrityRuleDefinition['allowedActions'][number][],
): DataIntegrityRuleDefinition {
  return {
    code,
    category,
    defaultSeverity,
    title,
    description,
    version: DATA_INTEGRITY_RULESET_VERSION,
    allowedActions: [...commonActions, ...extraActions],
  }
}
