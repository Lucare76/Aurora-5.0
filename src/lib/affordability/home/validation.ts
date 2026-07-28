import { z } from 'zod'
import {
  MAX_HOME_NAME_LENGTH,
  MAX_HOME_PRICE,
  MAX_MORTGAGE_MONTHS,
  MAX_OWNERSHIP_YEARS,
  MAX_SURFACE_SQM,
} from './constants'

const pos = z.number().finite().positive()
const nn = z.number().finite().nonnegative()
const percent = z.number().finite().min(0).max(100)
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (YYYY-MM-DD)')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Data non valida')
const uuid = z.string().uuid('UUID non valido')

const amountScheduleSchema = z.object({
  amount: nn.nullable().optional(),
  date: isoDate.nullable().optional(),
  months: z.number().int().min(1).max(MAX_MORTGAGE_MONTHS).nullable().optional(),
  mode: z.enum(['one_time', 'monthly', 'tranches']).nullable().optional(),
}).strict()

const mortgageFeesSchema = z.object({
  origination: nn.nullable().optional(),
  appraisal: nn.nullable().optional(),
  mandatoryInsurance: nn.nullable().optional(),
  installmentCollection: nn.nullable().optional(),
  preAmortization: nn.nullable().optional(),
  balloonPayment: nn.nullable().optional(),
}).strict()

const separateFinancingSchema = z.object({
  amount: nn.nullable().optional(),
  monthlyPayment: nn.nullable().optional(),
  numberOfInstallments: z.number().int().min(1).max(MAX_MORTGAGE_MONTHS).nullable().optional(),
  firstPaymentDate: isoDate.nullable().optional(),
}).strict()

const acquisitionCostsSchema = z.object({
  notary: nn.nullable().optional(),
  taxes: nn.nullable().optional(),
  agency: nn.nullable().optional(),
  appraisal: nn.nullable().optional(),
  origination: nn.nullable().optional(),
  initialInsurance: nn.nullable().optional(),
  broker: nn.nullable().optional(),
  registrations: nn.nullable().optional(),
  certifications: nn.nullable().optional(),
  technicalFees: nn.nullable().optional(),
  moving: nn.nullable().optional(),
  utilityConnections: nn.nullable().optional(),
  deposits: nn.nullable().optional(),
  other: nn.nullable().optional(),
}).strict()

const renovationSchema = z.object({
  totalEstimated: nn.nullable().optional(),
  alreadyPaid: nn.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  durationMonths: z.number().int().min(1).max(240).nullable().optional(),
  paymentMode: z.enum(['one_time', 'monthly', 'tranches']).nullable().optional(),
  immediatePayment: nn.nullable().optional(),
  monthlyPayment: nn.nullable().optional(),
  numberOfInstallments: z.number().int().min(1).max(240).nullable().optional(),
  unexpectedExtra: nn.nullable().optional(),
  contingencyPercent: percent.nullable().optional(),
  futurePlanned: nn.nullable().optional(),
}).strict()

const furnishingSchema = z.object({
  furniture: nn.nullable().optional(),
  kitchen: nn.nullable().optional(),
  appliances: nn.nullable().optional(),
  lighting: nn.nullable().optional(),
  climate: nn.nullable().optional(),
  smartHome: nn.nullable().optional(),
  gardenTerrace: nn.nullable().optional(),
  otherInitial: nn.nullable().optional(),
  deferrable: nn.nullable().optional(),
  monthlyInstallment: nn.nullable().optional(),
  numberOfInstallments: z.number().int().min(1).max(240).nullable().optional(),
}).strict()

const condominiumSchema = z.object({
  monthly: nn.nullable().optional(),
  extraordinaryKnown: nn.nullable().optional(),
  extraordinaryDate: isoDate.nullable().optional(),
  reserveFund: nn.nullable().optional(),
  otherCommon: nn.nullable().optional(),
}).strict()

const utilitiesSchema = z.object({
  electricity: nn.nullable().optional(),
  gas: nn.nullable().optional(),
  water: nn.nullable().optional(),
  internet: nn.nullable().optional(),
  waste: nn.nullable().optional(),
  other: nn.nullable().optional(),
  currentMonthly: nn.nullable().optional(),
}).strict()

