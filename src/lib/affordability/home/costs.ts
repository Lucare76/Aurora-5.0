import { roundMoney, sumMoney } from '@/lib/scenarios/money'
import type { HomeCosts, HomeInput } from './types'

const n = (value: number | null | undefined): number => value ?? 0

function annualFromMonthly(value: number): number {
  return roundMoney(value * 12)
}

function months(input: HomeInput): number {
  return Math.round(input.ownershipYears * 12)
}

function sumAcquisitionCosts(input: HomeInput) {
  const c = input.acquisitionCosts
  const mortgageFees = input.mortgageFees
  const notaryCost = n(c?.notary)
  const taxesInitialCost = n(c?.taxes)
  const agencyCost = n(c?.agency)
  const appraisal = sumMoney([n(c?.appraisal), n(mortgageFees?.appraisal)])
  const origination = sumMoney([n(c?.origination), n(mortgageFees?.origination)])
  const initialInsurance = sumMoney([n(c?.initialInsurance), n(mortgageFees?.mandatoryInsurance)])
  const movingCost = n(c?.moving)
  const other = sumMoney([
    n(c?.broker),
    n(c?.registrations),
    n(c?.certifications),
    n(c?.technicalFees),
    n(c?.utilityConnections),
    n(c?.deposits),
    n(c?.other),
  ])
  const total = sumMoney([
    notaryCost,
    taxesInitialCost,
    agencyCost,
    appraisal,
    origination,
    initialInsurance,
    movingCost,
    other,
  ])
  return { total, notaryCost, taxesInitialCost, agencyCost, appraisal, origination, initialInsurance, movingCost, other }
}

function computeRenovation(input: HomeInput) {
  const r = input.renovation
  if (!r) return { total: 0, alreadyPaid: 0, contingency: 0, upfront: 0, monthly: 0, installments: 0, future: 0 }
  const base = n(r.totalEstimated)
  const extra = n(r.unexpectedExtra)
  const contingency = roundMoney((base + extra) * (n(r.contingencyPercent) / 100))
  const total = sumMoney([base, extra, contingency, n(r.futurePlanned)])
  const alreadyPaid = Math.min(n(r.alreadyPaid), total)
  const remaining = roundMoney(Math.max(0, total - alreadyPaid))
  const upfront = r.paymentMode === 'monthly' ? n(r.immediatePayment) : (n(r.immediatePayment) || remaining)
  const monthly = n(r.monthlyPayment)
  const installments = n(r.numberOfInstallments)
  return { total, alreadyPaid, contingency, upfront: roundMoney(Math.min(upfront, remaining)), monthly, installments, future: n(r.futurePlanned) }
}

function computeFurnishing(input: HomeInput) {
  const f = input.furnishing
  if (!f) return { total: 0, deferrable: 0, upfront: 0, monthly: 0, installments: 0 }
  const total = sumMoney([
    n(f.furniture),
    n(f.kitchen),
    n(f.appliances),
    n(f.lighting),
    n(f.climate),
    n(f.smartHome),
    n(f.gardenTerrace),
    n(f.otherInitial),
  ])
  const monthly = n(f.monthlyInstallment)
  const installments = n(f.numberOfInstallments)
  const deferrable = Math.min(n(f.deferrable), total)
  const upfront = monthly > 0 && installments > 0 ? Math.max(0, total - monthly * installments) : total
  return { total: roundMoney(total), deferrable: roundMoney(deferrable), upfront: roundMoney(Math.max(0, upfront)), monthly, installments }
}

function computeCondominiumAnnual(input: HomeInput): number {
  const c = input.condominium
  if (!c) return 0
  return sumMoney([annualFromMonthly(n(c.monthly)), n(c.reserveFund), n(c.otherCommon)])
}

function computeUtilitiesMonthly(input: HomeInput): number {
  const u = input.utilities
  if (!u) return 0
  return sumMoney([n(u.electricity), n(u.gas), n(u.water), n(u.internet), n(u.waste), n(u.other)])
}

