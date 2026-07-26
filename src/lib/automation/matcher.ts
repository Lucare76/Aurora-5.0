import type {
  AutomationCondition,
  AutomationTransaction,
  ConditionEvaluation,
} from './types'

export function normalizeTextForAutomation(input: string | null | undefined): string {
  return (input ?? '')
    .trim()
    .toLocaleLowerCase('it-IT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function cents(value: number): number {
  return Math.round(value * 100)
}

function evaluateDescription(condition: Extract<AutomationCondition, { type: 'description' }>, transaction: AutomationTransaction): ConditionEvaluation {
  const actual = normalizeTextForAutomation(transaction.description)
  const expected = normalizeTextForAutomation(condition.value)
  const matched =
    condition.operator === 'CONTAINS' ? actual.includes(expected)
      : condition.operator === 'EQUALS' ? actual === expected
        : condition.operator === 'STARTS_WITH' ? actual.startsWith(expected)
          : condition.operator === 'ENDS_WITH' ? actual.endsWith(expected)
            : !actual.includes(expected)

  return { condition, matched, reason: matched ? 'Descrizione corrispondente' : 'Descrizione non corrispondente' }
}

function evaluateAmount(condition: Extract<AutomationCondition, { type: 'amount' }>, transaction: AutomationTransaction): ConditionEvaluation {
  const actual = cents(Number(transaction.amount))
  const value = condition.value === undefined ? null : cents(condition.value)
  const min = condition.min === undefined ? null : cents(condition.min)
  const max = condition.max === undefined ? null : cents(condition.max)
  const matched =
    condition.operator === 'BETWEEN' ? min !== null && max !== null && actual >= min && actual <= max
      : condition.operator === 'EQUALS' ? value !== null && actual === value
        : condition.operator === 'GREATER_THAN' ? value !== null && actual > value
          : condition.operator === 'GREATER_THAN_OR_EQUAL' ? value !== null && actual >= value
            : condition.operator === 'LESS_THAN' ? value !== null && actual < value
              : value !== null && actual <= value

  return { condition, matched, reason: matched ? 'Importo corrispondente' : 'Importo non corrispondente' }
}

function evaluateDate(condition: Extract<AutomationCondition, { type: 'date' }>, transaction: AutomationTransaction): ConditionEvaluation {
  const date = new Date(`${transaction.date}T00:00:00`)
  const day = Number(transaction.date.slice(8, 10))
  const dayOfWeek = date.getDay()
  const checks = [
    !condition.date_from || transaction.date >= condition.date_from,
    !condition.date_to || transaction.date <= condition.date_to,
    !condition.day_of_month || day === condition.day_of_month,
    condition.day_of_week === null || condition.day_of_week === undefined || dayOfWeek === condition.day_of_week,
  ]
  const matched = checks.every(Boolean)
  return { condition, matched, reason: matched ? 'Data corrispondente' : 'Data non corrispondente' }
}

export function matchesCondition(condition: AutomationCondition, transaction: AutomationTransaction): ConditionEvaluation {
  if (condition.type === 'description') return evaluateDescription(condition, transaction)
  if (condition.type === 'amount') return evaluateAmount(condition, transaction)
  if (condition.type === 'transaction_type') {
    const matched = transaction.type === condition.value
    return { condition, matched, reason: matched ? 'Tipo corrispondente' : 'Tipo non corrispondente' }
  }
  if (condition.type === 'account') {
    const mode = condition.mode ?? (condition.account_id ? 'SELECTED' : 'ANY')
    const matched = mode === 'ANY' ? true : mode === 'NONE' ? !transaction.account_id : transaction.account_id === condition.account_id
    return { condition, matched, reason: matched ? 'Conto corrispondente' : 'Conto non corrispondente' }
  }
  if (condition.type === 'category') {
    const mode = condition.mode ?? (condition.category_id ? 'SELECTED' : 'ANY')
    const matched = mode === 'ANY' ? true : mode === 'NONE' ? !transaction.category_id : transaction.category_id === condition.category_id
    return { condition, matched, reason: matched ? 'Categoria corrispondente' : 'Categoria non corrispondente' }
  }
  return evaluateDate(condition, transaction)
}
