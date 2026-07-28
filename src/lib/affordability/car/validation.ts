import { z } from 'zod'
import {
  MAX_CAR_NAME_LENGTH,
  MAX_OWNERSHIP_YEARS,
  MAX_ANNUAL_KM,
  MAX_CAR_PRICE,
  MAX_INSTALLMENTS,
} from './constants'

// ── Primitives ────────────────────────────────────────────────────────────────

const pos = z.number().finite().positive()
const nn = z.number().finite().nonnegative()
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (YYYY-MM-DD)')
  .refine((s) => !isNaN(Date.parse(s + 'T00:00:00Z')), 'Data non valida')
const uuid = z.string().uuid('UUID non valido')

// ── Nested schemas ─────────────────────────────────────────────────────────────

const initialCostsSchema = z.object({
  registration: nn.nullable().optional(),
  transfer: nn.nullable().optional(),
  delivery: nn.nullable().optional(),
  accessories: nn.nullable().optional(),
  installation: nn.nullable().optional(),
  initialInsurance: nn.nullable().optional(),
  initialTax: nn.nullable().optional(),
  initialTires: nn.nullable().optional(),
  wallbox: nn.nullable().optional(),
  chargingCable: nn.nullable().optional(),
  other: nn.nullable().optional(),
}).strict()

const insuranceSchema = z.object({
  rcAnnual: nn.nullable().optional(),
  theftFireAnnual: nn.nullable().optional(),
  kaskoAnnual: nn.nullable().optional(),
  otherAnnual: nn.nullable().optional(),
  frequency: z.enum(['monthly', 'semiannual', 'annual']).nullable().optional(),
  renewalMonth: z.number().int().min(1).max(12).nullable().optional(),
}).strict()

const taxSchema = z.object({
  bolloAnnual: nn.nullable().optional(),
  bolloPaymentMonth: z.number().int().min(1).max(12).nullable().optional(),
  exempt: z.boolean().nullable().optional(),
  exemptionYears: z.number().int().min(0).max(MAX_OWNERSHIP_YEARS).nullable().optional(),
  otherAnnual: nn.nullable().optional(),
}).strict()

const fuelSchema = z.object({
  mode: z.enum(['monthly_estimate', 'usage_calculation']).nullable().optional(),
  monthlyEstimate: nn.nullable().optional(),
  consumptionPer100: pos.nullable().optional(),
  price: pos.nullable().optional(),
}).strict()

const maintenanceSchema = z.object({
  ordinaryAnnual: nn.nullable().optional(),
  extraordinaryAnnual: nn.nullable().optional(),
  revisionCost: nn.nullable().optional(),
  revisionIntervalMonths: z.number().int().min(1).max(240).nullable().optional(),
  serviceAnnual: nn.nullable().optional(),
  tiresCost: nn.nullable().optional(),
  tiresIntervalMonths: z.number().int().min(1).max(120).nullable().optional(),
  batteryCost: nn.nullable().optional(),
  batteryIntervalMonths: z.number().int().min(1).max(240).nullable().optional(),
  otherAnnual: nn.nullable().optional(),
}).strict()

const additionalSchema = z.object({
  parkingMonthly: nn.nullable().optional(),
  garageMonthly: nn.nullable().optional(),
  tollsMonthly: nn.nullable().optional(),
  ferryMonthly: nn.nullable().optional(),
  washingMonthly: nn.nullable().optional(),
  subscriptionsMonthly: nn.nullable().optional(),
  roadsideAssistanceAnnual: nn.nullable().optional(),
  batteryRentalMonthly: nn.nullable().optional(),
  otherMonthly: nn.nullable().optional(),
  otherAnnual: nn.nullable().optional(),
}).strict()

const currentCarSchema = z.object({
  monthlyInstallment: nn.nullable().optional(),
  insuranceMonthly: nn.nullable().optional(),
  bolloAnnual: nn.nullable().optional(),
  fuelMonthly: nn.nullable().optional(),
  maintenanceMonthly: nn.nullable().optional(),
  parkingMonthly: nn.nullable().optional(),
  otherMonthly: nn.nullable().optional(),
  saleValue: nn.nullable().optional(),
  remainingFinancing: nn.nullable().optional(),
}).strict()

