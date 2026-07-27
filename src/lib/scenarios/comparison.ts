import type { ScenarioProjectionResult, ScenarioComparison, ComparisonMetric, ComparisonDirection } from './types'
import { roundMoney } from './money'

function direction(delta: number, positiveIsGood: boolean): ComparisonDirection {
  if (delta === 0) return 'neutral'
  return (delta > 0) === positiveIsGood ? 'positive' : 'negative'
}

function deltaPercent(baseline: number, scenario: number): number | null {
  if (baseline === 0) return null
  return roundMoney(((scenario - baseline) / Math.abs(baseline)) * 100)
}

function metric(
  key: string,
  label: string,
  baseline: number,
  scenario: number,
  unit: ComparisonMetric['unit'],
  positiveIsGood: boolean,
  explanation: string,
): ComparisonMetric {
  const delta = roundMoney(scenario - baseline)
  return {
    key,
    label,
    baseline,
    scenario,
    delta,
    deltaPercent: deltaPercent(baseline, scenario),
    direction: direction(delta, positiveIsGood),
    unit,
    explanation,
  }
}

export function buildComparison(
  projection: ScenarioProjectionResult,
  baselineHealthScore: number | null,
  scenarioHealthScore: number | null,
): ScenarioComparison {
  const n = projection.months.length || 1

  const baselineAvgCash = roundMoney(
    (projection.baselineFinalBalance - (projection.months[0]?.baselineOpeningBalance ?? 0)) / n,
  )
  const scenarioAvgCash = roundMoney(
    (projection.scenarioFinalBalance - (projection.months[0]?.scenarioOpeningBalance ?? 0)) / n,
  )

  const finalBalance = metric(
    'final_balance', 'Saldo finale',
    projection.baselineFinalBalance, projection.scenarioFinalBalance,
    'currency', true,
    'Saldo previsto al termine dell\'orizzonte temporale.',
  )

  const minimumBalance = metric(
    'minimum_balance', 'Saldo minimo',
    projection.baselineMinBalance, projection.scenarioMinBalance,
    'currency', true,
    'Saldo più basso registrato durante il periodo analizzato.',
  )

  const averageCashFlow = metric(
    'avg_cash_flow', 'Flusso mensile medio',
    baselineAvgCash, scenarioAvgCash,
    'currency', true,
    'Variazione media mensile del saldo nel periodo.',
  )

  const totalIncome = metric(
    'total_income', 'Entrate totali',
    projection.baselineTotalIncome, projection.scenarioTotalIncome,
    'currency', true,
    'Somma di tutte le entrate nel periodo analizzato.',
  )

  const totalExpenses = metric(
    'total_expenses', 'Uscite totali',
    projection.baselineTotalExpenses, projection.scenarioTotalExpenses,
    'currency', false,
    'Somma di spese, rate prestiti e contributi agli obiettivi.',
  )

  const negativeMonths = metric(
    'negative_months', 'Mesi negativi',
    projection.baselineNegativeMonths, projection.scenarioNegativeMonths,
    'integer', false,
    'Numero di mesi in cui il saldo scende sotto zero.',
  )

  const financialHealthScore: ComparisonMetric | null =
    baselineHealthScore !== null && scenarioHealthScore !== null
      ? metric(
          'financial_health', 'Indice di salute finanziaria',
          baselineHealthScore, scenarioHealthScore,
          'integer', true,
          'Punteggio stimato basato sui dati proiettati (simulazione).',
        )
      : null

  const allMetrics = [
    finalBalance, minimumBalance, averageCashFlow,
    totalIncome, totalExpenses, negativeMonths,
    ...(financialHealthScore ? [financialHealthScore] : []),
  ]

  // Build human-readable summary sentence
  const delta = projection.totalDelta
  const sign = delta >= 0 ? '+' : ''
  const summary =
    delta > 0
      ? `Lo scenario migliora il saldo finale di ${sign}€${Math.abs(delta).toLocaleString('it-IT', { minimumFractionDigits: 2 })}.`
      : delta < 0
        ? `Lo scenario riduce il saldo finale di €${Math.abs(delta).toLocaleString('it-IT', { minimumFractionDigits: 2 })}.`
        : 'Lo scenario non modifica il saldo finale rispetto alla baseline.'

  return {
    metrics: allMetrics,
    finalBalance,
    minimumBalance,
    averageCashFlow,
    totalIncome,
    totalExpenses,
    negativeMonths,
    financialHealthScore,
    summary,
  }
}
