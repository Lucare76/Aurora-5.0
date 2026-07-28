import { describe, expect, it } from 'vitest'
import {
  DATA_QUALITY_LABELS,
  dataQualityLabel,
  trendDirectionLabel,
  trendInterpretationLabel,
  trendMetricLabel,
  TREND_DIRECTION_LABELS,
  TREND_INTERPRETATION_LABELS,
  TREND_METRIC_LABELS,
} from '@/lib/financial-health/trend-labels'
import type { DataQualityLevel } from '@/lib/financial-health/types'

describe('dataQualityLabel', () => {
  const cases: Array<[DataQualityLevel, string]> = [
    ['INSUFFICIENT', 'Dati insufficienti'],
    ['LIMITED', 'Dati limitati'],
    ['GOOD', 'Dati buoni'],
    ['EXCELLENT', 'Dati ottimi'],
  ]

  it.each(cases)('traduce %s in "%s"', (level, expected) => {
    expect(dataQualityLabel(level)).toBe(expected)
  })

  it('tutti i livelli sono definiti in DATA_QUALITY_LABELS', () => {
    const levels: DataQualityLevel[] = ['INSUFFICIENT', 'LIMITED', 'GOOD', 'EXCELLENT']
    for (const level of levels) {
      expect(DATA_QUALITY_LABELS[level]).toBeDefined()
      expect(DATA_QUALITY_LABELS[level].length).toBeGreaterThan(0)
    }
  })

  it('non restituisce stringhe vuote', () => {
    const levels: DataQualityLevel[] = ['INSUFFICIENT', 'LIMITED', 'GOOD', 'EXCELLENT']
    for (const level of levels) {
      expect(dataQualityLabel(level)).not.toBe('')
    }
  })

  it('non restituisce chiavi inglesi uppercase', () => {
    const levels: DataQualityLevel[] = ['INSUFFICIENT', 'LIMITED', 'GOOD', 'EXCELLENT']
    for (const level of levels) {
      const label = dataQualityLabel(level)
      expect(label).not.toMatch(/^[A-Z_]+$/)
    }
  })
})

describe('trendMetricLabel', () => {
  it('restituisce etichetta italiana per metrica nota', () => {
    expect(trendMetricLabel('currentLiquidity')).toBe('Liquidità attuale')
    expect(trendMetricLabel('monthlyIncome')).toBe('Entrate mensili')
    expect(trendMetricLabel('savingsRate')).toBe('Tasso di risparmio')
  })

  it('restituisce la chiave originale per metrica sconosciuta', () => {
    expect(trendMetricLabel('unknownMetric')).toBe('unknownMetric')
  })

  it('tutte le etichette nel dizionario non sono vuote', () => {
    for (const [key, label] of Object.entries(TREND_METRIC_LABELS)) {
      expect(label, `${key} ha etichetta vuota`).not.toBe('')
    }
  })
})

describe('trendDirectionLabel', () => {
  it('restituisce etichette italiane per tutte le direzioni', () => {
    expect(trendDirectionLabel('UP')).toBe('In aumento')
    expect(trendDirectionLabel('DOWN')).toBe('In diminuzione')
    expect(trendDirectionLabel('STABLE')).toBe('Stabile')
    expect(trendDirectionLabel('UNAVAILABLE')).toBe('Dati non disponibili')
  })

  it('nessuna etichetta di direzione è vuota', () => {
    for (const [key, label] of Object.entries(TREND_DIRECTION_LABELS)) {
      expect(label, `${key} ha etichetta vuota`).not.toBe('')
    }
  })
})

describe('trendInterpretationLabel', () => {
  it('restituisce etichette italiane per interpretazioni note', () => {
    expect(trendInterpretationLabel('positive')).toBe('andamento favorevole')
    expect(trendInterpretationLabel('negative')).toBe('andamento sfavorevole')
    expect(trendInterpretationLabel('neutral')).toBe('andamento neutro')
  })

  it('restituisce null per unavailable', () => {
    expect(trendInterpretationLabel('unavailable')).toBeNull()
  })

  it('dizionario copre tutte le interpretazioni', () => {
    const interpretations = ['positive', 'negative', 'neutral', 'unavailable'] as const
    for (const interpretation of interpretations) {
      expect(interpretation in TREND_INTERPRETATION_LABELS).toBe(true)
    }
  })
})