const carComparisonInputSchema = z.object({
  carName: z.string().min(1).max(MAX_CAR_NAME_LENGTH),
  purchasePrice: pos.max(MAX_CAR_PRICE),
  paymentMode: z.enum(['IMMEDIATE', 'FINANCING']),
  downPayment: nn.nullable().optional(),
  installmentAmount: pos.nullable().optional(),
  numberOfInstallments: z.number().int().min(1).max(MAX_INSTALLMENTS).nullable().optional(),
  balloonPayment: nn.nullable().optional(),
  insuranceAnnualCost: nn.nullable().optional(),
  bolloAnnualCost: nn.nullable().optional(),
  fuelMonthlyCost: nn.nullable().optional(),
  maintenanceAnnualCost: nn.nullable().optional(),
  parkingMonthly: nn.nullable().optional(),
  estimatedResidualValue: nn.nullable().optional(),
  discount: nn.nullable().optional(),
  tradeInValue: nn.nullable().optional(),
  otherInitialCosts: nn.nullable().optional(),
}).strict()

// ── Main schema ───────────────────────────────────────────────────────────────

export const carInputSchema = z.object({
  carName: z.string().min(1, 'Nome richiesto').max(MAX_CAR_NAME_LENGTH),
  purchasePrice: pos.max(MAX_CAR_PRICE, 'Prezzo troppo elevato'),
  paymentMode: z.enum(['IMMEDIATE', 'FINANCING'], 'Modalità non valida'),
  purchaseDate: isoDate,
  currency: z.string().min(3).max(3),

  listPrice: nn.max(MAX_CAR_PRICE).nullable().optional(),
  condition: z.enum(['new', 'used']).nullable().optional(),
  fuelType: z.enum(['gasoline', 'diesel', 'lpg', 'methane', 'hybrid', 'plugin_hybrid', 'electric', 'other']).nullable().optional(),
  annualKm: z.number().finite().nonnegative().max(MAX_ANNUAL_KM).nullable().optional(),

  discount: nn.nullable().optional(),
  incentive: nn.nullable().optional(),
  subsidy: nn.nullable().optional(),
  tradeInValue: nn.nullable().optional(),
  currentCarSaleProceeds: nn.nullable().optional(),
  otherPriceContributions: nn.nullable().optional(),

  accountId: uuid.nullable().optional(),
  downPayment: nn.nullable().optional(),
  numberOfInstallments: z.number().int().min(1).max(MAX_INSTALLMENTS).nullable().optional(),
  installmentAmount: pos.nullable().optional(),
  firstInstallmentDate: isoDate.nullable().optional(),
  financingFees: nn.nullable().optional(),
  balloonPayment: nn.nullable().optional(),
  debitAccountId: uuid.nullable().optional(),

  initialCosts: initialCostsSchema.nullable().optional(),
  insurance: insuranceSchema.nullable().optional(),
  tax: taxSchema.nullable().optional(),
  fuel: fuelSchema.nullable().optional(),
  maintenance: maintenanceSchema.nullable().optional(),
  additional: additionalSchema.nullable().optional(),
  currentCar: currentCarSchema.nullable().optional(),

  estimatedResidualValue: nn.nullable().optional(),

  minimumLiquidityMonths: z.number().min(0).max(24).nullable().optional(),
  maxInstallmentToMarginRatio: z.number().min(0).max(1).nullable().optional(),
  horizonMonths: z.number().int().min(1).max(24).nullable().optional(),
  includeGoalContributions: z.boolean().nullable().optional(),

  compareWithCar: carComparisonInputSchema.nullable().optional(),
})
.strict()
.superRefine((data, ctx) => {
  if (data.paymentMode === 'FINANCING') {
    if ((data.installmentAmount == null) && (data.numberOfInstallments == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installmentAmount'],
        message: 'Per il finanziamento inserire rata e numero rate',
      })
    }
  }
})

// Add ownershipYears to the schema properly
export const carInputSchemaFull = carInputSchema.extend({
  ownershipYears: z.number().finite().min(0.5).max(MAX_OWNERSHIP_YEARS),
})

export type CarInputRaw = z.input<typeof carInputSchemaFull>
export type CarInputParsed = z.output<typeof carInputSchemaFull>
