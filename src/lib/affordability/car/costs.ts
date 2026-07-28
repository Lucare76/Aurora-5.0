import { roundMoney, sumMoney } from '@/lib/scenarios/money'
import type { CarInput, CarCosts } from './types'

const n = (v: number | null | undefined): number => v ?? 0

// ── Helpers ───────────────────────────────────────────────────────────────────

function sumInitialCosts(input: CarInput): number {
  const ic = input.initialCosts
  if (!ic) return 0
  return sumMoney([
    n(ic.registration),
    n(ic.transfer),
    n(ic.delivery),
    n(ic.accessories),
    n(ic.installation),
    n(ic.initialInsurance),
    n(ic.initialTax),
    n(ic.initialTires),
    n(ic.wallbox),
    n(ic.chargingCable),
    n(ic.other),
  ])
}

function computeInsuranceAnnual(input: CarInput): number {
  const ins = input.insurance
  if (!ins) return 0
  return sumMoney([
    n(ins.rcAnnual),
    n(ins.theftFireAnnual),
    n(ins.kaskoAnnual),
    n(ins.otherAnnual),
  ])
}

function computeTaxAnnual(input: CarInput): number {
  const tax = input.tax
  if (!tax) return 0
  const bolloAnnual = n(tax.bolloAnnual)
  const otherAnnual = n(tax.otherAnnual)
  if (tax.exempt) return roundMoney(otherAnnual)
  const exemptYears = Math.max(0, Math.min(n(tax.exemptionYears), input.ownershipYears))
  const taxableYears = input.ownershipYears - exemptYears
  const avgBollo =
    input.ownershipYears > 0
      ? roundMoney((bolloAnnual * taxableYears) / input.ownershipYears)
      : 0
  return roundMoney(avgBollo + otherAnnual)
}

function computeEnergyAnnual(input: CarInput): number {
  const fuel = input.fuel
  if (!fuel) return 0
  const mode = fuel.mode ?? 'monthly_estimate'
  if (mode === 'usage_calculation') {
    const km = n(input.annualKm)
    const per100 = n(fuel.consumptionPer100)
    const price = n(fuel.price)
    if (km > 0 && per100 > 0 && price > 0) {
      return roundMoney((km / 100) * per100 * price)
    }
  }
  return roundMoney(n(fuel.monthlyEstimate) * 12)
}

function computeMaintenanceAnnual(input: CarInput): number {
  const m = input.maintenance
  if (!m) return 0
  const ordinaryAnnual = n(m.ordinaryAnnual)
  const extraordinaryAnnual = n(m.extraordinaryAnnual)
  const serviceAnnual = n(m.serviceAnnual)
  const otherAnnual = n(m.otherAnnual)

  const revisionAnnual =
    m.revisionCost != null && n(m.revisionIntervalMonths) > 0
      ? n(m.revisionCost) / (n(m.revisionIntervalMonths) / 12)
      : 0
  const tiresAnnual =
    m.tiresCost != null && n(m.tiresIntervalMonths) > 0
      ? n(m.tiresCost) / (n(m.tiresIntervalMonths) / 12)
      : 0
  const batteryAnnual =
    m.batteryCost != null && n(m.batteryIntervalMonths) > 0
      ? n(m.batteryCost) / (n(m.batteryIntervalMonths) / 12)
      : 0

  return roundMoney(
    sumMoney([
      ordinaryAnnual,
      extraordinaryAnnual,
      serviceAnnual,
      revisionAnnual,
      tiresAnnual,
      batteryAnnual,
      otherAnnual,
    ])
  )
}

function computeAdditionalAnnual(input: CarInput): number {
  const a = input.additional
  if (!a) return 0
  const monthlySum = sumMoney([
    n(a.parkingMonthly),
    n(a.garageMonthly),
    n(a.tollsMonthly),
    n(a.ferryMonthly),
    n(a.washingMonthly),
    n(a.subscriptionsMonthly),
    n(a.batteryRentalMonthly),
    n(a.otherMonthly),
  ])
  const annualSum = sumMoney([
    n(a.roadsideAssistanceAnnual),
    n(a.otherAnnual),
  ])
  return roundMoney(monthlySum * 12 + annualSum)
}

