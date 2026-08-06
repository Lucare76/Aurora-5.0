import { buildAdiSummary, buildAuroraScopeSummary } from '@/lib/dependent-finance/calculations'
import { evidence, formatCurrency, money, sumBy } from '../evidence'
import { buildAssistantResult, needsInputResult } from '../response-contract'
import type { AssistantContext, AssistantResult, AssistantTool, FinancialAssistantIntent, MissingInput } from '../types'

function mainCitation(context: AssistantContext, table: string): string[] {
  return context.citations.filter((citation) => citation.table === table).map((citation) => citation.id)
}

function income(context: AssistantContext): number {
  return sumBy(context.transactions.filter((tx) => tx.type === 'income' && !tx.transfer_peer_id), (tx) => tx.amount)
}

function expenses(context: AssistantContext): number {
  return sumBy(context.transactions.filter((tx) => tx.type === 'expense' && !tx.transfer_peer_id), (tx) => tx.amount)
}

function totalBalance(context: AssistantContext): number {
  return sumBy(context.accounts.filter((account) => account.is_active), (account) => account.balance)
}

function standardResult(
  context: AssistantContext,
  intent: FinancialAssistantIntent,
  params: Omit<Parameters<typeof buildAssistantResult>[0], 'intent' | 'scope' | 'citations'>,
): AssistantResult {
  return buildAssistantResult({
    intent,
    scope: context.scope,
    citations: context.citations,
    ...params,
  })
}

function missingAffordabilityInput(intent: FinancialAssistantIntent, scope: AssistantContext['scope'], fields: MissingInput[]): AssistantResult {
  return needsInputResult({
    intent,
    scope,
    answer: 'Posso fare questa simulazione, ma prima servono alcuni dati essenziali.',
    missingInputs: fields,
  })
}

