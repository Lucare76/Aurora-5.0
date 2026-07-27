export const FINANCIAL_HEALTH_CALCULATION_VERSION = '1.0'

export const SCORE_WEIGHTS = {
  liquidity: 25,
  savings: 20,
  budgets: 15,
  debt: 15,
  deadlines: 10,
  goals: 10,
  alerts: 5,
} as const

export const SCORE_LEVELS = [
  { level: 'CRITICAL', label: 'Critica', min: 0, max: 39 },
  { level: 'NEEDS_ATTENTION', label: 'Da migliorare', min: 40, max: 59 },
  { level: 'FAIR', label: 'Discreta', min: 60, max: 74 },
  { level: 'GOOD', label: 'Buona', min: 75, max: 89 },
  { level: 'EXCELLENT', label: 'Ottima', min: 90, max: 100 },
] as const

export const DATA_QUALITY_THRESHOLDS = {
  minimumTransactions: 5,
  minimumDays: 14,
  limitedDays: 30,
  goodDays: 90,
  excellentDays: 180,
  goodTransactions: 30,
  excellentTransactions: 80,
  categoryCompletenessGood: 70,
  categoryCompletenessExcellent: 90,
} as const

export const SCORE_THRESHOLDS = {
  budgetWarningUsage: 80,
  budgetExceededUsage: 100,
  savingsExcellent: 20,
  savingsGood: 10,
  savingsPositive: 0,
  debtGoodRatio: 15,
  debtModerateRatio: 30,
  debtElevatedRatio: 40,
  deadlineSoonDays: 7,
  deadlineMonthDays: 30,
  stableTrendTolerancePct: 3,
  maxRecommendations: 5,
  maxAlertPenalty: 100,
} as const

export const LIQUID_ACCOUNT_TYPES = ['checking', 'savings', 'cash'] as const

export const MONTH_LABELS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const
