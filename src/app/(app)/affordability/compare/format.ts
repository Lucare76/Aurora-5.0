import { CRITERIA } from '@/lib/decision-comparison/constants'
import type { ComparisonProfile, CriterionKey } from '@/lib/decision-comparison/types'
import { formatCurrency } from '@/lib/utils'

export const CRITERION_LABELS: Record<CriterionKey, string> = Object.fromEntries(
  CRITERIA.map((c) => [c.key, c.label]),
) as Record<CriterionKey, string>

export const CRITERION_DIRECTION: Record<CriterionKey, 'lowerIsBetter' | 'higherIsBetter'> = Object.fromEntries(
  CRITERIA.map((c) => [c.key, c.direction]),
) as Record<CriterionKey, 'lowerIsBetter' | 'higherIsBetter'>

export const BUILTIN_PROFILES: Exclude<ComparisonProfile, 'CUSTOM'>[] = [
  'BALANCED',
  'PROTECT_LIQUIDITY',
  'REDUCE_TOTAL_COST',
  'REDUCE_MONTHLY_COMMITMENT',
  'AVOID_DEBT',
  'PRESERVE_EMERGENCY_FUND',
]

export const PROFILE_INFO: Record<ComparisonProfile, { label: string; description: string }> = {
  BALANCED: { label: 'Bilanciato', description: 'Pesa in modo equilibrato costi, liquidità, debito e valore residuo.' },
  PROTECT_LIQUIDITY: { label: 'Proteggi la liquidità', description: 'Privilegia gli scenari che lasciano più margine e liquidità disponibile.' },
  REDUCE_TOTAL_COST: { label: 'Riduci il costo totale', description: 'Privilegia gli scenari con esborso e costo complessivo più bassi.' },
  REDUCE_MONTHLY_COMMITMENT: { label: 'Riduci l’impegno mensile', description: 'Privilegia rate e costi ricorrenti mensili più contenuti.' },
  AVOID_DEBT: { label: 'Evita il debito', description: 'Privilegia gli scenari con minore costo di finanziamento e debito residuo.' },
  PRESERVE_EMERGENCY_FUND: { label: 'Preserva il fondo di emergenza', description: 'Privilegia gli scenari che mantengono più a lungo il fondo di sicurezza.' },
  CUSTOM: { label: 'Personalizzato', description: 'Imposta manualmente il peso di ciascun criterio.' },
}

export function fmtScore(score: number): string {
  return `${score.toFixed(1)}/100`
}

export function fmtCriterionValue(value: number | null, criterion: CriterionKey, currency: string): string {
  if (value === null) return 'Dato non disponibile'
  const isCount = criterion === 'negativeMonthsCount' || criterion === 'criticalMonthsCount'
  const isMonths = criterion === 'emergencyFundMonthsAfterDecision'
  if (isCount) return `${value}`
  if (isMonths) return `${value.toFixed(1)} mesi`
  return formatCurrency(value, currency)
}
