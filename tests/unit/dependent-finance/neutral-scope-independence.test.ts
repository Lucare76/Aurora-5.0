import { describe, expect, it } from 'vitest'
import { filterPersonalTransactions, filterTransactionsByScope } from '@/lib/dependent-finance/calculations'

const links = [
  { account_id: 'acc-aurora', purpose: 'DEPENDENT_AURORA' },
  { account_id: 'acc-adi', purpose: 'ADI' },
]

describe('12. un movimento neutro PERSONAL non altera i perimetri DEPENDENT_AURORA/ADI', () => {
  const transactions = [
    { id: 't-personal-neutral', account_id: 'acc-personal', is_neutral: true },
    { id: 't-personal-real', account_id: 'acc-personal', is_neutral: false },
    { id: 't-aurora', account_id: 'acc-aurora', is_neutral: false },
    { id: 't-adi', account_id: 'acc-adi', is_neutral: false },
  ]

  it('scope filtering is keyed only on account_id — is_neutral never influences it', () => {
    const auroraScoped = filterTransactionsByScope(transactions, links, 'DEPENDENT_AURORA')
    const adiScoped = filterTransactionsByScope(transactions, links, 'ADI')
    const personalScoped = filterPersonalTransactions(transactions, links)

    expect(auroraScoped.map((t) => t.id)).toEqual(['t-aurora'])
    expect(adiScoped.map((t) => t.id)).toEqual(['t-adi'])
    expect(personalScoped.map((t) => t.id).sort()).toEqual(['t-personal-neutral', 't-personal-real'])
  })

  it('marking the PERSONAL transaction neutral does not move it into another scope', () => {
    const withoutNeutral = filterTransactionsByScope(transactions.filter((t) => t.id !== 't-personal-neutral'), links, 'DEPENDENT_AURORA')
    const withNeutral = filterTransactionsByScope(transactions, links, 'DEPENDENT_AURORA')
    expect(withNeutral).toEqual(withoutNeutral)
  })
})
