import type { ScenarioAssumptions } from './types'

export const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  includeActiveRecurring: true,
  includeGoalContributions: true,
  goalContributionSource: 'recent_average',
  loanPaymentSource: 'recent_average',
  excludedAccountIds: [],
}

// Descriptions shown in the UI for each assumption
export const ASSUMPTION_DESCRIPTIONS: Record<keyof ScenarioAssumptions, string> = {
  includeActiveRecurring:
    'Le ricorrenze attive continuano secondo la loro frequenza e durata.',
  includeGoalContributions:
    'I contributi agli obiettivi vengono stimati sulla base della media recente.',
  goalContributionSource:
    'Fonte del contributo mensile stimato: media degli ultimi 3 mesi.',
  loanPaymentSource:
    'Rata mensile stimata dai pagamenti registrati recentemente.',
  excludedAccountIds:
    'Conti esclusi dal calcolo del saldo iniziale.',
}

// Fixed assumptions always applied (not user-configurable in v1)
export const FIXED_ASSUMPTION_DESCRIPTIONS: string[] = [
  'Le entrate non ricorrenti non vengono replicate automaticamente.',
  'I budget non producono automaticamente spese.',
  'Nessuna inflazione né interesse impliciti.',
  'Nessun rendimento su investimenti.',
  'Nessuna variazione automatica degli importi.',
  'Il saldo negativo non genera automaticamente debito.',
]
