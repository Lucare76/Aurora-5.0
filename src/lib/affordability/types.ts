import type { Account, RecurringFrequency, Transaction } from '@/types/database'

// ── Payment modes ─────────────────────────────────────────────────────────────

export type PaymentMode = 'IMMEDIATE' | 'INSTALLMENTS'
export type AffordabilityPurchaseType = 'GENERIC_PURCHASE' | 'CAR_PURCHASE' | 'HOME_PURCHASE' | 'TRAVEL_PURCHASE'

// ── Classification ────────────────────────────────────────────────────────────

export type AffordabilityClassification =
  | 'AFFORDABLE'
  | 'CAUTION'
  | 'RISKY'
  | 'NOT_AFFORDABLE'
  | 'INSUFFICIENT_DATA'

// ── Data quality ──────────────────────────────────────────────────────────────

export type AffordabilityDataQuality = 'ALTA' | 'MEDIA' | 'BASSA' | 'INSUFFICIENTE'

// ── Reason categories ─────────────────────────────────────────────────────────

export type ReasonCategory =
  | 'LIQUIDITA'
  | 'MARGINE'
  | 'RATE'
  | 'SPESE_FUTURE'
  | 'FONDO'
  | 'OBIETTIVI'
  | 'STABILITA'
  | 'DATI'

export type Severity = 'info' | 'warning' | 'critical'

export type AffordabilityReason = {
  category: ReasonCategory
  text: string
  severity: Severity
}

export type AffordabilityRisk = {
  text: string
  severity: Severity
}

export type AffordabilityAlternative = {
  type: string
  text: string
  value?: number | null
}

// ── Projection ────────────────────────────────────────────────────────────────

export type ProjectionPoint = {
  period: string          // YYYY-MM
  label: string           // "gen 2026"
  baselineLiquidity: number
  scenarioLiquidity: number
  baselineMargin: number
  scenarioMargin: number
  installment: number
}

// ── Comparison variant ────────────────────────────────────────────────────────

export type ComparisonVariant = {
  label: string
  upfrontCost: number
  totalCost: number
  minimumLiquidity: number
  negativeMonths: number
  classification: AffordabilityClassification
  classificationLabel: string
  pros: string[]
  cons: string[]
}

// ── Engine input (validated) ──────────────────────────────────────────────────

export type AffordabilityInput = {
  purchaseName: string
  totalPrice: number
  paymentMode: PaymentMode
  purchaseDate: string           // YYYY-MM-DD
  currency: string

  // immediate
  accountId?: string | null

  // installments
  downPayment?: number | null
  installmentAmount?: number | null
  numberOfInstallments?: number | null
  firstInstallmentDate?: string | null
  balloonPayment?: number | null
  debitAccountId?: string | null

  // optional costs
  additionalUpfrontCosts?: number | null
  monthlyRecurringCost?: number | null
  annualRecurringCost?: number | null
  estimatedResaleValue?: number | null
  linkedMonthlyIncome?: number | null
  recurringDurationMonths?: number | null

  // metadata
  categoryId?: string | null
  notes?: string | null

  // preferences
  minimumLiquidityMonths?: number | null
  maxInstallmentToMarginRatio?: number | null
  horizonMonths?: number | null
  includeGoalContributions?: boolean | null
}

// ── Financial data from DB ────────────────────────────────────────────────────

export type AffordabilityDbData = {
  accounts: Account[]
  recurringRules: Array<{
    id: string
    type: 'income' | 'expense' | 'transfer'
    amount: number
    frequency: RecurringFrequency
    start_date: string
    end_date: string | null
    next_due_date: string
    is_active: boolean
  }>
  recentTransactions: Array<Pick<Transaction, 'id' | 'type' | 'amount' | 'date' | 'transfer_peer_id'>>
  loans: Array<{ id: string; remaining: number; is_settled: boolean; due_date: string | null }>
  loanPayments: Array<{ id: string; loan_id: string; amount: number; paid_at: string }>
  goals: Array<{ id: string; name: string; target_amount: number; current_amount: number; target_date: string | null; status: string; archived: boolean }>
  goalContributions: Array<{ id: string; goal_id: string; amount: number; date: string }>
}

// ── Computed baseline ─────────────────────────────────────────────────────────

export type AffordabilityBaseline = {
  totalLiquidity: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyMargin: number
  monthlyLoanPayments: number
  monthlyGoalContributions: number
  coverageMonths: number | null
  existingMonthlyDebtBurden: number
  dataQuality: AffordabilityDataQuality
  dataQualityScore: number         // 0-100
  historicMonthsAvailable: number
  incomeSource: 'TRANSACTIONS' | 'RECURRING' | 'NONE'
  expenseSource: 'TRANSACTIONS' | 'RECURRING' | 'NONE'
  hasActiveRecurring: boolean
  hasLoans: boolean
  warnings: string[]
}

// ── Engine result ─────────────────────────────────────────────────────────────

export type AffordabilityResult = {
  classification: AffordabilityClassification
  classificationLabel: string
  sustainabilityScore: number | null   // 0–100 internal index
  summary: string
  currency: string

  // cost breakdown
  purchaseCost: number
  upfrontCost: number
  monthlyInstallment: number
  balloonPayment: number
  totalInstallmentCost: number
  recurringMonthlyCost: number
  effectiveMonthlyCost: number
  totalCostEstimate: number

  // liquidity
  liquidityBefore: number
  liquidityAfter: number
  minimumProjectedLiquidity: number
  minimumLiquidityDate: string | null
  coverageMonthsBefore: number | null
  coverageMonthsAfter: number | null

  // margin
  monthlyMarginBefore: number
  monthlyMarginAfter: number
  installmentToMarginRatio: number | null
  totalDebtToMarginRatio: number | null

  // time dimension
  negativeMonths: number
  criticalMonths: string[]

  // max affordable
  maxAffordablePrice: number | null
  maxAffordablePriceNote: string | null

  // quality
  dataQuality: AffordabilityDataQuality
  confidence: number

  // narratives
  reasons: AffordabilityReason[]
  risks: AffordabilityRisk[]
  alternatives: AffordabilityAlternative[]

  // projection
  projections: ProjectionPoint[]

  // comparison (optional: immediate vs. installments vs. deferred)
  comparison: ComparisonVariant[] | null

  // metadata
  assumptions: string[]
  missingData: string[]
  disclaimer: string
  calculatedAt: string
  engineVersion: string
}
