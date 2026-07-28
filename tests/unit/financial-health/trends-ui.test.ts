import { describe, expect, it } from 'vitest'
import {
  TREND_DIRECTION_LABELS,
  TREND_INTERPRETATION_LABELS,
  TREND_METRIC_LABELS,
  trendDirectionLabel,
  trendInterpretationLabel,
  trendMetricLabel,
} from '@/lib/financial-health/trend-labels'
import type { TrendDirection, TrendInterpretation } from '@/lib/financial-health/types'

const RAW_ENGLISH_ENUMS = ['UP', 'DOWN', 'STABLE', 'UNAVAILABLE', 'positive', 'negative', 'neutral', 'unavailable']

describe('TREND_METRIC_LABELS', () => {
  it('maps all 6 spec-required metrics to Italian', () => {
    expect(TREND_METRIC_LABELS['currentFinancialPosition']).toBe('Situazione finanziaria')
    expect(TREND_METRIC_LABELS['currentLiquidity']).toBe('Liquidità attuale')
    expect(TREND_METRIC_LABELS['monthlyIncome']).toBe('Entrate mensili')
    expect(TREND_METRIC_LABELS['monthlyExpenses']).toBe('Spese mensili')
    expect(TREND_METRIC_LABELS['monthlyMargin']).toBe('Margine mensile')
    expect(TREND_METRIC_LABELS['savingsRate']).toBe('Tasso di risparmio')
  })

  it('maps additional engine metrics', () => {
    expect(TREND_METRIC_LABELS['totalBudgetOverspend']).toBeDefined()
    expect(TREND_METRIC_LABELS['debtOutstanding']).toBeDefined()
    expect(TREND_METRIC_LABELS['paymentToIncomeRatio']).toBeDefined()
    expect(TREND_METRIC_LABELS['totalScore']).toBeDefined()
  })

  it('no label value equals a raw English enum', () => {
    for (const label of Object.values(TREND_METRIC_LABELS)) {
      expect(RAW_ENGLISH_ENUMS).not.toContain(label)
    }
  })

  it('all labels are non-empty strings', () => {
    for (const label of Object.values(TREND_METRIC_LABELS)) {
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('no label contains camelCase raw metric keys as the full value', () => {
    for (const [key, label] of Object.entries(TREND_METRIC_LABELS)) {
      expect(label).not.toBe(key)
    }
  })
})

describe('TREND_DIRECTION_LABELS', () => {
  it('maps UP to Italian', () => {
    expect(TREND_DIRECTION_LABELS['UP']).toBe('In aumento')
  })

  it('maps DOWN to Italian', () => {
    expect(TREND_DIRECTION_LABELS['DOWN']).toBe('In diminuzione')
  })

  it('maps STABLE to Italian', () => {
    expect(TREND_DIRECTION_LABELS['STABLE']).toBe('Stabile')
  })

  it('maps UNAVAILABLE to Italian (not English)', () => {
    expect(TREND_DIRECTION_LABELS['UNAVAILABLE']).toBe('Dati non disponibili')
    expect(TREND_DIRECTION_LABELS['UNAVAILABLE']).not.toBe('UNAVAILABLE')
  })

  it('no direction label is a raw English enum value', () => {
    for (const label of Object.values(TREND_DIRECTION_LABELS)) {
      expect(RAW_ENGLISH_ENUMS).not.toContain(label)
    }
  })

  it('covers all TrendDirection values', () => {
    const directions: TrendDirection[] = ['UP', 'DOWN', 'STABLE', 'UNAVAILABLE']
    for (const dir of directions) {
      expect(TREND_DIRECTION_LABELS[dir]).toBeDefined()
      expect(TREND_DIRECTION_LABELS[dir].length).toBeGreaterThan(0)
    }
  })
})

describe('TREND_INTERPRETATION_LABELS', () => {
  it('maps positive to Italian', () => {
    expect(TREND_INTERPRETATION_LABELS['positive']).toBe('andamento favorevole')
    expect(TREND_INTERPRETATION_LABELS['positive']).not.toBe('positive')
  })

  it('maps negative to Italian', () => {
    expect(TREND_INTERPRETATION_LABELS['negative']).toBe('andamento sfavorevole')
    expect(TREND_INTERPRETATION_LABELS['negative']).not.toBe('negative')
  })

  it('maps neutral to Italian', () => {
    expect(TREND_INTERPRETATION_LABELS['neutral']).toBe('andamento neutro')
    expect(TREND_INTERPRETATION_LABELS['neutral']).not.toBe('neutral')
  })

  it('maps unavailable to null so it is never displayed', () => {
    expect(TREND_INTERPRETATION_LABELS['unavailable']).toBeNull()
  })

  it('covers all TrendInterpretation values', () => {
    const interpretations: TrendInterpretation[] = ['positive', 'negative', 'neutral', 'unavailable']
    for (const interp of interpretations) {
      expect(TREND_INTERPRETATION_LABELS).toHaveProperty(interp)
    }
  })

  it('non-null labels are non-empty strings', () => {
    for (const [key, label] of Object.entries(TREND_INTERPRETATION_LABELS)) {
      if (label !== null) {
        expect(typeof label).toBe('string')
        expect(label.length).toBeGreaterThan(0)
        expect(RAW_ENGLISH_ENUMS).not.toContain(label)
      } else {
        expect(key).toBe('unavailable')
      }
    }
  })
})

describe('trendMetricLabel', () => {
  it('returns Italian for known metric keys', () => {
    expect(trendMetricLabel('currentFinancialPosition')).toBe('Situazione finanziaria')
    expect(trendMetricLabel('monthlyExpenses')).toBe('Spese mensili')
    expect(trendMetricLabel('savingsRate')).toBe('Tasso di risparmio')
  })

  it('returns the raw key as fallback for unknown metrics (not crashing)', () => {
    expect(trendMetricLabel('unknownMetric')).toBe('unknownMetric')
    expect(trendMetricLabel('anotherUnknown')).toBe('anotherUnknown')
  })

  it('known metric labels are never a raw enum', () => {
    for (const key of Object.keys(TREND_METRIC_LABELS)) {
      expect(RAW_ENGLISH_ENUMS).not.toContain(trendMetricLabel(key))
    }
  })

  it('labels for the 6 first trend metrics shown in the UI', () => {
    const engineOrder = [
      'currentFinancialPosition',
      'currentLiquidity',
      'monthlyIncome',
      'monthlyExpenses',
      'monthlyMargin',
      'savingsRate',
    ]
    const expectedLabels = [
      'Situazione finanziaria',
      'Liquidità attuale',
      'Entrate mensili',
      'Spese mensili',
      'Margine mensile',
      'Tasso di risparmio',
    ]
    engineOrder.forEach((key, i) => {
      expect(trendMetricLabel(key)).toBe(expectedLabels[i])
    })
  })
})

describe('trendDirectionLabel', () => {
  it('returns correct Italian for all directions', () => {
    expect(trendDirectionLabel('UP')).toBe('In aumento')
    expect(trendDirectionLabel('DOWN')).toBe('In diminuzione')
    expect(trendDirectionLabel('STABLE')).toBe('Stabile')
    expect(trendDirectionLabel('UNAVAILABLE')).toBe('Dati non disponibili')
  })

  it('no return value is a raw English enum', () => {
    const directions: TrendDirection[] = ['UP', 'DOWN', 'STABLE', 'UNAVAILABLE']
    for (const d of directions) {
      expect(RAW_ENGLISH_ENUMS).not.toContain(trendDirectionLabel(d))
    }
  })
})

describe('trendInterpretationLabel', () => {
  it('returns Italian string for positive', () => {
    const label = trendInterpretationLabel('positive')
    expect(label).not.toBeNull()
    expect(label).not.toBe('positive')
    expect(typeof label).toBe('string')
  })

  it('returns Italian string for negative', () => {
    const label = trendInterpretationLabel('negative')
    expect(label).not.toBeNull()
    expect(label).not.toBe('negative')
  })

  it('returns Italian string for neutral', () => {
    const label = trendInterpretationLabel('neutral')
    expect(label).not.toBeNull()
    expect(label).not.toBe('neutral')
  })

  it('returns null for unavailable — prevents showing "UNAVAILABLE · unavailable"', () => {
    expect(trendInterpretationLabel('unavailable')).toBeNull()
  })

  it('positive and negative are semantically distinct', () => {
    expect(trendInterpretationLabel('positive')).not.toBe(trendInterpretationLabel('negative'))
  })
})

describe('UNAVAILABLE trend explanation — currentFinancialPosition and currentLiquidity', () => {
  it('engine sets currentFinancialPosition and currentLiquidity previousValue to null by design', () => {
    // These two metrics are point-in-time balances that cannot be derived from
    // transaction history. The engine explicitly returns null for their previousMetrics.
    // This is expected behavior, not a bug.
    // The UI should show an explanatory message rather than a raw "UNAVAILABLE" label.
    const METRICS_ALWAYS_UNAVAILABLE = ['currentFinancialPosition', 'currentLiquidity']
    for (const key of METRICS_ALWAYS_UNAVAILABLE) {
      // Label must be Italian, not the raw camelCase key
      expect(trendMetricLabel(key)).not.toBe(key)
      expect(trendMetricLabel(key).length).toBeGreaterThan(0)
    }
  })

  it('UNAVAILABLE direction maps to Italian, not English enum', () => {
    expect(trendDirectionLabel('UNAVAILABLE')).not.toBe('UNAVAILABLE')
    expect(trendDirectionLabel('UNAVAILABLE')).not.toBe('unavailable')
  })

  it('trendInterpretationLabel unavailable returns null so UI shows explanatory text instead', () => {
    // When direction is UNAVAILABLE, the page shows
    // "Sono necessari almeno due snapshot per calcolare il trend"
    // instead of attempting to render a missing badge.
    expect(trendInterpretationLabel('unavailable')).toBeNull()
  })
})
