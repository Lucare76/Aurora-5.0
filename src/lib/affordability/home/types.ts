import type { AffordabilityResult, AffordabilityClassification } from '../types'

export type HomeCondition = 'new_build' | 'used'
export type HomePurpose = 'primary_home' | 'other_home'
export type HomePaymentMode = 'IMMEDIATE' | 'MORTGAGE'
export type MortgageRateType = 'fixed' | 'variable'
export type DistributionMode = 'one_time' | 'monthly' | 'tranches'
export type CurrentHousingType = 'rent' | 'mortgage' | 'owned_no_mortgage' | 'other'

export type AmountSchedule = {
  amount?: number | null
  date?: string | null
  months?: number | null
  mode?: DistributionMode | null
}

export interface HomeInput {
  simulationName: string
  description?: string | null
  condition: HomeCondition
  purpose: HomePurpose
  askingPrice: number
  agreedPrice: number
  purchaseDate: string
  currency: string
  ownershipYears: number
  surfaceSqm?: number | null
  householdMembers?: number | null

  discount?: number | null
  familyContribution?: number | null
  manualBenefit?: number | null
  propertySaleProceeds?: number | null
  otherContribution?: number | null
  depositPaid?: number | null

  paymentMode: HomePaymentMode
  accountId?: string | null
  cashPaymentAmount?: number | null
  downPayment?: number | null
  mortgageAmount?: number | null
  mortgageDurationMonths?: number | null
  mortgageMonthlyPayment?: number | null
  firstMortgagePaymentDate?: string | null
  mortgageRateType?: MortgageRateType | null
  tan?: number | null
  taeg?: number | null
  mortgageFees?: {
    origination?: number | null
    appraisal?: number | null
    mandatoryInsurance?: number | null
    installmentCollection?: number | null
    preAmortization?: number | null
    balloonPayment?: number | null
  } | null
  debitAccountId?: string | null

  separateFinancing?: {
    amount?: number | null
    monthlyPayment?: number | null
    numberOfInstallments?: number | null
    firstPaymentDate?: string | null
  } | null

  acquisitionCosts?: {
    notary?: number | null
    taxes?: number | null
    agency?: number | null
    appraisal?: number | null
    origination?: number | null
    initialInsurance?: number | null
    broker?: number | null
    registrations?: number | null
    certifications?: number | null
    technicalFees?: number | null
    moving?: number | null
    utilityConnections?: number | null
    deposits?: number | null
    other?: number | null
  } | null

  renovation?: {
    totalEstimated?: number | null
    alreadyPaid?: number | null
    startDate?: string | null
    durationMonths?: number | null
    paymentMode?: DistributionMode | null
    immediatePayment?: number | null
    monthlyPayment?: number | null
    numberOfInstallments?: number | null
    unexpectedExtra?: number | null
    contingencyPercent?: number | null
    futurePlanned?: number | null
  } | null

  furnishing?: {
    furniture?: number | null
    kitchen?: number | null
    appliances?: number | null
    lighting?: number | null
    climate?: number | null
    smartHome?: number | null
    gardenTerrace?: number | null
    otherInitial?: number | null
    deferrable?: number | null
    monthlyInstallment?: number | null
    numberOfInstallments?: number | null
  } | null

  condominium?: {
    monthly?: number | null
    extraordinaryKnown?: number | null
    extraordinaryDate?: string | null
    reserveFund?: number | null
    otherCommon?: number | null
  } | null

  utilities?: {
    electricity?: number | null
    gas?: number | null
    water?: number | null
    internet?: number | null
    waste?: number | null
    other?: number | null
    currentMonthly?: number | null
  } | null

  insurance?: {
    homeAnnual?: number | null
    fireAnnual?: number | null
    naturalEventsAnnual?: number | null
    liabilityAnnual?: number | null
    otherAnnual?: number | null
    paymentMonth?: number | null
  } | null

  recurringTaxes?: {
    imuAnnual?: number | null
    tariAnnual?: number | null
    otherAnnual?: number | null
    exempt?: boolean | null
    exemptionYears?: number | null
    paymentMonths?: number[] | null
  } | null

  maintenance?: {
    ordinaryAnnual?: number | null
    extraordinaryEstimated?: number | null
    boilerAnnual?: number | null
    climateAnnual?: number | null
    systemsAnnual?: number | null
    roofEvent?: AmountSchedule | null
    facadeEvent?: AmountSchedule | null
    gardenAnnual?: number | null
    otherAnnual?: number | null
  } | null

