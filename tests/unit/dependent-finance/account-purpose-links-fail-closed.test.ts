import { describe, expect, it } from 'vitest'
import {
  AccountPurposeLinksLoadError,
  filterPersonalAccounts,
  getPersonalExcludedAccountIds,
  loadAccountPurposeLinks,
  normalizeFinanceScope,
} from '@/lib/dependent-finance/calculations'

/**
 * Regression coverage for the account_purpose_links fail-open bug: several services
 * turned a FAILED scope query into [] (same shape as "query succeeded, zero rows"),
 * which downstream code reads as "no special scope" and lets DEPENDENT/DEPENDENT_AURORA/
 * ADI accounts fall back into the PERSONAL perimeter. loadAccountPurposeLinks must
 * keep these two cases distinct: [] only for a successful empty query, an exception
 * for a failed one.
 */

const personalAccountId = 'personal-1'
const auroraAccountId = 'aurora-1'
const adiAccountId = 'adi-1'
const pacAccountId = 'pac-aurora-bridge'

const accounts = [
  { id: personalAccountId, name: 'Conto corrente' },
  { id: auroraAccountId, name: 'Buoni Fruttiferi' },
  { id: adiAccountId, name: 'ADI' },
  { id: pacAccountId, name: 'Aurora piano di accumulo' },
]

describe('loadAccountPurposeLinks — fail-closed su account_purpose_links', () => {
  it('1. query riuscita con 0 righe: nessun errore, restituisce []', () => {
    expect(loadAccountPurposeLinks({ data: [], error: null })).toEqual([])
  })

  it('6. query FALLITA: deve lanciare, mai restituire []', () => {
    expect(() => loadAccountPurposeLinks({ data: null, error: { message: 'connection reset' } }))
      .toThrow(AccountPurposeLinksLoadError)
  })

  it('6b. query FALLITA con data non-null: l\'errore vince comunque su [] o su righe residue', () => {
    // Anche se il client Supabase restituisse un array (stale/parziale) insieme
    // all'errore, il fail-closed deve ignorarlo e lanciare comunque.
    expect(() => loadAccountPurposeLinks({ data: [{ account_id: auroraAccountId, purpose: 'DEPENDENT_AURORA' }], error: { message: 'timeout' } }))
      .toThrow(AccountPurposeLinksLoadError)
  })

  it('2. SUCCESS con PERSONAL: il conto personale resta incluso nel perimetro personale', () => {
    const links = loadAccountPurposeLinks({ data: [{ account_id: personalAccountId, purpose: 'PERSONAL' }], error: null }) as Array<{ account_id: string; purpose: string }>
    const personal = filterPersonalAccounts(accounts, links)
    expect(personal.map((a) => a.id)).toContain(personalAccountId)
  })

  it('3. SUCCESS con DEPENDENT: il conto viene escluso dal perimetro personale', () => {
    const links = loadAccountPurposeLinks({ data: [{ account_id: auroraAccountId, purpose: 'DEPENDENT' }], error: null }) as Array<{ account_id: string; purpose: string }>
    expect(normalizeFinanceScope('DEPENDENT')).toBe('DEPENDENT_AURORA')
    const personal = filterPersonalAccounts(accounts, links)
    expect(personal.map((a) => a.id)).not.toContain(auroraAccountId)
    expect(getPersonalExcludedAccountIds(links, accounts).has(auroraAccountId)).toBe(true)
  })

  it('4. SUCCESS con ADI: il conto viene escluso dal perimetro personale', () => {
    const links = loadAccountPurposeLinks({ data: [{ account_id: adiAccountId, purpose: 'ADI' }], error: null }) as Array<{ account_id: string; purpose: string }>
    const personal = filterPersonalAccounts(accounts, links)
    expect(personal.map((a) => a.id)).not.toContain(adiAccountId)
    expect(getPersonalExcludedAccountIds(links, accounts).has(adiAccountId)).toBe(true)
  })

  it('5. SUCCESS con PERSONAL + DEPENDENT (PAC Aurora dual-scope): incluso nel personale e in Aurora', () => {
    const links = loadAccountPurposeLinks({
      data: [
        { account_id: pacAccountId, purpose: 'PERSONAL' },
        { account_id: pacAccountId, purpose: 'DEPENDENT' },
      ],
      error: null,
    }) as Array<{ account_id: string; purpose: string }>
    const personal = filterPersonalAccounts(accounts, links)
    expect(personal.map((a) => a.id)).toContain(pacAccountId)
    // Il conto dual-scope non deve comparire tra gli esclusi dal personale...
    expect(getPersonalExcludedAccountIds(links, accounts).has(pacAccountId)).toBe(false)
    // ...ma resta comunque riconoscibile come Aurora per le viste dedicate.
    const auroraLinks = links.filter((link) => normalizeFinanceScope(link.purpose) === 'DEPENDENT_AURORA')
    expect(auroraLinks.map((l) => l.account_id)).toContain(pacAccountId)
  })
})
