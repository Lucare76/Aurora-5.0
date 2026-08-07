import { describe, expect, it } from 'vitest'
import { calculateAiRequestCost } from '@/lib/financial-assistant/pricing/calculator'
import { findAiPricing } from '@/lib/financial-assistant/pricing/registry'

describe('AI pricing registry', () => {
  it('trova un modello OpenAI noto', () => {
    const pricing = findAiPricing('OPENAI', 'gpt-4.1-mini')
    expect(pricing?.inputPerMillionTokens).toBe(0.40)
    expect(pricing?.outputPerMillionTokens).toBe(1.60)
  })

  it('ritorna costo non disponibile per modello sconosciuto', () => {
    const cost = calculateAiRequestCost({
      provider: 'OPENAI',
      model: 'unknown-model',
      inputTokens: 1000,
      outputTokens: 1000,
    })
    expect(cost.pricingFound).toBe(false)
    expect(cost.totalCost).toBeNull()
  })

  it('calcola input, output e totale con precisione', () => {
    const cost = calculateAiRequestCost({
      provider: 'OPENAI',
      model: 'gpt-4.1-mini',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    })
    expect(cost.inputCost).toBe(0.4)
    expect(cost.outputCost).toBe(0.8)
    expect(cost.totalCost).toBe(1.2)
  })

  it('gestisce zero token e valori grandi', () => {
    expect(calculateAiRequestCost({
      provider: 'OPENAI',
      model: 'gpt-5-mini',
      inputTokens: 0,
      outputTokens: 0,
    }).totalCost).toBe(0)

    expect(calculateAiRequestCost({
      provider: 'OPENAI',
      model: 'gpt-5-mini',
      inputTokens: 10_000_000,
      outputTokens: 10_000_000,
    }).totalCost).toBe(22.5)
  })

  it('separa il cambio modello', () => {
    const oldModel = calculateAiRequestCost({ provider: 'OPENAI', model: 'gpt-4.1-mini', inputTokens: 1_000_000, outputTokens: 1_000_000 })
    const newModel = calculateAiRequestCost({ provider: 'OPENAI', model: 'gpt-5-mini', inputTokens: 1_000_000, outputTokens: 1_000_000 })
    expect(oldModel.totalCost).not.toBe(newModel.totalCost)
  })
})