export const financialAssistantTools: AssistantTool[] = [
  {
    intent: 'personal.financial_summary',
    label: 'Riepilogo finanziario personale',
    description: 'Sintesi di patrimonio, entrate, uscite e saldo netto del periodo.',
    scope: 'PERSONAL',
    readOnly: true,
    execute: ({ context }) => {
      const balance = totalBalance(context)
      const inTotal = income(context)
      const outTotal = expenses(context)
      const net = money(inTotal - outTotal)
      return standardResult(context, 'personal.financial_summary', {
        answer: `Nel ${context.period.label} il patrimonio personale e ${formatCurrency(balance)} e il saldo netto e ${formatCurrency(net)}.`,
        summary: [
          `Patrimonio personale: ${formatCurrency(balance)}`,
          `Entrate: ${formatCurrency(inTotal)}`,
          `Uscite: ${formatCurrency(outTotal)}`,
          `Saldo netto: ${formatCurrency(net)}`,
        ],
        evidence: [
          evidence('patrimonio_personale', balance, mainCitation(context, 'accounts'), 'EUR'),
          evidence('entrate_periodo', inTotal, mainCitation(context, 'transactions'), 'EUR'),
          evidence('uscite_periodo', outTotal, mainCitation(context, 'transactions'), 'EUR'),
        ],
      })
    },
  },
  {
    intent: 'personal.income_expense_summary',
    label: 'Entrate e uscite',
    description: 'Confronto entrate, uscite e risparmio netto.',
    scope: 'PERSONAL',
    readOnly: true,
    execute: ({ context }) => {
      const inTotal = income(context)
      const outTotal = expenses(context)
      const net = money(inTotal - outTotal)
      return standardResult(context, 'personal.income_expense_summary', {
        answer: `Nel ${context.period.label} hai registrato ${formatCurrency(inTotal)} di entrate e ${formatCurrency(outTotal)} di uscite.`,
        summary: [`Entrate: ${formatCurrency(inTotal)}`, `Uscite: ${formatCurrency(outTotal)}`, `Differenza: ${formatCurrency(net)}`],
        evidence: [evidence('entrate', inTotal, mainCitation(context, 'transactions'), 'EUR'), evidence('uscite', outTotal, mainCitation(context, 'transactions'), 'EUR')],
      })
    },
  },
  {
    intent: 'personal.spending_by_category',
    label: 'Spese per categoria',
    description: 'Classifica delle uscite per categoria.',
    scope: 'PERSONAL',
    readOnly: true,
    execute: ({ context }) => {
      const names = new Map(context.categories.map((category) => [category.id, category.name]))
      const totals = new Map<string, number>()
      for (const tx of context.transactions.filter((item) => item.type === 'expense')) {
        const key = tx.category_id ? names.get(tx.category_id) ?? 'Categoria sconosciuta' : 'Senza categoria'
        totals.set(key, money((totals.get(key) ?? 0) + tx.amount))
      }
      const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      return standardResult(context, 'personal.spending_by_category', {
        answer: top.length > 0 ? `La categoria con piu uscite e ${top[0][0]} con ${formatCurrency(top[0][1])}.` : 'Non ci sono uscite categorizzate nel periodo selezionato.',
        summary: top.map(([name, total]) => `${name}: ${formatCurrency(total)}`),
        evidence: top.map(([name, total]) => evidence(`spesa_${name}`, total, mainCitation(context, 'transactions'), 'EUR')),
      })
    },
  },
  {
    intent: 'personal.emergency_fund_status',
    label: 'Fondo emergenza',
    description: 'Stima quanti mesi di uscite sono coperti dalla liquidita disponibile.',
    scope: 'PERSONAL',
    readOnly: true,
    execute: ({ context }) => {
      const liquid = sumBy(context.accounts.filter((account) => account.is_active && ['checking', 'savings', 'cash'].includes(account.type ?? '')), (account) => account.balance)
      const outTotal = expenses(context)
      const monthlyExpense = context.period.key === 'LAST_3_MONTHS' ? outTotal / 3 : outTotal
      const months = monthlyExpense > 0 ? money(liquid / monthlyExpense) : null
      return standardResult(context, 'personal.emergency_fund_status', {
        answer: months === null ? 'Non ho abbastanza uscite nel periodo per stimare il fondo emergenza.' : `La liquidita copre circa ${months} mesi di uscite.`,
        summary: [`Liquidita stimata: ${formatCurrency(liquid)}`, `Uscite mensili considerate: ${formatCurrency(monthlyExpense)}`, `Copertura: ${months ?? 'non calcolabile'} mesi`],
        evidence: [evidence('liquidita', liquid, mainCitation(context, 'accounts'), 'EUR'), evidence('mesi_copertura', months, mainCitation(context, 'transactions'), 'MONTHS')],
      })
    },
  },
  {
    intent: 'personal.budget_summary',
    label: 'Riepilogo budget',
    description: 'Budget totale, speso e rimanente.',
    scope: 'PERSONAL',
    readOnly: true,
    execute: ({ context }) => {
      const now = context.runtime.now
      const budgets = context.budgets.filter((budget) => (!budget.month || budget.month === now.getMonth() + 1) && (!budget.year || budget.year === now.getFullYear()))
      const total = sumBy(budgets, (budget) => budget.amount)
      const spent = expenses(context)
      const remaining = money(total - spent)
      return standardResult(context, 'personal.budget_summary', {
        answer: total > 0 ? `Hai ${formatCurrency(remaining)} rimanenti sui budget del mese.` : 'Non ci sono budget configurati per il mese corrente.',
        summary: [`Budget totale: ${formatCurrency(total)}`, `Speso: ${formatCurrency(spent)}`, `Rimanente: ${formatCurrency(remaining)}`],
        evidence: [evidence('budget_totale', total, [], 'EUR'), evidence('budget_speso', spent, mainCitation(context, 'transactions'), 'EUR')],
      })
    },
  },
  {
    intent: 'personal.goal_summary',
    label: 'Riepilogo obiettivi',
    description: 'Avanzamento degli obiettivi di risparmio.',
    scope: 'PERSONAL',
    readOnly: true,
    execute: ({ context }) => {
      const target = sumBy(context.goals, (goal) => goal.target_amount)
      const current = sumBy(context.goals, (goal) => goal.current_amount)
      const completed = context.goals.filter((goal) => goal.status === 'COMPLETED').length
      return standardResult(context, 'personal.goal_summary', {
        answer: context.goals.length > 0 ? `Hai accumulato ${formatCurrency(current)} su ${formatCurrency(target)} negli obiettivi.` : 'Non ci sono obiettivi di risparmio configurati.',
        summary: [`Obiettivi: ${context.goals.length}`, `Completati: ${completed}`, `Accumulato: ${formatCurrency(current)}`],
        evidence: [evidence('obiettivi_accumulato', current, [], 'EUR'), evidence('obiettivi_target', target, [], 'EUR')],
      })
    },
  },
  {
    intent: 'personal.financial_health_explanation',
    label: 'Spiegazione salute finanziaria',
    description: 'Spiega i principali fattori che incidono sulla salute finanziaria.',
    scope: 'PERSONAL',
    readOnly: true,
    execute: ({ context }) => {
      const balance = totalBalance(context)
      const net = money(income(context) - expenses(context))
      const severity = net >= 0 ? 'success' : 'warning'
      return standardResult(context, 'personal.financial_health_explanation', {
        answer: net >= 0 ? 'La salute finanziaria beneficia di un saldo netto positivo nel periodo.' : 'La salute finanziaria risente di uscite superiori alle entrate nel periodo.',
        summary: [`Patrimonio personale: ${formatCurrency(balance)}`, `Saldo netto periodo: ${formatCurrency(net)}`],
        insights: [{ title: 'Fattore principale', detail: `Saldo netto del periodo: ${formatCurrency(net)}`, severity, evidenceIds: ['saldo_netto'] }],
        evidence: [evidence('saldo_netto', net, mainCitation(context, 'transactions'), 'EUR')],
      })
    },
  },
  {
    intent: 'aurora.savings_summary',
    label: 'Riepilogo Aurora',
    description: 'Sintesi dei conti e movimenti Aurora autorizzati.',
    scope: 'AURORA',
    readOnly: true,
    execute: ({ context }) => {
      const summary = buildAuroraScopeSummary({ accounts: context.accounts, transactions: context.transactions, links: context.accounts.map((account) => ({ account_id: account.id, purpose: 'DEPENDENT_AURORA' })), from: context.period.from ?? undefined, to: context.period.to ?? undefined })
      return standardResult(context, 'aurora.savings_summary', {
        answer: `Il patrimonio Aurora e ${formatCurrency(summary.balance)} su ${summary.activeAccountsCount} conti attivi.`,
        summary: [`Patrimonio Aurora: ${formatCurrency(summary.balance)}`, `Versamenti: ${formatCurrency(summary.transfersIn)}`, `Prelievi: ${formatCurrency(summary.transfersOut)}`],
        evidence: [evidence('aurora_balance', summary.balance, mainCitation(context, 'accounts'), 'EUR'), evidence('aurora_transfers_in', summary.transfersIn, mainCitation(context, 'transactions'), 'EUR')],
      })
    },
  },
  {
    intent: 'adi.summary',
    label: 'Riepilogo ADI',
    description: 'Sintesi delle entrate, spese e utilizzo ADI autorizzati.',
    scope: 'ADI',
    readOnly: true,
    execute: ({ context }) => {
      const summary = buildAdiSummary(context.adiEntries)
      return standardResult(context, 'adi.summary', {
        answer: `ADI mostra ${formatCurrency(summary.received)} ricevuti e ${formatCurrency(summary.spent)} spesi.`,
        summary: [`Ricevuto: ${formatCurrency(summary.received)}`, `Speso: ${formatCurrency(summary.spent)}`, `Saldo ADI: ${formatCurrency(summary.balance)}`],
        evidence: [evidence('adi_received', summary.received, mainCitation(context, 'adi_entries'), 'EUR'), evidence('adi_spent', summary.spent, mainCitation(context, 'adi_entries'), 'EUR')],
      })
    },
  },
  ...(['affordability.generic', 'affordability.car', 'affordability.home', 'affordability.travel'] as const).map<AssistantTool>((intent) => ({
    intent,
    label: intent.includes('car') ? 'Posso permettermi questa auto?' : intent.includes('home') ? 'Posso permettermi questa casa?' : intent.includes('travel') ? 'Posso permettermi questa vacanza?' : 'Posso permettermelo?',
    description: 'Adapter read-only verso i motori di sostenibilita economica.',
    scope: 'PERSONAL' as const,
    readOnly: true as const,
    execute: ({ context, query }) => {
      const price = Number(query.parameters?.price ?? query.parameters?.purchasePrice ?? query.parameters?.totalCost)
      if (!Number.isFinite(price) || price <= 0) {
        return missingAffordabilityInput(intent, context.scope, [{ field: 'price', label: 'Costo previsto', reason: 'Serve un importo maggiore di zero per avviare la simulazione.' }])
      }
      return standardResult(context, intent, {
        answer: 'Il motore di sostenibilita e pronto: questa risposta read-only usa i tuoi dati personali come contesto minimo.',
        summary: [`Costo indicato: ${formatCurrency(price)}`, `Patrimonio personale disponibile: ${formatCurrency(totalBalance(context))}`],
        evidence: [evidence('purchase_price', money(price), [], 'EUR'), evidence('personal_balance', totalBalance(context), mainCitation(context, 'accounts'), 'EUR')],
      })
    },
  })),
  {
    intent: 'decision.compare',
    label: 'Confronto decisioni',
    description: 'Adapter read-only verso il Decision Comparison Engine.',
    scope: 'PERSONAL',
    readOnly: true,
    execute: ({ context, query }) => {
      const scenarios = Array.isArray(query.parameters?.scenarios) ? query.parameters.scenarios : []
      if (scenarios.length < 2) {
        return missingAffordabilityInput('decision.compare', context.scope, [{ field: 'scenarios', label: 'Scenari da confrontare', reason: 'Servono almeno due scenari per il confronto.' }])
      }
      return standardResult(context, 'decision.compare', {
        answer: 'Il confronto decisionale e pronto e resta in sola lettura.',
        summary: [`Scenari ricevuti: ${scenarios.length}`, `Contesto personale: ${context.accounts.length} conti e ${context.transactions.length} movimenti`],
        evidence: [evidence('scenario_count', scenarios.length, [], 'COUNT')],
      })
    },
  },
]
