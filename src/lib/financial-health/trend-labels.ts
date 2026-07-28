import type { DataQualityLevel, TrendDirection, TrendInterpretation } from './types'

export const TREND_METRIC_LABELS: Record<string, string> = {
  currentFinancialPosition: 'Situazione finanziaria',
  currentLiquidity: 'Liquidità attuale',
  monthlyIncome: 'Entrate mensili',
  monthlyExpenses: 'Spese mensili',
  monthlyMargin: 'Margine mensile',
  savingsRate: 'Tasso di risparmio',
  totalBudgetOverspend: 'Sforamento budget',
  debtOutstanding: 'Debito residuo',
  paymentToIncomeRatio: 'Rapporto rate/entrate',
  totalScore: 'Score complessivo',
  projectedLiquidity7d: 'Liquidità prevista 7 giorni',
  projectedLiquidity30d: 'Liquidità prevista 30 giorni',
  projectedLiquidity90d: 'Liquidità prevista 90 giorni',
  trailing3MonthSavingsRate: 'Risparmio medio 3 mesi',
  trailing6MonthSavingsRate: 'Risparmio medio 6 mesi',
  cashFlowStabilityScore: 'Stabilità cash flow',
  expenseCoverageMonths: 'Copertura spese (mesi)',
  activeBudgets: 'Budget attivi',
  exceededBudgets: 'Budget superati',
  warningBudgets: 'Budget in allerta',
  totalBudgetLimit: 'Limite budget totale',
  totalBudgetSpent: 'Budget speso totale',
  monthlyDebtPayments: 'Rate mensili debito',
  overduePayments: 'Pagamenti scaduti',
  upcomingDeadlines7d: 'Scadenze prossimi 7 giorni',
  overdueDeadlines: 'Scadenze non pagate',
  activeGoals: 'Obiettivi attivi',
  completedGoals: 'Obiettivi completati',
  behindGoals: 'Obiettivi in ritardo',
  aggregateGoalProgress: 'Avanzamento obiettivi',
  activeCriticalAlerts: 'Avvisi critici attivi',
  activeWarningAlerts: 'Avvisi warning attivi',
}

export const TREND_DIRECTION_LABELS: Record<TrendDirection, string> = {
  UP: 'In aumento',
  DOWN: 'In diminuzione',
  STABLE: 'Stabile',
  UNAVAILABLE: 'Dati non disponibili',
}

export const TREND_INTERPRETATION_LABELS: Record<TrendInterpretation, string | null> = {
  positive: 'andamento favorevole',
  negative: 'andamento sfavorevole',
  neutral: 'andamento neutro',
  unavailable: null,
}

export function trendMetricLabel(metric: string): string {
  return TREND_METRIC_LABELS[metric] ?? metric
}

export function trendDirectionLabel(direction: TrendDirection): string {
  return TREND_DIRECTION_LABELS[direction]
}

export function trendInterpretationLabel(interpretation: TrendInterpretation): string | null {
  return TREND_INTERPRETATION_LABELS[interpretation]
}

export const DATA_QUALITY_LABELS: Record<DataQualityLevel, string> = {
  INSUFFICIENT: 'Dati insufficienti',
  LIMITED: 'Dati limitati',
  GOOD: 'Dati buoni',
  EXCELLENT: 'Dati ottimi',
}

export function dataQualityLabel(level: DataQualityLevel): string {
  return DATA_QUALITY_LABELS[level]
}
