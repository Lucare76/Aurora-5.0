import { describe, it, expect } from 'vitest'
import { CRITERION_LABELS, CRITERION_DIRECTION, BUILTIN_PROFILES, PROFILE_INFO, fmtScore, fmtCriterionValue } from './format'
import { CRITERIA } from '@/lib/decision-comparison/constants'

describe('CRITERION_LABELS / CRITERION_DIRECTION', () => {
  it('espone un\'etichetta e una direzione per ogni criterio del core', () => {
    for (const c of CRITERIA) {
      expect(CRITERION_LABELS[c.key]).toBe(c.label)
      expect(CRITERION_DIRECTION[c.key]).toBe(c.direction)
    }
  })
})

describe('BUILTIN_PROFILES / PROFILE_INFO', () => {
  it('elenca 6 profili predefiniti oltre a CUSTOM', () => {
    expect(BUILTIN_PROFILES).toHaveLength(6)
    expect(BUILTIN_PROFILES).not.toContain('CUSTOM')
  })

  it('ha nome e descrizione non vuoti per ogni profilo, incluso CUSTOM', () => {
    for (const profile of [...BUILTIN_PROFILES, 'CUSTOM'] as const) {
      expect(PROFILE_INFO[profile].label.length).toBeGreaterThan(0)
      expect(PROFILE_INFO[profile].description.length).toBeGreaterThan(0)
    }
  })
})

describe('fmtScore', () => {
  it('formatta un punteggio con una cifra decimale su base 100', () => {
    expect(fmtScore(87.456)).toBe('87.5/100')
    expect(fmtScore(0)).toBe('0.0/100')
  })
})

describe('fmtCriterionValue', () => {
  it('segnala i valori mancanti', () => {
    expect(fmtCriterionValue(null, 'initialCashOutflow', 'EUR')).toBe('Dato non disponibile')
  })

  it('formatta i criteri di conteggio come numero intero semplice', () => {
    expect(fmtCriterionValue(3, 'negativeMonthsCount', 'EUR')).toBe('3')
    expect(fmtCriterionValue(2, 'criticalMonthsCount', 'EUR')).toBe('2')
  })

  it('formatta il fondo di emergenza in mesi', () => {
    expect(fmtCriterionValue(4.2, 'emergencyFundMonthsAfterDecision', 'EUR')).toBe('4.2 mesi')
  })

  it('formatta gli altri criteri come valuta', () => {
    const formatted = fmtCriterionValue(1500, 'totalCashOutflow', 'EUR')
    expect(formatted).toContain('1500')
    expect(formatted).toContain('€')
  })
})