function computeInsuranceAnnual(input: HomeInput): number {
  const i = input.insurance
  if (!i) return 0
  return sumMoney([n(i.homeAnnual), n(i.fireAnnual), n(i.naturalEventsAnnual), n(i.liabilityAnnual), n(i.otherAnnual)])
}

function computeRecurringTaxesAnnual(input: HomeInput): number {
  const t = input.recurringTaxes
  if (!t) return 0
  const annual = sumMoney([n(t.imuAnnual), n(t.tariAnnual), n(t.otherAnnual)])
  if (!t.exempt) return annual
  const exemptYears = Math.min(n(t.exemptionYears), input.ownershipYears)
  const taxableYears = Math.max(0, input.ownershipYears - exemptYears)
  return input.ownershipYears > 0 ? roundMoney((annual * taxableYears) / input.ownershipYears) : 0
}

function computeMaintenanceAnnual(input: HomeInput): number {
  const m = input.maintenance
  if (!m) return 0
  const annual = sumMoney([
    n(m.ordinaryAnnual),
    n(m.boilerAnnual),
    n(m.climateAnnual),
    n(m.systemsAnnual),
    n(m.gardenAnnual),
    n(m.otherAnnual),
  ])
  const extraordinaryAverage = input.ownershipYears > 0 ? n(m.extraordinaryEstimated) / input.ownershipYears : 0
  const roofAverage = eventAnnualAverage(m.roofEvent?.amount, m.roofEvent?.months)
  const facadeAverage = eventAnnualAverage(m.facadeEvent?.amount, m.facadeEvent?.months)
  return roundMoney(sumMoney([annual, extraordinaryAverage, roofAverage, facadeAverage]))
}

function eventAnnualAverage(amount?: number | null, intervalMonths?: number | null): number {
  if (!amount) return 0
  if (!intervalMonths || intervalMonths <= 0) return amount
  return roundMoney(amount / (intervalMonths / 12))
}

function computeCurrentHousingMonthly(input: HomeInput): number {
  const h = input.currentHousing
  if (!h) return 0
  return sumMoney([
    n(h.rentMonthly),
    n(h.mortgageMonthly),
    n(h.condominiumMonthly),
    n(h.utilitiesMonthly),
    n(h.insuranceAnnual) / 12,
    n(h.taxesAnnual) / 12,
    n(h.maintenanceAnnual) / 12,
    n(h.parkingMonthly),
    n(h.otherMonthly),
  ])
}

function detectMissingCosts(input: HomeInput): string[] {
  const missing: string[] = []
  if (!input.acquisitionCosts?.notary) missing.push('notaio')
  if (!input.acquisitionCosts?.taxes) missing.push('imposte iniziali')
  if (!input.acquisitionCosts?.agency) missing.push('agenzia immobiliare')
  if (!input.renovation?.totalEstimated) missing.push('ristrutturazione non valutata')
  if (!input.furnishing || computeFurnishing(input).total === 0) missing.push('arredamento non valutato')
  if (!input.condominium?.monthly) missing.push('condominio')
  if (!input.utilities || computeUtilitiesMonthly(input) === 0) missing.push('utenze')
  if (!input.insurance || computeInsuranceAnnual(input) === 0) missing.push('assicurazione casa')
  if (!input.recurringTaxes || computeRecurringTaxesAnnual(input) === 0) missing.push('imposte ricorrenti')
  if (!input.maintenance || computeMaintenanceAnnual(input) === 0) missing.push('manutenzione')
  if (!input.residualValue?.estimatedPropertyValue) missing.push('valore residuo stimato')
  if (input.paymentMode === 'MORTGAGE' && input.residualValue?.residualMortgageDebt == null) missing.push('debito residuo stimato')
  return missing
}

