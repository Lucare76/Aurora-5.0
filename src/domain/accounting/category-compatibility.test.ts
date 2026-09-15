import { describe, expect, it } from 'vitest'
import { isCategoryCompatibleWithTransactionType } from './category-compatibility'

describe('isCategoryCompatibleWithTransactionType', () => {
  it('1. income + income => valido', () => {
    expect(isCategoryCompatibleWithTransactionType('income', 'income')).toBe(true)
  })

  it('2. income + both => valido', () => {
    expect(isCategoryCompatibleWithTransactionType('income', 'both')).toBe(true)
  })

  it('3. income + expense => invalido', () => {
    expect(isCategoryCompatibleWithTransactionType('income', 'expense')).toBe(false)
  })

  it('4. expense + expense => valido', () => {
    expect(isCategoryCompatibleWithTransactionType('expense', 'expense')).toBe(true)
  })

  it('5. expense + both => valido', () => {
    expect(isCategoryCompatibleWithTransactionType('expense', 'both')).toBe(true)
  })

  it('6. expense + income => invalido', () => {
    expect(isCategoryCompatibleWithTransactionType('expense', 'income')).toBe(false)
  })

  it('transfer non e mai compatibile con una categoria normale, qualunque sia il suo type', () => {
    expect(isCategoryCompatibleWithTransactionType('transfer', 'income')).toBe(false)
    expect(isCategoryCompatibleWithTransactionType('transfer', 'expense')).toBe(false)
    expect(isCategoryCompatibleWithTransactionType('transfer', 'both')).toBe(false)
  })
})
