export type FinancialLanguageProviderInput = {
  instruction: string
  facts: string[]
}

export type FinancialLanguageProvider = {
  name: string
  generate: (input: FinancialLanguageProviderInput) => Promise<string>
}

export const deterministicFinancialLanguageProvider: FinancialLanguageProvider = {
  name: 'deterministic-read-only',
  async generate(input) {
    return [input.instruction, ...input.facts].filter(Boolean).join('\n')
  },
}