export function computeHomeCosts(input: HomeInput): HomeCosts {
  const ownershipPeriodMonths = months(input)
  const totalContributions = sumMoney([
    n(input.discount),
    n(input.familyContribution),
    n(input.manualBenefit),
    n(input.propertySaleProceeds),
    n(input.otherContribution),
  ])
  const effectivePropertyPrice = roundMoney(Math.max(0, input.agreedPrice - totalContributions))
  const depositPaid = Math.min(n(input.depositPaid), input.agreedPrice)
  const acquisition = sumAcquisitionCosts(input)
  const renovation = computeRenovation(input)
  const furnishing = computeFurnishing(input)
  const mortgageFees = input.mortgageFees
  const balloonPayment = n(mortgageFees?.balloonPayment)
  const mortgageCollectionCost = roundMoney(n(mortgageFees?.installmentCollection) * n(input.mortgageDurationMonths))
  const preAmortization = n(mortgageFees?.preAmortization)

  const mortgageAmount = input.paymentMode === 'MORTGAGE'
    ? roundMoney(n(input.mortgageAmount) || Math.max(0, effectivePropertyPrice - n(input.downPayment)))
    : 0
  const downPayment = input.paymentMode === 'MORTGAGE' ? n(input.downPayment) : 0
  const mortgageMonthlyPayment = input.paymentMode === 'MORTGAGE' ? n(input.mortgageMonthlyPayment) : 0
  const mortgageDurationMonths = input.paymentMode === 'MORTGAGE' ? n(input.mortgageDurationMonths) : 0
  const mortgageTotalPayments = roundMoney(mortgageMonthlyPayment * mortgageDurationMonths)
  const mortgageAdditionalCost = sumMoney([
    n(mortgageFees?.origination),
    n(mortgageFees?.appraisal),
    n(mortgageFees?.mandatoryInsurance),
    mortgageCollectionCost,
    preAmortization,
    balloonPayment,
  ])
  const mortgageTotalCost = roundMoney(Math.max(0, mortgageTotalPayments + mortgageAdditionalCost - mortgageAmount))

  const cashPayment = input.paymentMode === 'IMMEDIATE'
    ? (n(input.cashPaymentAmount) || effectivePropertyPrice)
    : 0
  const caparraStillDue = Math.max(0, depositPaid > 0 ? 0 : 0)
  const upfrontHomeCost = sumMoney([
    input.paymentMode === 'IMMEDIATE' ? cashPayment : downPayment,
    caparraStillDue,
    acquisition.total,
    renovation.upfront,
    furnishing.upfront,
  ])

  const condominiumAnnualCost = computeCondominiumAnnual(input)
  const condominiumMonthlyCost = roundMoney(condominiumAnnualCost / 12)
  const utilitiesMonthlyCost = computeUtilitiesMonthly(input)
  const utilitiesAnnualCost = annualFromMonthly(utilitiesMonthlyCost)
  const insuranceAnnualCost = computeInsuranceAnnual(input)
  const recurringTaxesAnnualCost = computeRecurringTaxesAnnual(input)
  const maintenanceAnnualCost = computeMaintenanceAnnual(input)
  const separateFinancingMonthlyPayment = n(input.separateFinancing?.monthlyPayment)
  const separateFinancingTotalCost = roundMoney(separateFinancingMonthlyPayment * n(input.separateFinancing?.numberOfInstallments))

  const totalAnnualHousingCost = sumMoney([
    condominiumAnnualCost,
    utilitiesAnnualCost,
    insuranceAnnualCost,
    recurringTaxesAnnualCost,
    maintenanceAnnualCost,
  ])
  const recurringManagementCost = roundMoney(totalAnnualHousingCost / 12)
  const averageMonthlyHousingCost = sumMoney([
    mortgageMonthlyPayment,
    separateFinancingMonthlyPayment,
    recurringManagementCost,
    furnishing.monthly,
    renovation.monthly,
  ])
  const currentHousingMonthlyCost = computeCurrentHousingMonthly(input)
  const incrementalMonthlyHousingCost = roundMoney(averageMonthlyHousingCost - currentHousingMonthlyCost)

  const residualPropertyValue = n(input.residualValue?.estimatedPropertyValue)
  const residualMortgageDebt = n(input.residualValue?.residualMortgageDebt)
  const residualSellingCosts = sumMoney([n(input.residualValue?.sellingCosts), n(input.residualValue?.taxesOrCommissions)])
  const estimatedNetEquity = roundMoney(Math.max(0, residualPropertyValue - residualMortgageDebt - residualSellingCosts))

  const totalAcquisitionOrMortgage = input.paymentMode === 'MORTGAGE'
    ? sumMoney([downPayment, mortgageTotalPayments, mortgageAdditionalCost])
    : cashPayment
  const totalOwnershipCost = sumMoney([
    totalAcquisitionOrMortgage,
    acquisition.total,
    renovation.total - renovation.alreadyPaid,
    furnishing.total,
    totalAnnualHousingCost * input.ownershipYears,
    separateFinancingTotalCost,
  ])
  const netOwnershipCost = roundMoney(Math.max(0, totalOwnershipCost - estimatedNetEquity))

  return {
    propertyPurchasePrice: input.askingPrice,
    effectivePropertyPrice,
    totalContributions,
    depositPaid,
    downPayment: roundMoney(downPayment),
    mortgageAmount,
    mortgageMonthlyPayment: roundMoney(mortgageMonthlyPayment),
    mortgageTotalPayments,
    mortgageTotalCost,
    mortgageAdditionalCost,
    balloonPayment,
    upfrontHomeCost,
    notaryCost: acquisition.notaryCost,
    taxesInitialCost: acquisition.taxesInitialCost,
    agencyCost: acquisition.agencyCost,
    renovationCost: renovation.total,
    renovationContingency: renovation.contingency,
    furnishingCost: furnishing.total,
    furnishingDeferrable: furnishing.deferrable,
    movingCost: acquisition.movingCost,
    utilitiesAnnualCost,
    utilitiesMonthlyCost,
    condominiumAnnualCost,
    condominiumMonthlyCost,
    insuranceAnnualCost,
    recurringTaxesAnnualCost,
    maintenanceAnnualCost,
    totalAnnualHousingCost,
    averageMonthlyHousingCost,
    totalOwnershipCost,
    netOwnershipCost,
    currentHousingMonthlyCost,
    incrementalMonthlyHousingCost,
    residualPropertyValue,
    residualMortgageDebt,
    estimatedNetEquity,
    ownershipPeriodMonths,
    initialCostsTotal: acquisition.total,
    recurringManagementCost,
    separateFinancingMonthlyPayment,
    separateFinancingTotalCost,
    missingCosts: detectMissingCosts(input),
    costBreakdown: [
      { label: 'Acquisto e mutuo', amount: totalAcquisitionOrMortgage },
      { label: 'Notaio e imposte', amount: sumMoney([acquisition.notaryCost, acquisition.taxesInitialCost]) },
      { label: 'Agenzia', amount: acquisition.agencyCost },
      { label: 'Lavori', amount: renovation.total },
      { label: 'Arredamento', amount: furnishing.total },
      { label: 'Condominio', amount: condominiumAnnualCost * input.ownershipYears },
      { label: 'Utenze', amount: utilitiesAnnualCost * input.ownershipYears },
      { label: 'Assicurazione', amount: insuranceAnnualCost * input.ownershipYears },
      { label: 'Manutenzione', amount: maintenanceAnnualCost * input.ownershipYears },
      { label: 'Imposte ricorrenti', amount: recurringTaxesAnnualCost * input.ownershipYears },
      { label: 'Altri costi', amount: sumMoney([acquisition.other, separateFinancingTotalCost]) },
    ].map((row) => ({ ...row, amount: roundMoney(row.amount) })),
  }
}
