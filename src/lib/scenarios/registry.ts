import type { ActionRegistryEntry, ScenarioActionCode, ScenarioTemplate } from './types'

// ── Action registry ───────────────────────────────────────────────────────────

const REGISTRY_ENTRIES: ActionRegistryEntry[] = [
  {
    code: 'ONE_TIME_EXPENSE',
    version: '1.0.0',
    label: 'Acquisto una tantum',
    description: 'Una spesa singola in una data specifica (acquisto, anticipo, costo imprevisto).',
    category: 'expense',
    icon: 'shopping-cart',
    affectsCashFlow: true,
    cashFlowSign: 'reduces',
  },
  {
    code: 'RECURRING_EXPENSE_ADD',
    version: '1.0.0',
    label: 'Nuova spesa ricorrente',
    description: 'Aggiunge una nuova uscita periodica (abbonamento, affitto, rata simulata).',
    category: 'expense',
    icon: 'repeat',
    affectsCashFlow: true,
    cashFlowSign: 'reduces',
  },
  {
    code: 'RECURRING_EXPENSE_UPDATE',
    version: '1.0.0',
    label: 'Modifica spesa ricorrente',
    description: 'Cambia l\'importo di una spesa ricorrente esistente a partire da una data.',
    category: 'expense',
    icon: 'pencil',
    affectsCashFlow: true,
    cashFlowSign: 'both',
  },
  {
    code: 'RECURRING_EXPENSE_REMOVE',
    version: '1.0.0',
    label: 'Elimina spesa ricorrente (simulazione)',
    description: 'Rimuove una spesa ricorrente dalla proiezione senza modificare i dati reali.',
    category: 'expense',
    icon: 'trash-2',
    affectsCashFlow: true,
    cashFlowSign: 'increases',
  },
  {
    code: 'RECURRING_INCOME_ADD',
    version: '1.0.0',
    label: 'Nuova entrata ricorrente',
    description: 'Aggiunge una nuova entrata periodica (stipendio, affitto percepito, bonus).',
    category: 'income',
    icon: 'trending-up',
    affectsCashFlow: true,
    cashFlowSign: 'increases',
  },
  {
    code: 'RECURRING_INCOME_REDUCE',
    version: '1.0.0',
    label: 'Riduzione entrata',
    description: 'Riduce un\'entrata ricorrente di un importo fisso mensile.',
    category: 'income',
    icon: 'trending-down',
    affectsCashFlow: true,
    cashFlowSign: 'reduces',
  },
  {
    code: 'RECURRING_INCOME_PAUSE',
    version: '1.0.0',
    label: 'Sospensione entrata',
    description: 'Interrompe temporaneamente un\'entrata ricorrente per un periodo definito.',
    category: 'income',
    icon: 'pause-circle',
    affectsCashFlow: true,
    cashFlowSign: 'reduces',
  },
  {
    code: 'MONTHLY_SAVINGS_CHANGE',
    version: '1.0.0',
    label: 'Variazione risparmio mensile',
    description: 'Aumenta o riduce la quota di risparmio mensile disponibile.',
    category: 'savings',
    icon: 'piggy-bank',
    affectsCashFlow: true,
    cashFlowSign: 'both',
  },
  {
    code: 'CATEGORY_SPENDING_CHANGE',
    version: '1.0.0',
    label: 'Variazione spesa per categoria',
    description: 'Modifica la spesa mensile simulata per una categoria specifica.',
    category: 'expense',
    icon: 'tag',
    affectsCashFlow: true,
    cashFlowSign: 'both',
  },
  {
    code: 'BUDGET_LIMIT_CHANGE',
    version: '1.0.0',
    label: 'Modifica limite budget',
    description: 'Cambia il limite di budget per una categoria (informativo, non modifica il cash flow).',
    category: 'budget',
    icon: 'sliders',
    affectsCashFlow: false,
    cashFlowSign: 'none',
  },
  {
    code: 'GOAL_CONTRIBUTION_CHANGE',
    version: '1.0.0',
    label: 'Variazione contributo obiettivo',
    description: 'Cambia il contributo mensile a un obiettivo di risparmio.',
    category: 'goal',
    icon: 'target',
    affectsCashFlow: true,
    cashFlowSign: 'both',
  },
  {
    code: 'GOAL_DEADLINE_CHANGE',
    version: '1.0.0',
    label: 'Modifica scadenza obiettivo',
    description: 'Anticipa o posticipa la data target di un obiettivo.',
    category: 'goal',
    icon: 'calendar',
    affectsCashFlow: false,
    cashFlowSign: 'none',
  },
  {
    code: 'GOAL_ONE_TIME_CONTRIBUTION',
    version: '1.0.0',
    label: 'Versamento straordinario obiettivo',
    description: 'Aggiunge un contributo una tantum a un obiettivo di risparmio.',
    category: 'goal',
    icon: 'gift',
    affectsCashFlow: true,
    cashFlowSign: 'reduces',
  },
  {
    code: 'LOAN_EARLY_PAYOFF',
    version: '1.0.0',
    label: 'Estinzione anticipata prestito',
    description: 'Estingue un prestito in una data specifica, eliminando le rate future simulate.',
    category: 'loan',
    icon: 'check-circle',
    affectsCashFlow: true,
    cashFlowSign: 'both',
  },
  {
    code: 'NEW_LOAN',
    version: '1.0.0',
    label: 'Nuovo prestito / finanziamento',
    description: 'Aggiunge un nuovo prestito con rata mensile personalizzata.',
    category: 'loan',
    icon: 'credit-card',
    affectsCashFlow: true,
    cashFlowSign: 'reduces',
  },
  {
    code: 'ACCOUNT_BALANCE_ADJUSTMENT',
    version: '1.0.0',
    label: 'Aggiustamento saldo iniziale',
    description: 'Modifica il saldo di partenza della simulazione (es. anticipo già effettuato).',
    category: 'account',
    icon: 'landmark',
    affectsCashFlow: true,
    cashFlowSign: 'both',
  },
]

