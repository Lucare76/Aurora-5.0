import { describe, it, expect } from 'vitest'
import {
  getActionRegistryEntry, getAllActionCodes, getActionsByCategory,
  isKnownActionCode, SCENARIO_TEMPLATES,
} from '@/lib/scenarios/registry'
import { ACTION_CODES } from '@/lib/scenarios/constants'

describe('getActionRegistryEntry', () => {
  it('returns entry for known code', () => {
    const e = getActionRegistryEntry('ONE_TIME_EXPENSE')
    expect(e).toBeDefined()
    expect(e?.code).toBe('ONE_TIME_EXPENSE')
    expect(e?.category).toBe('expense')
  })

  it('returns undefined for unknown code', () => {
    expect(getActionRegistryEntry('UNKNOWN_CODE' as never)).toBeUndefined()
  })
})

describe('getAllActionCodes', () => {
  it('returns all 16 action codes', () => {
    const codes = getAllActionCodes()
    expect(codes).toHaveLength(ACTION_CODES.length)
    expect(codes).toContain('ONE_TIME_EXPENSE')
    expect(codes).toContain('ACCOUNT_BALANCE_ADJUSTMENT')
  })
})

describe('getActionsByCategory (no arg)', () => {
  it('returns a Record keyed by category', () => {
    const byCat = getActionsByCategory()
    expect(typeof byCat).toBe('object')
    expect(Array.isArray(byCat['expense'])).toBe(true)
    expect(Array.isArray(byCat['income'])).toBe(true)
    expect(Array.isArray(byCat['loan'])).toBe(true)
  })

  it('covers all 16 codes', () => {
    const byCat = getActionsByCategory()
    const flat = Object.values(byCat).flat()
    expect(flat).toHaveLength(ACTION_CODES.length)
  })
})

describe('getActionsByCategory (with category)', () => {
  it('returns entries for the given category', () => {
    const entries = getActionsByCategory('expense')
    expect(entries.length).toBeGreaterThan(0)
    entries.forEach((e) => expect(e.category).toBe('expense'))
  })
})

describe('isKnownActionCode', () => {
  it('returns true for valid codes', () => {
    expect(isKnownActionCode('ONE_TIME_EXPENSE')).toBe(true)
    expect(isKnownActionCode('NEW_LOAN')).toBe(true)
  })

  it('returns false for unknown codes', () => {
    expect(isKnownActionCode('DOES_NOT_EXIST')).toBe(false)
    expect(isKnownActionCode(42)).toBe(false)
    expect(isKnownActionCode(null)).toBe(false)
  })
})

describe('SCENARIO_TEMPLATES', () => {
  it('has at least 1 template', () => {
    expect(SCENARIO_TEMPLATES.length).toBeGreaterThan(0)
  })

  it('each template has required fields', () => {
    for (const t of SCENARIO_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.icon).toBeTruthy()
      expect(Array.isArray(t.seedActions)).toBe(true)
      expect(t.defaultHorizonMonths).toBeGreaterThan(0)
    }
  })
})