  currentHousing?: {
    type?: CurrentHousingType | null
    rentMonthly?: number | null
    mortgageMonthly?: number | null
    condominiumMonthly?: number | null
    utilitiesMonthly?: number | null
    insuranceAnnual?: number | null
    taxesAnnual?: number | null
    maintenanceAnnual?: number | null
    parkingMonthly?: number | null
    otherMonthly?: number | null
    recoverableDeposit?: number | null
    futureRentalIncomeMonthly?: number | null
    propertySaleProceeds?: number | null
    remainingMortgageDebt?: number | null
    sellingCosts?: number | null
  } | null

  residualValue?: {
    estimatedPropertyValue?: number | null
    residualMortgageDebt?: number | null
    sellingCosts?: number | null
    taxesOrCommissions?: number | null
  } | null

  minimumLiquidityMonths?: number | null
  maxInstallmentToMarginRatio?: number | null
  horizonMonths?: number | null
  includeGoalContributions?: boolean | null

  compareWithHome?: HomeComparisonInput | null
  compareMortgageOptions?: HomeMortgageOptionInput[] | null
}

export interface HomeComparisonInput {
  label: string
  agreedPrice: number
  downPayment?: number | null
  mortgageAmount?: number | null
  mortgageMonthlyPayment?: number | null
  mortgageDurationMonths?: number | null
  notary?: number | null
  taxes?: number | null
  agency?: number | null
  renovation?: number | null
  furnishing?: number | null
  condominiumMonthly?: number | null
  utilitiesMonthly?: number | null
  maintenanceAnnual?: number | null
  residualPropertyValue?: number | null
}

export interface HomeMortgageOptionInput {
  label: string
  downPayment: number
  mortgageAmount: number
  monthlyPayment: number
  durationMonths: number
  balloonPayment?: number | null
  fees?: number | null
}

export interface HomeCosts {
  propertyPurchasePrice: number
  effectivePropertyPrice: number
  totalContributions: number
  depositPaid: number
  downPayment: number
  mortgageAmount: number
  mortgageMonthlyPayment: number
  mortgageTotalPayments: number
  mortgageTotalCost: number
  mortgageAdditionalCost: number
  balloonPayment: number
  upfrontHomeCost: number
  notaryCost: number
  taxesInitialCost: number
  agencyCost: number
  renovationCost: number
  renovationContingency: number
  furnishingCost: number
  furnishingDeferrable: number
  movingCost: number
  utilitiesAnnualCost: number
  utilitiesMonthlyCost: number
  condominiumAnnualCost: number
  condominiumMonthlyCost: number
  insuranceAnnualCost: number
  recurringTaxesAnnualCost: number
  maintenanceAnnualCost: number
  totalAnnualHousingCost: number
  averageMonthlyHousingCost: number
  totalOwnershipCost: number
  netOwnershipCost: number
  currentHousingMonthlyCost: number
  incrementalMonthlyHousingCost: number
  residualPropertyValue: number
  residualMortgageDebt: number
  estimatedNetEquity: number
  ownershipPeriodMonths: number
  initialCostsTotal: number
  recurringManagementCost: number
  separateFinancingMonthlyPayment: number
  separateFinancingTotalCost: number
  missingCosts: string[]
  costBreakdown: Array<{ label: string; amount: number }>
}

export interface HomeComparisonSide {
  label: string
  effectivePropertyPrice: number
  upfrontHomeCost: number
  mortgageMonthlyPayment: number
  averageMonthlyHousingCost: number
  totalOwnershipCost: number
  netOwnershipCost: number
  residualPropertyValue: number
  minimumLiquidity: number
  negativeMonths: number
  classification: AffordabilityClassification
  classificationLabel: string
}

export interface HomeComparisonResult {
  homeA: HomeComparisonSide
  homeB: HomeComparisonSide
  insight: {
    lowerUpfront: 'A' | 'B' | 'equal'
    lowerMonthly: 'A' | 'B' | 'equal'
    lowerTotalCost: 'A' | 'B' | 'equal'
    betterSustainability: 'A' | 'B' | 'equal'
  }
}

export interface HomeMortgageComparisonResult {
  options: Array<{
    label: string
    upfrontHomeCost: number
    mortgageMonthlyPayment: number
    mortgageTotalCost: number
    liquidityAfter: number
    negativeMonths: number
    classification: AffordabilityClassification
    classificationLabel: string
  }>
}

export type HomeAffordabilityResult = AffordabilityResult & {
  homeMetrics: HomeCosts
  homeComparison: HomeComparisonResult | null
  mortgageComparison: HomeMortgageComparisonResult | null
}
