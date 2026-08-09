import type { IntentPattern } from './types'

export const assistantIntentPatterns: IntentPattern[] = [
  {
    intent: 'personal.income_expense_summary',
    confidence: 'HIGH',
    patterns: [/quanto ho speso/, /entrate.*uscite/, /uscite.*entrate/, /margine/, /saldo netto/],
  },
  {
    intent: 'personal.spending_by_category',
    confidence: 'HIGH',
    patterns: [/spese principali/, /categorie.*pesano/, /speso.*categoria/, /uscite.*categoria/, /dove ho speso.*(piu|di piu)/],
  },
  {
    intent: 'personal.financial_summary',
    confidence: 'HIGH',
    patterns: [/quanto ho sul conto/, /patrimonio/, /saldo totale/, /riepilogo finanziario/],
  },
  {
    intent: 'personal.emergency_fund_status',
    confidence: 'HIGH',
    patterns: [/mesi.*senza reddito/, /fondo emergenza/, /quanti mesi resisto/, /copertura/],
  },
  {
    intent: 'personal.budget_summary',
    confidence: 'HIGH',
    patterns: [/budget/, /come stanno andando i budget/],
  },
  {
    intent: 'personal.goal_summary',
    confidence: 'HIGH',
    patterns: [/obiettivo/, /obiettivi/, /a che punto.*risparmio/],
  },
  {
    intent: 'personal.financial_health_explanation',
    confidence: 'HIGH',
    patterns: [/financial health/, /salute finanziaria/, /score/, /punteggio/],
  },
  {
    intent: 'affordability.car',
    confidence: 'MEDIUM',
    needsAmount: true,
    patterns: [/posso permettermi.*auto/, /macchina/, /kona/],
  },
  {
    intent: 'affordability.home',
    confidence: 'MEDIUM',
    needsAmount: true,
    patterns: [/posso permettermi.*casa/, /mutuo/, /immobile/],
  },
  {
    intent: 'affordability.travel',
    confidence: 'MEDIUM',
    needsAmount: true,
    patterns: [/posso permettermi.*vacanza/, /viaggio/],
  },
  {
    intent: 'affordability.generic',
    confidence: 'HIGH',
    needsAmount: true,
    patterns: [/posso permettermi/, /sostenibile.*spesa/, /spesa di/],
  },
  {
    intent: 'decision.compare',
    confidence: 'MEDIUM',
    patterns: [/confronta/, /alternative/, /scelta migliore/],
  },
  {
    intent: 'aurora.savings_summary',
    scope: 'AURORA',
    confidence: 'HIGH',
    patterns: [/risparmi di aurora/, /patrimonio aurora/, /conto aurora/],
  },
  {
    intent: 'adi.summary',
    scope: 'ADI',
    confidence: 'HIGH',
    patterns: [/\badi\b/, /assegno di inclusione/],
  },
]