const insuranceSchema = z.object({
  homeAnnual: nn.nullable().optional(),
  fireAnnual: nn.nullable().optional(),
  naturalEventsAnnual: nn.nullable().optional(),
  liabilityAnnual: nn.nullable().optional(),
  otherAnnual: nn.nullable().optional(),
  paymentMonth: z.number().int().min(1).max(12).nullable().optional(),
}).strict()

const recurringTaxesSchema = z.object({
  imuAnnual: nn.nullable().optional(),
  tariAnnual: nn.nullable().optional(),
  otherAnnual: nn.nullable().optional(),
  exempt: z.boolean().nullable().optional(),
  exemptionYears: z.number().int().min(0).max(MAX_OWNERSHIP_YEARS).nullable().optional(),
  paymentMonths: z.array(z.number().int().min(1).max(12)).max(12).nullable().optional(),
}).strict()

const maintenanceSchema = z.object({
  ordinaryAnnual: nn.nullable().optional(),
  extraordinaryEstimated: nn.nullable().optional(),
  boilerAnnual: nn.nullable().optional(),
  climateAnnual: nn.nullable().optional(),
  systemsAnnual: nn.nullable().optional(),
  roofEvent: amountScheduleSchema.nullable().optional(),
  facadeEvent: amountScheduleSchema.nullable().optional(),
  gardenAnnual: nn.nullable().optional(),
  otherAnnual: nn.nullable().optional(),
}).strict()

const currentHousingSchema = z.object({
  type: z.enum(['rent', 'mortgage', 'owned_no_mortgage', 'other']).nullable().optional(),
  rentMonthly: nn.nullable().optional(),
  mortgageMonthly: nn.nullable().optional(),
  condominiumMonthly: nn.nullable().optional(),
  utilitiesMonthly: nn.nullable().optional(),
  insuranceAnnual: nn.nullable().optional(),
  taxesAnnual: nn.nullable().optional(),
  maintenanceAnnual: nn.nullable().optional(),
  parkingMonthly: nn.nullable().optional(),
  otherMonthly: nn.nullable().optional(),
  recoverableDeposit: nn.nullable().optional(),
  futureRentalIncomeMonthly: nn.nullable().optional(),
  propertySaleProceeds: nn.nullable().optional(),
  remainingMortgageDebt: nn.nullable().optional(),
  sellingCosts: nn.nullable().optional(),
}).strict()

const residualValueSchema = z.object({
  estimatedPropertyValue: nn.nullable().optional(),
  residualMortgageDebt: nn.nullable().optional(),
  sellingCosts: nn.nullable().optional(),
  taxesOrCommissions: nn.nullable().optional(),
}).strict()

const homeComparisonInputSchema = z.object({
  label: z.string().min(1).max(MAX_HOME_NAME_LENGTH),
  agreedPrice: pos.max(MAX_HOME_PRICE),
  downPayment: nn.nullable().optional(),
  mortgageAmount: nn.nullable().optional(),
  mortgageMonthlyPayment: nn.nullable().optional(),
  mortgageDurationMonths: z.number().int().min(1).max(MAX_MORTGAGE_MONTHS).nullable().optional(),
  notary: nn.nullable().optional(),
  taxes: nn.nullable().optional(),
  agency: nn.nullable().optional(),
  renovation: nn.nullable().optional(),
  furnishing: nn.nullable().optional(),
  condominiumMonthly: nn.nullable().optional(),
  utilitiesMonthly: nn.nullable().optional(),
  maintenanceAnnual: nn.nullable().optional(),
  residualPropertyValue: nn.nullable().optional(),
}).strict()

const homeMortgageOptionSchema = z.object({
  label: z.string().min(1).max(MAX_HOME_NAME_LENGTH),
  downPayment: nn,
  mortgageAmount: nn,
  monthlyPayment: nn,
  durationMonths: z.number().int().min(1).max(MAX_MORTGAGE_MONTHS),
  balloonPayment: nn.nullable().optional(),
  fees: nn.nullable().optional(),
}).strict()

