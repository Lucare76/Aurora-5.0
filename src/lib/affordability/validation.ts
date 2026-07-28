import { z } from 'zod'
import {
  MAX_PURCHASE_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_NUMBER_OF_INSTALLMENTS,
  MAX_HORIZON_MONTHS,
  MAX_PRICE,
  DEFAULT_MINIMUM_LIQUIDITY_MONTHS,
  DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO,
  DEFAULT_HORIZON_MONTHS,
} from './constants'

const positiveFinite = (label: string) =>
  z
    .number({ error: `${label}: deve essere un numero` })
    .finite({ message: `${label}: valore non valido` })
    .nonnegative({ message: `${label}: non può essere negativo` })

const strictPositive = (label: string) =>
  z
    .number({ error: `${label}: deve essere un numero` })
    .finite({ message: `${label}: valore non valido` })
    .positive({ message: `${label}: deve essere maggiore di zero` })

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (formato YYYY-MM-DD richiesto)')
  .refine((s) => !isNaN(Date.parse(s + 'T00:00:00Z')), 'Data non valida')

const uuid = z.string().uuid('UUID non valido')

export const affordabilityInputSchema = z
  .object({
    purchaseName: z
      .string()
      .min(1, 'Nome richiesto')
      .max(MAX_PURCHASE_NAME_LENGTH, `Il nome non può superare ${MAX_PURCHASE_NAME_LENGTH} caratteri`),

    totalPrice: strictPositive('Prezzo totale').max(MAX_PRICE, 'Importo troppo elevato'),

    paymentMode: z.enum(['IMMEDIATE', 'INSTALLMENTS'], 'Modalità di pagamento non valida'),

    purchaseDate: isoDate,

    currency: z
      .string()
      .min(3, 'Valuta non valida')
      .max(3, 'Valuta non valida')
      .default('EUR'),

    // immediate
    accountId: uuid.nullable().optional(),

    // installments
    downPayment: positiveFinite('Anticipo').nullable().optional(),
    installmentAmount: strictPositive('Rata mensile')
      .nullable()
      .optional(),
    numberOfInstallments: z
      .number()
      .int('Numero rate deve essere intero')
      .min(1, 'Numero rate deve essere almeno 1')
      .max(MAX_NUMBER_OF_INSTALLMENTS, `Numero rate non può superare ${MAX_NUMBER_OF_INSTALLMENTS}`)
      .nullable()
      .optional(),
    firstInstallmentDate: isoDate.nullable().optional(),
    balloonPayment: positiveFinite('Maxi-rata').nullable().optional(),
    debitAccountId: uuid.nullable().optional(),

    // optional costs
    additionalUpfrontCosts: positiveFinite('Spese aggiuntive iniziali').nullable().optional(),
    monthlyRecurringCost: positiveFinite('Costo mensile associato').nullable().optional(),
    annualRecurringCost: positiveFinite('Costo annuale associato').nullable().optional(),
    estimatedResaleValue: positiveFinite('Valore di rivendita stimato').nullable().optional(),
    linkedMonthlyIncome: positiveFinite('Entrata mensile collegata').nullable().optional(),
    recurringDurationMonths: z
      .number()
      .int()
      .min(1)
      .max(360)
      .nullable()
      .optional(),

    // metadata
    categoryId: uuid.nullable().optional(),
    notes: z
      .string()
      .max(MAX_NOTES_LENGTH, `La nota non può superare ${MAX_NOTES_LENGTH} caratteri`)
      .nullable()
      .optional(),

    // preferences
    minimumLiquidityMonths: z
      .number()
      .min(0)
      .max(24)
      .default(DEFAULT_MINIMUM_LIQUIDITY_MONTHS)
      .nullable()
      .optional(),
    maxInstallmentToMarginRatio: z
      .number()
      .min(0)
      .max(1)
      .default(DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO)
      .nullable()
      .optional(),
    horizonMonths: z
      .number()
      .int()
      .min(1)
      .max(MAX_HORIZON_MONTHS)
      .default(DEFAULT_HORIZON_MONTHS)
      .nullable()
      .optional(),
    includeGoalContributions: z.boolean().nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.paymentMode === 'INSTALLMENTS') {
      if (
        (data.installmentAmount == null || data.installmentAmount <= 0) &&
        (data.numberOfInstallments == null || data.numberOfInstallments <= 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['installmentAmount'],
          message: 'Per il pagamento rateale inserire rata e numero rate',
        })
      }
    }
  })

export type AffordabilityInputRaw = z.input<typeof affordabilityInputSchema>
export type AffordabilityInputParsed = z.output<typeof affordabilityInputSchema>
