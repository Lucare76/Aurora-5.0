import { describe, expect, it } from 'vitest'
import { suggestCategory, suggestCompatibleCategoryId } from '@/lib/categorize'

const disoccupazione = { id: 'cat-disoccupazione', name: 'Disoccupazione', type: 'income' as const, parent_id: null }
const uscite = { id: 'cat-uscite', name: 'Uscite varie', type: 'expense' as const, parent_id: null }
const regali = { id: 'cat-regali', name: 'Regali', type: 'expense' as const, parent_id: 'cat-uscite' }
const categories = [disoccupazione, uscite, regali]

describe('suggestCategory — regola BONIFICO generica rimossa', () => {
  it('"BONIFICO SEPA ISTANTANEO" da solo non suggerisce più nulla (la regola generica è stata rimossa)', () => {
    expect(suggestCategory('BONIFICO SEPA ISTANTANEO')).toBeNull()
  })

  it('"INPS" continua a suggerire Disoccupazione (regola specifica, invariata)', () => {
    expect(suggestCategory('BONIFICO SEPA Da INPS')?.category).toBe('Disoccupazione')
    expect(suggestCategory('INPS TRN')?.category).toBe('Disoccupazione')
  })
})

describe('suggestCompatibleCategoryId — non deve mai proporre una categoria incompatibile col type reale', () => {
  it('7. "BONIFICO SEPA Da INPS" su transazione income -> può diventare Disoccupazione', () => {
    expect(suggestCompatibleCategoryId('BONIFICO SEPA Da INPS', 'income', categories)).toBe(disoccupazione.id)
  })

  it('8. "INPS TRN" su transazione income -> può diventare Disoccupazione', () => {
    expect(suggestCompatibleCategoryId('INPS TRN', 'income', categories)).toBe(disoccupazione.id)
  })

  it('9. semplice "BONIFICO SEPA ISTANTANEO" su transazione expense -> NON deve diventare Disoccupazione (nessuna regola matcha più, quindi nessun suggerimento)', () => {
    expect(suggestCompatibleCategoryId('BONIFICO SEPA ISTANTANEO', 'expense', categories)).toBeNull()
  })

  it('10. "BONIFICO SEPA ISTANTANEO ... PER Prestito infruttifero familiare" su transazione expense -> NON deve diventare Disoccupazione (caso reale)', () => {
    expect(suggestCompatibleCategoryId('BONIFICO SEPA ISTANTANEO A FAVORE DI ... PER Prestito infruttifero familiare', 'expense', categories)).toBeNull()
  })

  it('guardia di compatibilità: anche se una regola matchasse comunque una categoria income su una transazione expense, il risultato resta null', () => {
    // Simula il caso "la regola testuale ha comunque proposto Disoccupazione" per
    // dimostrare che è la verifica di compatibilità, e non solo l'assenza della
    // regola BONIFICO, a proteggere da questo errore.
    const inpsButExpense = suggestCompatibleCategoryId('INPS TRN', 'expense', categories)
    expect(inpsButExpense).toBeNull()
  })

  it('descrizione senza alcun match noto -> nessun suggerimento, nessun errore', () => {
    expect(suggestCompatibleCategoryId('ACQUISTO CARTA DI CREDITO XYZ', 'expense', categories)).toBeNull()
  })
})