export const homeInputSchema = z.object({
  simulationName: z.string().min(1, 'Nome simulazione richiesto').max(MAX_HOME_NAME_LENGTH),
  description: z.string().max(500).nullable().optional(),
  condition: z.enum(['new_build', 'used']),
  purpose: z.enum(['primary_home', 'other_home']),
  askingPrice: pos.max(MAX_HOME_PRICE),
  agreedPrice: pos.max(MAX_HOME_PRICE),
  purchaseDate: isoDate,
  currency: z.string().length(3),
  ownershipYears: z.number().finite().min(1).max(MAX_OWNERSHIP_YEARS),
  surfaceSqm: z.number().finite().positive().max(MAX_SURFACE_SQM).nullable().optional(),
  householdMembers: z.number().int().min(1).max(50).nullable().optional(),

  discount: nn.nullable().optional(),
  familyContribution: nn.nullable().optional(),
  manualBenefit: nn.nullable().optional(),
  propertySaleProceeds: nn.nullable().optional(),
  otherContribution: nn.nullable().optional(),
  depositPaid: nn.nullable().optional(),

  paymentMode: z.enum(['IMMEDIATE', 'MORTGAGE']),
  accountId: uuid.nullable().optional(),
  cashPaymentAmount: nn.nullable().optional(),
  downPayment: nn.nullable().optional(),
  mortgageAmount: nn.nullable().optional(),
  mortgageDurationMonths: z.number().int().min(1).max(MAX_MORTGAGE_MONTHS).nullable().optional(),
  mortgageMonthlyPayment: nn.nullable().optional(),
  firstMortgagePaymentDate: isoDate.nullable().optional(),
  mortgageRateType: z.enum(['fixed', 'variable']).nullable().optional(),
  tan: percent.nullable().optional(),
  taeg: percent.nullable().optional(),
  mortgageFees: mortgageFeesSchema.nullable().optional(),
  debitAccountId: uuid.nullable().optional(),
  separateFinancing: separateFinancingSchema.nullable().optional(),
  acquisitionCosts: acquisitionCostsSchema.nullable().optional(),
  renovation: renovationSchema.nullable().optional(),
  furnishing: furnishingSchema.nullable().optional(),
  condominium: condominiumSchema.nullable().optional(),
  utilities: utilitiesSchema.nullable().optional(),
  insurance: insuranceSchema.nullable().optional(),
  recurringTaxes: recurringTaxesSchema.nullable().optional(),
  maintenance: maintenanceSchema.nullable().optional(),
  currentHousing: currentHousingSchema.nullable().optional(),
  residualValue: residualValueSchema.nullable().optional(),

  minimumLiquidityMonths: z.number().min(0).max(60).nullable().optional(),
  maxInstallmentToMarginRatio: z.number().min(0).max(1).nullable().optional(),
  horizonMonths: z.number().int().min(1).max(720).nullable().optional(),
  includeGoalContributions: z.boolean().nullable().optional(),
  compareWithHome: homeComparisonInputSchema.nullable().optional(),
  compareMortgageOptions: z.array(homeMortgageOptionSchema).max(6).nullable().optional(),
})
  .strict()
  .superRefine((data, ctx) => {
    if (data.depositPaid != null && data.depositPaid > data.agreedPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['depositPaid'], message: 'La caparra non può superare il prezzo concordato' })
    }
    if (data.downPayment != null && data.downPayment > data.agreedPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['downPayment'], message: 'L anticipo non può superare il prezzo concordato' })
    }
    if (data.paymentMode === 'MORTGAGE') {
      if (!data.mortgageMonthlyPayment || data.mortgageMonthlyPayment <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mortgageMonthlyPayment'], message: 'Inserisci una rata mutuo maggiore di zero' })
      }
      if (!data.mortgageDurationMonths || data.mortgageDurationMonths <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mortgageDurationMonths'], message: 'Inserisci una durata mutuo valida' })
      }
      const mortgageAmount = data.mortgageAmount ?? Math.max(0, data.agreedPrice - (data.downPayment ?? 0))
      if (mortgageAmount > data.agreedPrice * 1.5) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mortgageAmount'], message: 'Importo mutuo incoerente rispetto al prezzo' })
      }
    }
    const residualDebt = data.residualValue?.residualMortgageDebt
    if (residualDebt != null && residualDebt > data.agreedPrice * 1.5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['residualValue', 'residualMortgageDebt'], message: 'Debito residuo fuori scala rispetto al prezzo' })
    }
  })

export type HomeInputRaw = z.input<typeof homeInputSchema>
export type HomeInputParsed = z.output<typeof homeInputSchema>
