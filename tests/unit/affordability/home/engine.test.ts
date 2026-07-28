import { describe, expect, it } from 'vitest'
import { runHomeAffordabilityEngine } from '@/lib/affordability/home/engine'
import type { HomeInput } from '@/lib/affordability/home/types'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { Account } from '@/types/database'

const NOW = new Date('2026-07-01T00:00:00Z')

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Conto',
    type: 'checking',
    color: null,
    icon: null,
    balance: 80000,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function db(overrides: Partial<AffordabilityDbData> = {}): AffordabilityDbData {
  return {
    accounts: [account()],
    recurringRules: [
      { id: 'r1', type: 'income', amount: 3500, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
      { id: 'r2', type: 'expense', amount: 1800, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
    ],
    recentTransactions: [
      { id: 'i1', type: 'income', amount: 3500, date: '2026-06-10', transfer_peer_id: null },
      { id: 'e1', type: 'expense', amount: 1800, date: '2026-06-11', transfer_peer_id: null },
      { id: 'i2', type: 'income', amount: 3500, date: '2026-05-10', transfer_peer_id: null },
      { id: 'e2', type: 'expense', amount: 1800, date: '2026-05-11', transfer_peer_id: null },
      { id: 'i3', type: 'income', amount: 3500, date: '2026-04-10', transfer_peer_id: null },
      { id: 'e3', type: 'expense', amount: 1800, date: '2026-04-11', transfer_peer_id: null },
    ],
    loans: [],
    loanPayments: [],
    goals: [],
    goalContributions: [],
    ...overrides,
  }
}

function home(overrides: Partial<HomeInput> = {}): HomeInput {
  return {
    simulationName: 'Casa test',
    condition: 'used',
    purpose: 'primary_home',
    askingPrice: 220000,
    agreedPrice: 210000,
    purchaseDate: '2026-09-01',
    currency: 'EUR',
    ownershipYears: 20,
    paymentMode: 'MORTGAGE',
    downPayment: 40000,
    mortgageAmount: 170000,
    mortgageDurationMonths: 300,
    mortgageMonthlyPayment: 720,
    acquisitionCosts: { notary: 3500, taxes: 2500, agency: 6000, moving: 1200 },
    condominium: { monthly: 120 },
    utilities: { electricity: 80, gas: 70, water: 25, internet: 30, waste: 20 },
    insurance: { homeAnnual: 300, fireAnnual: 200 },
    recurringTaxes: { imuAnnual: 600, tariAnnual: 250 },
    maintenance: { ordinaryAnnual: 900 },
    currentHousing: { type: 'rent', rentMonthly: 760 },
    residualValue: { estimatedPropertyValue: 230000, residualMortgageDebt: 120000, sellingCosts: 5000 },
    minimumLiquidityMonths: 6,
    horizonMonths: 360,
    ...overrides,
  }
}

describe('runHomeAffordabilityEngine', () => {
  it('returns home metrics, engine version and no mutations', () => {
    const dbData = db()
    const before = JSON.stringify(dbData)
    const result = runHomeAffordabilityEngine(home(), dbData, NOW)
    expect(result.engineVersion).toBe('1.1.0-home')
    expect(result.homeMetrics.effectivePropertyPrice).toBe(210000)
    expect(result.homeMetrics.upfrontHomeCost).toBeGreaterThan(40000)
    expect(result.projections.length).toBeGreaterThan(0)
    expect(JSON.stringify(dbData)).toBe(before)
  })

  it('summarizes real monthly increment versus current rent', () => {
    const result = runHomeAffordabilityEngine(home(), db(), NOW)
    expect(result.homeMetrics.currentHousingMonthlyCost).toBe(760)
    expect(result.homeMetrics.incrementalMonthlyHousingCost).toBeGreaterThan(0)
    expect(result.summary).toContain('impegno')
  })

  it('adds risks for variable rate, missing costs and residual value', () => {
    const result = runHomeAffordabilityEngine(home({
      mortgageRateType: 'variable',
      acquisitionCosts: null,
      residualValue: { estimatedPropertyValue: 230000, residualMortgageDebt: 120000 },
    }), db(), NOW)
    const joined = result.risks.map((risk) => risk.text).join(' ')
    expect(joined).toContain('tasso variabile')
    expect(joined).toContain('Valutazione parziale')
    expect(joined).toContain('valore residuo')
  })

  it('generates alternatives for liquidity pressure and deferrable furnishing', () => {
    const result = runHomeAffordabilityEngine(home({
      furnishing: { furniture: 20000, deferrable: 12000 },
      downPayment: 90000,
    }), db({ accounts: [account({ balance: 50000 })] }), NOW)
    expect(result.alternatives.map((alt) => alt.type)).toEqual(expect.arrayContaining(['reduce_upfront', 'defer_furnishing']))
  })

  it('supports home and mortgage comparisons without choosing an absolute best home', () => {
    const result = runHomeAffordabilityEngine(home({
      compareWithHome: {
        label: 'Casa B',
        agreedPrice: 190000,
        downPayment: 35000,
        mortgageAmount: 155000,
        mortgageMonthlyPayment: 690,
        mortgageDurationMonths: 300,
        condominiumMonthly: 90,
        utilitiesMonthly: 180,
        maintenanceAnnual: 800,
      },
      compareMortgageOptions: [
        { label: 'Anticipo alto', downPayment: 60000, mortgageAmount: 150000, monthlyPayment: 640, durationMonths: 300 },
        { label: 'Anticipo basso', downPayment: 25000, mortgageAmount: 185000, monthlyPayment: 820, durationMonths: 300, fees: 1000 },
      ],
    }), db(), NOW)
    expect(result.homeComparison).not.toBeNull()
    expect(result.homeComparison!.insight.lowerUpfront).toMatch(/A|B|equal/)
    expect(result.mortgageComparison?.options).toHaveLength(2)
  })

  it('returns insufficient data when baseline is empty', () => {
    const result = runHomeAffordabilityEngine(home(), db({ accounts: [], recurringRules: [], recentTransactions: [] }), NOW)
    expect(result.classification).toBe('INSUFFICIENT_DATA')
    expect(result.maxAffordablePrice).toBeNull()
  })

  it('supports immediate payment path and hides mortgage comparison when absent', () => {
    const result = runHomeAffordabilityEngine(home({
      paymentMode: 'IMMEDIATE',
      cashPaymentAmount: 180000,
      downPayment: null,
      mortgageAmount: null,
      mortgageDurationMonths: null,
      mortgageMonthlyPayment: null,
      compareMortgageOptions: null,
    }), db({ accounts: [account({ balance: 300000 })] }), NOW)
    expect(result.homeMetrics.mortgageAmount).toBe(0)
    expect(result.monthlyInstallment).toBe(0)
    expect(result.mortgageComparison).toBeNull()
    expect(result.assumptions.join(' ')).toContain('Pagamento immediato')
  })

  it('returns a prudential max price interval when data is strong enough', () => {
    const result = runHomeAffordabilityEngine(home({
      mortgageMonthlyPayment: 300,
      acquisitionCosts: { notary: 3000, taxes: 2000, agency: 3000 },
      renovation: { totalEstimated: 1 },
      furnishing: { furniture: 1 },
    }), db({ accounts: [account({ balance: 200000 })] }), NOW)
    expect(result.maxAffordablePrice).toBeGreaterThan(0)
    expect(result.maxAffordablePriceNote).toContain('Intervallo prudenziale')
  })

  it('hides max affordable price when too many costs are missing', () => {
    const result = runHomeAffordabilityEngine(home({
      acquisitionCosts: null,
      condominium: null,
      utilities: null,
      insurance: null,
      recurringTaxes: null,
      maintenance: null,
      residualValue: null,
    }), db(), NOW)
    expect(result.maxAffordablePrice).toBeNull()
    expect(result.maxAffordablePriceNote).toContain('Dati insufficienti')
  })
})