// Registry map for O(1) lookup
const REGISTRY_MAP = new Map<ScenarioActionCode, ActionRegistryEntry>(
  REGISTRY_ENTRIES.map((e) => [e.code, e]),
)

export function getActionRegistryEntry(code: ScenarioActionCode): ActionRegistryEntry | undefined {
  return REGISTRY_MAP.get(code)
}

export function getAllActionCodes(): ScenarioActionCode[] {
  return REGISTRY_ENTRIES.map((e) => e.code)
}

export function getActionsByCategory(category: ActionRegistryEntry['category']): ActionRegistryEntry[]
export function getActionsByCategory(): Record<ActionRegistryEntry['category'], ScenarioActionCode[]>
export function getActionsByCategory(category?: ActionRegistryEntry['category']): ActionRegistryEntry[] | Record<ActionRegistryEntry['category'], ScenarioActionCode[]> {
  if (category !== undefined) {
    return REGISTRY_ENTRIES.filter((e) => e.category === category)
  }
  const result = {} as Record<ActionRegistryEntry['category'], ScenarioActionCode[]>
  for (const entry of REGISTRY_ENTRIES) {
    if (!result[entry.category]) result[entry.category] = []
    result[entry.category].push(entry.code)
  }
  return result
}

export function isKnownActionCode(code: unknown): code is ScenarioActionCode {
  return typeof code === 'string' && REGISTRY_MAP.has(code as ScenarioActionCode)
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'acquisto-importante',
    label: 'Acquisto importante',
    description: 'Cosa succede se effettuo una spesa importante?',
    icon: 'shopping-cart',
    defaultHorizonMonths: 12,
    seedActions: [
      {
        code: 'ONE_TIME_EXPENSE',
        enabled: true,
        label: 'Acquisto',
        params: { amount: 5000, date: '', description: 'Acquisto importante' },
      },
    ],
    tags: ['spesa', 'acquisto'],
  },
  {
    id: 'nuovo-finanziamento',
    label: 'Nuovo finanziamento',
    description: 'Impatto di un prestito con rate mensili.',
    icon: 'credit-card',
    defaultHorizonMonths: 24,
    seedActions: [
      {
        code: 'ONE_TIME_EXPENSE',
        enabled: true,
        label: 'Anticipo',
        params: { amount: 3000, date: '', description: 'Anticipo acquisto' },
      },
      {
        code: 'NEW_LOAN',
        enabled: true,
        label: 'Finanziamento',
        params: {
          description: 'Finanziamento',
          principalAmount: 15000,
          monthlyPayment: 300,
          numberOfPayments: 60,
          firstPaymentDate: '',
        },
      },
    ],
    tags: ['prestito', 'finanziamento', 'rata'],
  },
  {
    id: 'riduzione-entrate',
    label: 'Riduzione entrate',
    description: 'Cosa succede se le mie entrate calano temporaneamente?',
    icon: 'trending-down',
    defaultHorizonMonths: 6,
    seedActions: [
      {
        code: 'RECURRING_INCOME_REDUCE',
        enabled: true,
        label: 'Riduzione stipendio',
        params: { reductionAmount: 500, startDate: '', endDate: '' },
      },
    ],
    tags: ['entrate', 'stipendio', 'riduzione'],
  },
  {
    id: 'aumento-risparmio',
    label: 'Aumento risparmio',
    description: 'Impatto se metto da parte di più ogni mese.',
    icon: 'piggy-bank',
    defaultHorizonMonths: 12,
    seedActions: [
      {
        code: 'MONTHLY_SAVINGS_CHANGE',
        enabled: true,
        label: 'Risparmio aggiuntivo',
        params: { changeAmount: -300, startDate: '' },
      },
    ],
    tags: ['risparmio', 'obiettivo'],
  },
  {
    id: 'estinzione-prestito',
    label: 'Estinzione anticipata',
    description: 'Cosa cambia se estinguo un prestito in anticipo?',
    icon: 'check-circle',
    defaultHorizonMonths: 24,
    seedActions: [
      {
        code: 'LOAN_EARLY_PAYOFF',
        enabled: true,
        label: 'Estinzione',
        params: { loanId: '', payoffDate: '' },
      },
    ],
    tags: ['prestito', 'estinzione'],
  },
  {
    id: 'obiettivo-rapido',
    label: 'Obiettivo più rapido',
    description: 'Versamento straordinario per raggiungere prima un obiettivo.',
    icon: 'target',
    defaultHorizonMonths: 12,
    seedActions: [
      {
        code: 'GOAL_ONE_TIME_CONTRIBUTION',
        enabled: true,
        label: 'Contributo straordinario',
        params: { goalId: '', amount: 1000, date: '' },
      },
    ],
    tags: ['obiettivo', 'risparmio'],
  },
  {
    id: 'riduzione-spese',
    label: 'Riduzione spese',
    description: 'Impatto se riduco le uscite mensili per una categoria.',
    icon: 'scissors',
    defaultHorizonMonths: 12,
    seedActions: [
      {
        code: 'CATEGORY_SPENDING_CHANGE',
        enabled: true,
        label: 'Riduzione categoria',
        params: { categoryId: '', changeAmount: -150, startDate: '' },
      },
    ],
    tags: ['spese', 'categoria', 'risparmio'],
  },
  {
    id: 'personalizzato',
    label: 'Scenario personalizzato',
    description: 'Crea uno scenario con più azioni combinate.',
    icon: 'flask-conical',
    defaultHorizonMonths: 12,
    seedActions: [],
    tags: ['personalizzato'],
  },
]
