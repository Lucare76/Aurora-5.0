import { describe, it, expect } from 'vitest'
import {
  buildComparePayload,
  buildScenarioInput,
  canStartComparison,
  createEmptyDraft,
  generateScenarioId,
  getMissingFields,
  hasDuplicateLabels,
  isDraftComplete,
  validateCustomWeights,
  validateScenarioCount,
  type ScenarioDraft,
} from './types'

function filledGeneric(id: string, overrides: Partial<Record<string, string>> = {}): ScenarioDraft {
  const draft = createEmptyDraft(id, 'generic')
  draft.fields = {
    purchaseName: 'Frigorifero',
    totalPrice: '500',
    paymentMode: 'IMMEDIATE',
    purchaseDate: '2026-08-01',
    installmentAmount: '',
    numberOfInstallments: '',
    ...overrides,
  }
  return draft
}

describe('validateScenarioCount', () => {
  it('rifiuta meno di 2 scenari', () => {
    expect(validateScenarioCount(1).ok).toBe(false)
  })
  it('rifiuta più di 4 scenari', () => {
    expect(validateScenarioCount(5).ok).toBe(false)
  })
  it('accetta tra 2 e 4 scenari', () => {
    expect(validateScenarioCount(2).ok).toBe(true)
    expect(validateScenarioCount(4).ok).toBe(true)
  })
})

describe('getMissingFields / isDraftComplete', () => {
  it('segnala i campi obbligatori mancanti per uno scenario generico vuoto', () => {
    const draft = createEmptyDraft('s1', 'generic')
    const missing = getMissingFields('generic', draft.fields)
    expect(missing).toContain('Nome acquisto')
    expect(missing).toContain('Prezzo totale (€)')
    expect(isDraftComplete(draft)).toBe(false)
  })

  it('non richiede rata/numero rate quando il pagamento è immediato', () => {
    const draft = filledGeneric('s1')
    expect(isDraftComplete(draft)).toBe(true)
  })

  it('richiede rata e numero rate quando il pagamento è rateale', () => {
    const draft = filledGeneric('s1', { paymentMode: 'INSTALLMENTS', installmentAmount: '', numberOfInstallments: '' })
    const missing = getMissingFields('generic', draft.fields)
    expect(missing).toContain('Rata mensile (€)')
    expect(missing).toContain('Numero rate')
  })

  it('è completo quando rata e numero rate sono presenti in modalità rateale', () => {
    const draft = filledGeneric('s1', { paymentMode: 'INSTALLMENTS', installmentAmount: '100', numberOfInstallments: '12' })
    expect(isDraftComplete(draft)).toBe(true)
  })
})

describe('canStartComparison', () => {
  it('blocca con meno di 2 scenari completi', () => {
    const result = canStartComparison([filledGeneric('s1')])
    expect(result.ok).toBe(false)
  })

  it('blocca con più di 4 scenari', () => {
    const drafts = [filledGeneric('s1'), filledGeneric('s2'), filledGeneric('s3'), filledGeneric('s4'), filledGeneric('s5')]
    expect(canStartComparison(drafts).ok).toBe(false)
  })

  it('blocca se uno scenario è incompleto', () => {
    const incomplete = createEmptyDraft('s2', 'car')
    const result = canStartComparison([filledGeneric('s1'), incomplete])
    expect(result.ok).toBe(false)
  })

  it('permette il confronto con 2-4 scenari completi', () => {
    const result = canStartComparison([filledGeneric('s1'), filledGeneric('s2')])
    expect(result.ok).toBe(true)
    expect(result.reason).toBeNull()
  })
})

describe('hasDuplicateLabels', () => {
  it('rileva nomi scenario duplicati (case-insensitive)', () => {
    const a = filledGeneric('s1', { purchaseName: 'Auto Nuova' })
    const b = filledGeneric('s2', { purchaseName: 'auto nuova' })
    expect(hasDuplicateLabels([a, b])).toBe(true)
  })

  it('non segnala falsi positivi per nomi distinti', () => {
    const a = filledGeneric('s1', { purchaseName: 'Auto A' })
    const b = filledGeneric('s2', { purchaseName: 'Auto B' })
    expect(hasDuplicateLabels([a, b])).toBe(false)
  })
})

describe('buildScenarioInput', () => {
  it('converte i campi numerici e imposta EUR come valuta', () => {
    const input = buildScenarioInput(filledGeneric('s1'))
    expect(input.currency).toBe('EUR')
    expect(input.totalPrice).toBe(500)
    expect(typeof input.totalPrice).toBe('number')
  })

  it('arrotonda a intero i campi interi come numberOfInstallments', () => {
    const draft = filledGeneric('s1', { paymentMode: 'INSTALLMENTS', installmentAmount: '100', numberOfInstallments: '12.7' })
    const input = buildScenarioInput(draft)
    expect(input.numberOfInstallments).toBe(12)
  })

  it('omette i campi vuoti invece di inviare stringhe vuote', () => {
    const input = buildScenarioInput(filledGeneric('s1'))
    expect('installmentAmount' in input).toBe(false)
  })

  it('non muta lo scenario di input passato', () => {
    const draft = filledGeneric('s1')
    const before = JSON.stringify(draft)
    buildScenarioInput(draft)
    expect(JSON.stringify(draft)).toBe(before)
  })
})

describe('buildComparePayload', () => {
  it('include customWeights solo per il profilo CUSTOM', () => {
    const drafts = [filledGeneric('s1'), filledGeneric('s2')]
    const balanced = buildComparePayload(drafts, 'BALANCED', null)
    expect('customWeights' in balanced).toBe(false)

    const custom = buildComparePayload(drafts, 'CUSTOM', { initialCashOutflow: 50 })
    expect(custom.customWeights).toEqual({ initialCashOutflow: 50 })
  })

  it('include la label solo quando valorizzata', () => {
    const draft = filledGeneric('s1')
    draft.label = 'La mia scelta'
    const payload = buildComparePayload([draft, filledGeneric('s2')], 'BALANCED', null)
    expect(payload.scenarios[0].label).toBe('La mia scelta')
    expect('label' in payload.scenarios[1]).toBe(false)
  })
})

describe('validateCustomWeights', () => {
  it('rifiuta pesi negativi', () => {
    expect(validateCustomWeights({ initialCashOutflow: -1 })).not.toBeNull()
  })
  it('rifiuta somma zero', () => {
    expect(validateCustomWeights({ initialCashOutflow: 0, totalCashOutflow: 0 })).not.toBeNull()
  })
  it('accetta almeno un peso positivo', () => {
    expect(validateCustomWeights({ initialCashOutflow: 10 })).toBeNull()
  })
})

describe('generateScenarioId', () => {
  it('genera ID univoci', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateScenarioId()))
    expect(ids.size).toBe(20)
  })
})
