import type { AffordabilityClassification, AffordabilityResult } from '../types'

// ── Enums ─────────────────────────────────────────────────────────────────────

export type FuelType =
  | 'gasoline'
  | 'diesel'
  | 'lpg'
  | 'methane'
  | 'hybrid'
  | 'plugin_hybrid'
  | 'electric'
  | 'other'

export type CarCondition = 'new' | 'used'

export type InsuranceFrequency = 'monthly' | 'semiannual' | 'annual'

export type FuelCostMode = 'monthly_estimate' | 'usage_calculation'

export type CarPaymentMode = 'IMMEDIATE' | 'FINANCING'

// ── Input ─────────────────────────────────────────────────────────────────────

export interface CarInput {
  // Required
  carName: string
  purchasePrice: number
  paymentMode: CarPaymentMode
  purchaseDate: string
  currency: string
  ownershipYears: number

  // Vehicle info (optional)
  listPrice?: number | null
  condition?: CarCondition | null
  fuelType?: FuelType | null
  annualKm?: number | null

  // Price reductions
  discount?: number | null
  incentive?: number | null
  subsidy?: number | null
  tradeInValue?: number | null
  currentCarSaleProceeds?: number | null
  otherPriceContributions?: number | null

  // Payment (financing)
  accountId?: string | null
  downPayment?: number | null
  numberOfInstallments?: number | null
  installmentAmount?: number | null
  firstInstallmentDate?: string | null
  financingFees?: number | null
  balloonPayment?: number | null
  debitAccountId?: string | null

  // Initial costs (grouped)
  initialCosts?: {
    registration?: number | null
    transfer?: number | null
    delivery?: number | null
    accessories?: number | null
    installation?: number | null
    initialInsurance?: number | null
    initialTax?: number | null
    initialTires?: number | null
    wallbox?: number | null
    chargingCable?: number | null
    other?: number | null
  } | null

  // Insurance
  insurance?: {
    rcAnnual?: number | null
    theftFireAnnual?: number | null
    kaskoAnnual?: number | null
    otherAnnual?: number | null
    frequency?: InsuranceFrequency | null
    renewalMonth?: number | null
  } | null

  // Tax / bollo
  tax?: {
    bolloAnnual?: number | null
    bolloPaymentMonth?: number | null
    exempt?: boolean | null
    exemptionYears?: number | null
    otherAnnual?: number | null
  } | null

  // Fuel / energy
  fuel?: {
    mode?: FuelCostMode | null
    monthlyEstimate?: number | null
    consumptionPer100?: number | null
    price?: number | null
  } | null

  // Maintenance
  maintenance?: {
    ordinaryAnnual?: number | null
    extraordinaryAnnual?: number | null
    revisionCost?: number | null
    revisionIntervalMonths?: number | null
    serviceAnnual?: number | null
    tiresCost?: number | null
    tiresIntervalMonths?: number | null
    batteryCost?: number | null
    batteryIntervalMonths?: number | null
    otherAnnual?: number | null
  } | null

  // Additional recurring
  additional?: {
    parkingMonthly?: number | null
    garageMonthly?: number | null
    tollsMonthly?: number | null
    ferryMonthly?: number | null
    washingMonthly?: number | null
    subscriptionsMonthly?: number | null
    roadsideAssistanceAnnual?: number | null
    batteryRentalMonthly?: number | null
    otherMonthly?: number | null
    otherAnnual?: number | null
  } | null

  // Current car (optional comparison)
  currentCar?: {
    monthlyInstallment?: number | null
    insuranceMonthly?: number | null
    bolloAnnual?: number | null
    fuelMonthly?: number | null
    maintenanceMonthly?: number | null
    parkingMonthly?: number | null
    otherMonthly?: number | null
    saleValue?: number | null
    remainingFinancing?: number | null
  } | null

  // Residual value
  estimatedResidualValue?: number | null

  // Safety preferences
  minimumLiquidityMonths?: number | null
  maxInstallmentToMarginRatio?: number | null
  horizonMonths?: number | null
  includeGoalContributions?: boolean | null

  // Second car for comparison (optional)
  compareWithCar?: CarComparisonInput | null
}

// ── Comparison input (simplified second car) ──────────────────────────────────

