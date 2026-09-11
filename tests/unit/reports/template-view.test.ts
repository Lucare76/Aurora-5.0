import { describe, expect, it } from 'vitest'
import {
  getActiveSections,
  getAvailableTableViews,
  getCategoryMode,
  hasSection,
  resolveDefaultTableView,
  resolveInitialFilters,
} from '@/lib/reports/template-view'

const NOW = new Date('2026-07-15T12:00:00.000Z')

describe('resolveInitialFilters', () => {
  it('7. vecchio URL senza tpl: range/type di default restano current-month/both (compatibilità)', () => {
    const params = resolveInitialFilters(new URLSearchParams(), NOW)
    expect(params.get('range')).toBe('current-month')
    expect(params.get('type')).toBe('both')
    expect(params.get('tpl')).toBeNull()
  })

  it('7b. vecchio URL manuale con range/type espliciti continua a funzionare invariato', () => {
    const params = resolveInitialFilters(new URLSearchParams('range=last-6-months&type=income'), NOW)
    expect(params.get('range')).toBe('last-6-months')
    expect(params.get('type')).toBe('income')
  })

  it('5. tpl=MONTHLY senza range esplicito prende il defaultRange del template (current-month)', () => {
    const params = resolveInitialFilters(new URLSearchParams('tpl=MONTHLY'), NOW)
    expect(params.get('range')).toBe('current-month')
    expect(params.get('type')).toBe('both')
  })

  it('5b. tpl=QUARTERLY prende last-3-months', () => {
    expect(resolveInitialFilters(new URLSearchParams('tpl=QUARTERLY'), NOW).get('range')).toBe('last-3-months')
  })

  it('5c. tpl=ANNUAL prende current-year', () => {
    expect(resolveInitialFilters(new URLSearchParams('tpl=ANNUAL'), NOW).get('range')).toBe('current-year')
  })

  it('6. tpl=INCOME imposta type=income, tpl=EXPENSES imposta type=expense', () => {
    expect(resolveInitialFilters(new URLSearchParams('tpl=INCOME'), NOW).get('type')).toBe('income')
    expect(resolveInitialFilters(new URLSearchParams('tpl=EXPENSES'), NOW).get('type')).toBe('expense')
  })

  it('4. tpl=CUSTOM (defaultRange custom) senza from/to: vengono precompilati, mai INVALID_DATE al primo accesso', () => {
    const params = resolveInitialFilters(new URLSearchParams('tpl=CUSTOM'), NOW)
    expect(params.get('range')).toBe('custom')
    expect(params.get('from')).toBe('2026-06-15')
    expect(params.get('to')).toBe('2026-07-15')
  })

  it('4b. range=custom manuale (senza tpl) senza from/to: stesso fix, generalizzato a qualunque link', () => {
    const params = resolveInitialFilters(new URLSearchParams('range=custom'), NOW)
    expect(params.get('from')).toBe('2026-06-15')
    expect(params.get('to')).toBe('2026-07-15')
  })

  it('4c. range=custom con from/to già presenti: non vengono sovrascritti', () => {
    const params = resolveInitialFilters(new URLSearchParams('range=custom&from=2020-01-01&to=2020-01-31'), NOW)
    expect(params.get('from')).toBe('2020-01-01')
    expect(params.get('to')).toBe('2020-01-31')
  })

  it('8. tpl sconosciuto: nessun crash, fallback ai default generici', () => {
    expect(() => resolveInitialFilters(new URLSearchParams('tpl=NOPE_NOT_REAL'), NOW)).not.toThrow()
    const params = resolveInitialFilters(new URLSearchParams('tpl=NOPE_NOT_REAL'), NOW)
    expect(params.get('range')).toBe('current-month')
    expect(params.get('type')).toBe('both')
  })

  it('8b. range non valido: fallback sicuro a current-month invece di propagare un valore corrotto', () => {
    const params = resolveInitialFilters(new URLSearchParams('range=not-a-real-range'), NOW)
    expect(params.get('range')).toBe('current-month')
  })

  it('tpl nascosto (TAGS) o correlato (BUDGETS) non forzano una configurazione dedicata: default generici', () => {
    expect(resolveInitialFilters(new URLSearchParams('tpl=TAGS'), NOW).get('range')).toBe('current-month')
    expect(resolveInitialFilters(new URLSearchParams('tpl=BUDGETS'), NOW).get('range')).toBe('current-month')
  })
})