function computeCurrentCarMonthly(input: CarInput): number {
  const cc = input.currentCar
  if (!cc) return 0
  return roundMoney(
    sumMoney([
      n(cc.monthlyInstallment),
      n(cc.insuranceMonthly),
      n(cc.bolloAnnual) / 12,
      n(cc.fuelMonthly),
      n(cc.maintenanceMonthly),
      n(cc.parkingMonthly),
      n(cc.otherMonthly),
    ])
  )
}

function detectMissingCosts(input: CarInput): string[] {
  const missing: string[] = []
  const ins = input.insurance
  const hasInsurance =
    ins &&
    (n(ins.rcAnnual) + n(ins.theftFireAnnual) + n(ins.kaskoAnnual) + n(ins.otherAnnual)) > 0
  if (!hasInsurance) missing.push('assicurazione')

  const tax = input.tax
  const hasTax = tax && (n(tax.bolloAnnual) + n(tax.otherAnnual)) > 0 && !tax.exempt
  if (!hasTax && !(tax?.exempt)) missing.push('bollo auto')

  const fuel = input.fuel
  const hasFuel =
    fuel &&
    (n(fuel.monthlyEstimate) > 0 ||
      (n(input.annualKm) > 0 && n(fuel.consumptionPer100) > 0 && n(fuel.price) > 0))
  if (!hasFuel) missing.push('carburante/energia')

  const m = input.maintenance
  const hasMaintenance =
    m &&
    (n(m.ordinaryAnnual) + n(m.extraordinaryAnnual) + n(m.serviceAnnual) + n(m.otherAnnual)) > 0
  if (!hasMaintenance) missing.push('manutenzione ordinaria')

  return missing
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeCarCosts(input: CarInput): CarCosts {
  const ownershipPeriodMonths = Math.round(input.ownershipYears * 12)
  const listPrice = n(input.listPrice) || input.purchasePrice

  const totalReductions = roundMoney(
    sumMoney([
      n(input.discount),
      n(input.incentive),
      n(input.subsidy),
      n(input.tradeInValue),
      n(input.currentCarSaleProceeds),
      n(input.otherPriceContributions),
    ])
  )
  const effectivePurchasePrice = roundMoney(Math.max(0, input.purchasePrice - totalReductions))

  const initialCostsSum = roundMoney(sumInitialCosts(input))
  const financingFees = n(input.financingFees)

  // ── Payment mode ────────────────────────────────────────────────────────────

  let upfrontCarCost: number
  let financedAmount: number
  let monthlyInstallment: number
  let balloonPayment: number
  let numberOfInstallments: number
  let financingTotalCost: number

  if (input.paymentMode === 'FINANCING') {
    const downPayment = roundMoney(n(input.downPayment))
    monthlyInstallment = roundMoney(n(input.installmentAmount))
    numberOfInstallments = n(input.numberOfInstallments)
    balloonPayment = roundMoney(n(input.balloonPayment))
    upfrontCarCost = roundMoney(downPayment + initialCostsSum + financingFees)
    financedAmount = roundMoney(Math.max(0, effectivePurchasePrice - downPayment))
    const totalPaid = roundMoney(
      downPayment + monthlyInstallment * numberOfInstallments + balloonPayment + financingFees
    )
    financingTotalCost = roundMoney(Math.max(0, totalPaid - effectivePurchasePrice))
  } else {
    upfrontCarCost = roundMoney(effectivePurchasePrice + initialCostsSum)
    financedAmount = 0
    monthlyInstallment = 0
    numberOfInstallments = 0
    balloonPayment = 0
    financingTotalCost = 0
  }

  // ── Running costs (annual) ──────────────────────────────────────────────────

  const insuranceAnnualCost = computeInsuranceAnnual(input)
  const taxAnnualCost = computeTaxAnnual(input)
  const energyAnnualCost = computeEnergyAnnual(input)
  const maintenanceAnnualCost = computeMaintenanceAnnual(input)
  const additionalAnnualCost = computeAdditionalAnnual(input)
  const totalAnnualRunningCost = roundMoney(
    sumMoney([insuranceAnnualCost, taxAnnualCost, energyAnnualCost, maintenanceAnnualCost, additionalAnnualCost])
  )

  // ── Running costs (monthly) ─────────────────────────────────────────────────

  const insuranceMonthlyCost = roundMoney(insuranceAnnualCost / 12)
  const taxMonthlyCost = roundMoney(taxAnnualCost / 12)
  const energyMonthlyCost = roundMoney(energyAnnualCost / 12)
  const maintenanceMonthlyCost = roundMoney(maintenanceAnnualCost / 12)
  const additionalMonthlyCost = roundMoney(additionalAnnualCost / 12)
  const totalMonthlyRunningCost = roundMoney(
    sumMoney([insuranceMonthlyCost, taxMonthlyCost, energyMonthlyCost, maintenanceMonthlyCost, additionalMonthlyCost])
  )

  const effectiveMonthlyImpact = roundMoney(monthlyInstallment + totalMonthlyRunningCost)

  // ── TCO ─────────────────────────────────────────────────────────────────────

  let totalOwnershipCost: number
  if (input.paymentMode === 'FINANCING') {
    const downPayment = n(input.downPayment)
    totalOwnershipCost = roundMoney(
      sumMoney([
        downPayment,
        financingFees,
        initialCostsSum,
        monthlyInstallment * numberOfInstallments,
        balloonPayment,
        totalAnnualRunningCost * input.ownershipYears,
      ])
    )
  } else {
    totalOwnershipCost = roundMoney(
      sumMoney([
        effectivePurchasePrice,
        initialCostsSum,
        totalAnnualRunningCost * input.ownershipYears,
      ])
    )
  }

  const residualValue = roundMoney(n(input.estimatedResidualValue))
  const netOwnershipCost = roundMoney(Math.max(0, totalOwnershipCost - residualValue))
  const averageMonthlyOwnershipCost =
    ownershipPeriodMonths > 0
      ? roundMoney(netOwnershipCost / ownershipPeriodMonths)
      : 0

  const annualKm = n(input.annualKm)
  const totalKm = annualKm * input.ownershipYears
  const costPerKilometer =
    totalKm > 0 ? roundMoney(netOwnershipCost / totalKm) : null

  // ── Current car comparison ──────────────────────────────────────────────────

  const currentCarMonthlyCost = computeCurrentCarMonthly(input)
  const incrementalMonthlyCost = roundMoney(averageMonthlyOwnershipCost - currentCarMonthlyCost)

  const missingCosts = detectMissingCosts(input)

  return {
    listPrice,
    purchasePrice: input.purchasePrice,
    totalReductions,
    effectivePurchasePrice,

    initialCostsSum,
    financingFees: roundMoney(financingFees),
    upfrontCarCost,
    financedAmount,

    monthlyInstallment,
    balloonPayment,
    numberOfInstallments,
    financingTotalCost,

    insuranceAnnualCost,
    taxAnnualCost,
    energyAnnualCost,
    maintenanceAnnualCost,
    additionalAnnualCost,
    totalAnnualRunningCost,

    insuranceMonthlyCost,
    taxMonthlyCost,
    energyMonthlyCost,
    maintenanceMonthlyCost,
    additionalMonthlyCost,
    totalMonthlyRunningCost,

    effectiveMonthlyImpact,

    ownershipPeriodMonths,
    totalOwnershipCost,
    netOwnershipCost,
    averageMonthlyOwnershipCost,
    costPerKilometer,

    currentCarMonthlyCost,
    incrementalMonthlyCost,

    residualValue,
    missingCosts,
  }
}
