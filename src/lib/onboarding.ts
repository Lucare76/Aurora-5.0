export type OnboardingStatus = {
  onboardingDone: boolean
  hasAccount: boolean
  hasCategory: boolean
  hasMovement: boolean
  hasBudget: boolean
}

export const onboardingSteps = [
  {
    key: 'hasAccount',
    title: 'Aggiungi il primo conto',
    description: 'Inserisci almeno un conto reale con il saldo di partenza.',
    href: '/accounts?onboarding=1',
    action: 'Configura i conti',
    required: true,
  },
  {
    key: 'hasCategory',
    title: 'Controlla le categorie',
    description: 'Verifica che entrate e spese siano organizzate come preferisci.',
    href: '/categories?onboarding=1',
    action: 'Apri le categorie',
    required: true,
  },
  {
    key: 'hasMovement',
    title: 'Registra il primo movimento',
    description: 'Aggiungi un’entrata, un’uscita o un trasferimento per iniziare lo storico.',
    href: '/transactions?onboarding=1',
    action: 'Aggiungi un movimento',
    required: true,
  },
  {
    key: 'hasBudget',
    title: 'Imposta un budget',
    description: 'Facoltativo: definisci un limite di spesa per una categoria.',
    href: '/budgets?onboarding=1',
    action: 'Crea un budget',
    required: false,
  },
] as const

export function isOnboardingCoreComplete(status: Pick<OnboardingStatus, 'hasAccount' | 'hasCategory' | 'hasMovement'>): boolean {
  return status.hasAccount && status.hasCategory && status.hasMovement
}

export function onboardingProgress(status: OnboardingStatus): number {
  const completed = [status.hasAccount, status.hasCategory, status.hasMovement].filter(Boolean).length
  return Math.round((completed / 3) * 100)
}
