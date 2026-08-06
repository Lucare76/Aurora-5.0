import type { FinancialAssistantPeriod } from '../types'
import type { ParsedPeriod } from './types'

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

export function parseItalianPeriod(normalized: string): ParsedPeriod {
  if (normalized.includes('mese scorso') || normalized.includes('mese precedente')) {
    return { key: 'PREVIOUS_MONTH', label: 'mese scorso' }
  }
  if (normalized.includes('ultimi 12 mesi') || normalized.includes('ultimo anno')) {
    return { key: 'LAST_12_MONTHS', label: 'ultimi 12 mesi' }
  }
  if (normalized.includes('ultimi 6 mesi') || normalized.includes('sei mesi')) {
    return { key: 'LAST_6_MONTHS', label: 'ultimi 6 mesi' }
  }
  if (normalized.includes('ultimi 3 mesi') || normalized.includes('tre mesi')) {
    return { key: 'LAST_3_MONTHS', label: 'ultimi 3 mesi' }
  }
  if (normalized.includes('quest anno') || normalized.includes('anno corrente')) {
    return { key: 'LAST_12_MONTHS', label: 'anno corrente', ambiguous: true }
  }
  if (normalized.includes('anno scorso')) {
    return { key: 'LAST_12_MONTHS', label: 'anno scorso', ambiguous: true }
  }
  if (normalized.includes('oggi')) return { key: 'CURRENT_MONTH', label: 'oggi', ambiguous: true }

  const explicitMonth = MONTHS.find((month) => normalized.includes(month))
  if (explicitMonth) return { key: 'CURRENT_MONTH', label: explicitMonth, ambiguous: true }

  if (/\bdal\b.+\bal\b/.test(normalized)) {
    return { key: 'CURRENT_MONTH', label: 'intervallo indicato', ambiguous: true }
  }

  return { key: 'CURRENT_MONTH', label: 'mese corrente' }
}

export function periodKey(period: ParsedPeriod): FinancialAssistantPeriod {
  return period.key
}
