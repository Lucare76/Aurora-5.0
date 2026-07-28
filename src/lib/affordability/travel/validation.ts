import { z } from 'zod'
import { MAX_TRAVEL_COST, MAX_TRAVEL_DAYS, MAX_TRAVEL_NAME_LENGTH, MAX_TRAVELERS } from './constants'

const nn = z.number().finite().nonnegative().max(MAX_TRAVEL_COST)
const pos = z.number().finite().positive().max(MAX_TRAVEL_COST)
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Data non valida')

const transportSchema = z.object({
  mainTrip: nn.nullable().optional(),
  fuel: nn.nullable().optional(),
  tolls: nn.nullable().optional(),
  parking: nn.nullable().optional(),
  taxi: nn.nullable().optional(),
  transfers: nn.nullable().optional(),
  rentalCar: nn.nullable().optional(),
  other: nn.nullable().optional(),
}).strict()

const lodgingSchema = z.object({
  totalCost: nn.nullable().optional(),
  deposit: nn.nullable().optional(),
  balance: nn.nullable().optional(),
  securityDeposit: nn.nullable().optional(),
  cleaning: nn.nullable().optional(),
  touristTax: nn.nullable().optional(),
}).strict()

const mealsSchema = z.object({
  mode: z.enum(['daily_budget', 'total']).nullable().optional(),
  dailyBudgetPerPerson: nn.nullable().optional(),
  totalCost: nn.nullable().optional(),
}).strict()

const activitiesSchema = z.object({
  excursions: nn.nullable().optional(),
  museums: nn.nullable().optional(),
  parks: nn.nullable().optional(),
  events: nn.nullable().optional(),
  beach: nn.nullable().optional(),
  sports: nn.nullable().optional(),
  rentals: nn.nullable().optional(),
  other: nn.nullable().optional(),
}).strict()

const extrasSchema = z.object({
  shopping: nn.nullable().optional(),
  souvenirs: nn.nullable().optional(),
  travelInsurance: nn.nullable().optional(),
  roaming: nn.nullable().optional(),
  tips: nn.nullable().optional(),
  contingency: nn.nullable().optional(),
  other: nn.nullable().optional(),
}).strict()

const paymentSchema = z.object({
  label: z.string().min(1).max(80),
  amount: pos,
  date: isoDate,
}).strict()

const comparisonSchema = z.object({
  label: z.string().min(1).max(MAX_TRAVEL_NAME_LENGTH),
  totalCost: pos,
  departureDate: isoDate,
  returnDate: isoDate,
  upfrontCost: nn.nullable().optional(),
}).strict()

export const travelInputSchema = z.object({
  simulationName: z.string().min(1).max(MAX_TRAVEL_NAME_LENGTH),
  destination: z.string().max(150).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  currency: z.string().length(3),
  travelers: z.number().int().min(1).max(MAX_TRAVELERS),
  adults: z.number().int().min(0).max(MAX_TRAVELERS).nullable().optional(),
  children: z.number().int().min(0).max(MAX_TRAVELERS).nullable().optional(),
  bookingDate: isoDate,
  departureDate: isoDate,
  returnDate: isoDate,
  transportMode: z.enum(['car', 'plane', 'train', 'ship', 'bus']).nullable().optional(),
  lodgingType: z.enum(['hotel', 'apartment', 'resort', 'bb', 'camping', 'other']).nullable().optional(),
  transport: transportSchema.nullable().optional(),
  lodging: lodgingSchema.nullable().optional(),
  meals: mealsSchema.nullable().optional(),
  activities: activitiesSchema.nullable().optional(),
  extras: extrasSchema.nullable().optional(),
  payments: z.array(paymentSchema).max(24).nullable().optional(),
  currentMonthlySaving: nn.nullable().optional(),
  minimumLiquidityMonths: z.number().min(0).max(60).nullable().optional(),
  maxInstallmentToMarginRatio: z.number().min(0).max(1).nullable().optional(),
  horizonMonths: z.number().int().min(1).max(120).nullable().optional(),
  includeGoalContributions: z.boolean().nullable().optional(),
  compareWithTravel: comparisonSchema.nullable().optional(),
}).strict().superRefine((data, ctx) => {
  const departure = Date.parse(`${data.departureDate}T00:00:00Z`)
  const returnDate = Date.parse(`${data.returnDate}T00:00:00Z`)
  const booking = Date.parse(`${data.bookingDate}T00:00:00Z`)
  if (returnDate < departure) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['returnDate'], message: 'La data di rientro non può precedere la partenza' })
  }
  const durationDays = Math.floor((returnDate - departure) / 86400000) + 1
  if (durationDays > MAX_TRAVEL_DAYS) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['returnDate'], message: 'Durata viaggio oltre il limite consentito' })
  }
  if (booking > departure) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bookingDate'], message: 'La data di prenotazione non può essere dopo la partenza' })
  }
  if ((data.adults ?? 0) + (data.children ?? 0) > 0 && (data.adults ?? 0) + (data.children ?? 0) !== data.travelers) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['travelers'], message: 'Adulti e bambini devono coincidere con il numero viaggiatori' })
  }
  if (data.compareWithTravel && Date.parse(`${data.compareWithTravel.returnDate}T00:00:00Z`) < Date.parse(`${data.compareWithTravel.departureDate}T00:00:00Z`)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compareWithTravel', 'returnDate'], message: 'Date confronto non valide' })
  }
})

export type TravelInputRaw = z.input<typeof travelInputSchema>
export type TravelInputParsed = z.output<typeof travelInputSchema>