describe('getActiveSections / hasSection', () => {
  it('nessun tpl -> null, hasSection sempre true (vista completa, compatibilità con vecchi URL)', () => {
    const sections = getActiveSections(null)
    expect(sections).toBeNull()
    expect(hasSection(sections, 'net-worth')).toBe(true)
    expect(hasSection(sections, 'kpi-income')).toBe(true)
  })

  it('1. NET_WORTH e CASH_FLOW producono sections diverse', () => {
    const netWorth = getActiveSections('NET_WORTH')
    const cashFlow = getActiveSections('CASH_FLOW')
    expect(netWorth).not.toEqual(cashFlow)
    expect(hasSection(netWorth, 'net-worth')).toBe(true)
    expect(hasSection(netWorth, 'expense-categories')).toBe(false)
    expect(hasSection(cashFlow, 'net-worth')).toBe(false)
    expect(hasSection(cashFlow, 'kpi-cashflow')).toBe(true)
  })

  it('2. CATEGORIES e QUARTERLY producono sections diverse', () => {
    const categories = getActiveSections('CATEGORIES')
    const quarterly = getActiveSections('QUARTERLY')
    expect(categories).not.toEqual(quarterly)
    expect(hasSection(quarterly, 'kpi-income')).toBe(true)
    expect(hasSection(categories, 'kpi-income')).toBe(false)
    expect(hasSection(categories, 'expense-categories')).toBe(true)
  })

  it('3. TAGS non e disponibile: risolve come "nessun template" (sections null, vista completa di sicurezza)', () => {
    expect(getActiveSections('TAGS')).toBeNull()
  })

  it('uno strumento correlato (BUDGETS) non attiva sections dedicate', () => {
    expect(getActiveSections('BUDGETS')).toBeNull()
  })
})

describe('getAvailableTableViews / resolveDefaultTableView', () => {
  it('nessun tpl -> tutte e tre le viste disponibili', () => {
    expect(getAvailableTableViews(null)).toEqual(['monthly', 'categories', 'accounts'])
  })

  it('NET_WORTH -> solo la vista conti', () => {
    expect(getAvailableTableViews(getActiveSections('NET_WORTH'))).toEqual(['accounts'])
  })

  it('CASH_FLOW -> solo la vista mensile (niente categorie/conti, per non sembrare un report patrimonio)', () => {
    expect(getAvailableTableViews(getActiveSections('CASH_FLOW'))).toEqual(['monthly'])
  })

  it('la vista corrente resta se disponibile, altrimenti si passa alla prima disponibile', () => {
    expect(resolveDefaultTableView(['monthly', 'accounts'], 'accounts')).toBe('accounts')
    expect(resolveDefaultTableView(['accounts'], 'monthly')).toBe('accounts')
    expect(resolveDefaultTableView([], 'monthly')).toBe('monthly')
  })
})

describe('getCategoryMode', () => {
  it('INCOME => solo categorie di entrata (nessun toggle necessario)', () => {
    expect(getCategoryMode(getActiveSections('INCOME'))).toBe('income')
  })

  it('EXPENSES => solo categorie di spesa (nessun toggle necessario)', () => {
    expect(getCategoryMode(getActiveSections('EXPENSES'))).toBe('expense')
  })

  it('CATEGORIES => entrambe disponibili ("both": la UI mostra il tab interno Uscite/Entrate)', () => {
    expect(getCategoryMode(getActiveSections('CATEGORIES'))).toBe('both')
  })

  it('NET_WORTH invariato: nessuna sezione categorie dichiarata, la modalità resta il default innocuo "expense" (il blocco categorie non viene comunque mostrato)', () => {
    const sections = getActiveSections('NET_WORTH')
    expect(hasSection(sections, 'expense-categories')).toBe(false)
    expect(hasSection(sections, 'income-categories')).toBe(false)
    expect(getCategoryMode(sections)).toBe('expense')
  })

  it('CASH_FLOW invariato: nessuna sezione categorie dichiarata, stesso comportamento innocuo', () => {
    const sections = getActiveSections('CASH_FLOW')
    expect(hasSection(sections, 'expense-categories')).toBe(false)
    expect(hasSection(sections, 'income-categories')).toBe(false)
    expect(getCategoryMode(sections)).toBe('expense')
  })

  it('vecchio report generico (nessun tpl) invariato: resta sulla vista spese, come prima di questa modifica', () => {
    expect(getCategoryMode(null)).toBe('expense')
  })

  it('MONTHLY/QUARTERLY/ANNUAL/CUSTOM (panoramica completa, con riga KPI entrate+uscite) restano sulla vista spese: solo CATEGORIES ottiene il doppio tab', () => {
    for (const code of ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM']) {
      const sections = getActiveSections(code)
      expect(hasSection(sections, 'expense-categories')).toBe(true)
      expect(hasSection(sections, 'income-categories')).toBe(true)
      expect(getCategoryMode(sections)).toBe('expense')
    }
  })
})