export interface CarComparisonInput {
  carName: string
  purchasePrice: number
  paymentMode: CarPaymentMode
  downPayment?: number | null
  installmentAmount?: number | null
  numberOfInstallments?: number | null
  balloonPayment?: number | null
  insuranceAnnualCost?: number | null
  bolloAnnualCost?: number | null
  fuelMonthlyCost?: number | null
  maintenanceAnnualCost?: number | null
  parkingMonthly?: number | null
  estimatedResidualValue?: number | null
  discount?: number | null
  tradeInValue?: number | null
  otherInitialCosts?: number | null
}

// ── Computed costs ─────────────────────────────────────────────────────────────

export interface CarCosts {
  listPrice: number
  purchasePrice: number
  totalReductions: number
  effectivePurchasePrice: number

  initialCostsSum: number
  financingFees: number
  upfrontCarCost: number
  financedAmount: number

  monthlyInstallment: number
  balloonPayment: number
  numberOfInstallments: number
  financingTotalCost: number

  insuranceAnnualCost: number
  taxAnnualCost: number
  energyAnnualCost: number
  maintenanceAnnualCost: number
  additionalAnnualCost: number
  totalAnnualRunningCost: number

  insuranceMonthlyCost: number
  taxMonthlyCost: number
  energyMonthlyCost: number
  maintenanceMonthlyCost: number
  additionalMonthlyCost: number
  totalMonthlyRunningCost: number

  effectiveMonthlyImpact: number

  ownershipPeriodMonths: number
  totalOwnershipCost: number
  netOwnershipCost: number
  averageMonthlyOwnershipCost: number
  costPerKilometer: number | null

  currentCarMonthlyCost: number
  incrementalMonthlyCost: number

  residualValue: number
  missingCosts: string[]
}

// ── Car metrics (subset exposed in result) ─────────────────────────────────────

export interface CarMetrics {
  carPurchasePrice: number
  effectivePurchasePrice: number
  totalReductions: number
  tradeInValue: number
  incentives: number
  upfrontCarCost: number
  financedAmount: number
  financingTotalCost: number

  insuranceAnnualCost: number
  taxAnnualCost: number
  energyAnnualCost: number
  maintenanceAnnualCost: number
  parkingAnnualCost: number
  additionalAnnualCost: number
  totalAnnualRunningCost: number

  insuranceMonthlyCost: number
  taxMonthlyCost: number
  energyMonthlyCost: number
  maintenanceMonthlyCost: number
  additionalMonthlyCost: number
  totalMonthlyRunningCost: number

  averageMonthlyOwnershipCost: number
  totalOwnershipCost: number
  netOwnershipCost: number

  currentCarMonthlyCost: number
  incrementalMonthlyCost: number

  costPerKilometer: number | null
  residualValue: number
  ownershipPeriodMonths: number

  missingCosts: string[]
}

// ── Payment comparison ─────────────────────────────────────────────────────────

export interface CarPaymentComparison {
  label: string
  mode: CarPaymentMode
  upfrontCost: number
  monthlyInstallment: number
  financingTotalCost: number
  totalOwnershipCost: number
  liquidityAfter: number
  negativeMonths: number
  classification: AffordabilityClassification
  classificationLabel: string
}

// ── Car comparison ─────────────────────────────────────────────────────────────

export interface CarComparisonSide {
  label: string
  effectivePrice: number
  upfrontCost: number
  monthlyInstallment: number
  totalMonthlyRunningCost: number
  averageMonthlyOwnershipCost: number
  totalOwnershipCost: number
  netOwnershipCost: number
  residualValue: number
  liquidityAfter: number
  negativeMonths: number
  classification: AffordabilityClassification
  classificationLabel: string
}

export interface CarComparisonResult {
  carA: CarComparisonSide
  carB: CarComparisonSide
  winner: {
    cheapestTotal: 'A' | 'B' | 'equal'
    lowestUpfront: 'A' | 'B' | 'equal'
    lowestMonthly: 'A' | 'B' | 'equal'
    mostSustainable: 'A' | 'B' | 'equal'
  }
}

// ── Full result ───────────────────────────────────────────────────────────────

export type CarAffordabilityResult = AffordabilityResult & {
  carMetrics: CarMetrics
  paymentComparison: CarPaymentComparison[] | null
  carComparison: CarComparisonResult | null
}
