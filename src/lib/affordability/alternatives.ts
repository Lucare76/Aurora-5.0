import type { AffordabilityAlternative, AffordabilityBaseline, AffordabilityInput } from './types'
import type { CostBreakdown } from './metrics'
import { DEFAULT_MINIMUM_LIQUIDITY_MONTHS, DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO } from './constants'
import { roundMoney, subtractMoney, addMoney } from '@/lib/scenarios/money'

function fmt(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

export function buildAlternatives(
  baseline: AffordabilityBaseline,
  input: AffordabilityInput,
  costs: CostBreakdown,
  liquidityAfter: number,
  marginAfter: number,
): AffordabilityAlternative[] {
  const alts: AffordabilityAlternative[] = []
  const minMonths = input.minimumLiquidityMonths ?? DEFAULT_MINIMUM_LIQUIDITY_MONTHS
  const maxRatio = input.maxInstallmentToMarginRatio ?? DEFAULT_MAX_INSTALLMENT_TO_MARGIN_RATIO
  const minBuffer = roundMoney(baseline.monthlyExpenses * minMonths)

  // If IMMEDIATE — suggest postponing or reducing price
  if (input.paymentMode === 'IMMEDIATE') {
    if (liquidityAfter < 0) {
      // Cannot afford at all today
      const shortfall = Math.abs(liquidityAfter)
      const monthsNeeded = baseline.monthlyMargin > 0
        ? Math.ceil(shortfall / baseline.monthlyMargin)
        : null

      if (monthsNeeded !== null && monthsNeeded > 0) {
        alts.push({
          type: 'DEFER',
          text: `Rimandando l'acquisto di ${monthsNeeded} ${monthsNeeded === 1 ? 'mese' : 'mesi'}, la liquidità stimata raggiungerebbe l'importo necessario.`,
          value: monthsNeeded,
        })
      }
    } else if (liquidityAfter < minBuffer) {
      // Suggest reducing price
      const maxPrice = subtractMoney(baseline.totalLiquidity, minBuffer)
      if (maxPrice > 0) {
        alts.push({
          type: 'REDUCE_PRICE',
          text: `Per mantenere almeno ${minMonths} ${minMonths === 1 ? 'mese' : 'mesi'} di spese disponibili, il prezzo massimo compatibile oggi è ${fmt(maxPrice)}.`,
          value: roundMoney(maxPrice),
        })
      }

      // Suggest installments instead
      if (baseline.monthlyMargin > 0) {
        const maxInstallment = roundMoney(baseline.monthlyMargin * maxRatio)
        if (maxInstallment > 0) {
          alts.push({
            type: 'SWITCH_TO_INSTALLMENTS',
            text: `Scegliendo il pagamento rateale, la rata massima compatibile con i tuoi parametri è ${fmt(maxInstallment)}/mese.`,
            value: maxInstallment,
          })
        }
      }

      // Suggest deferring 3 months
      if (baseline.monthlyMargin > 0) {
        const months3 = 3
        const liquidityIn3Months = addMoney(baseline.totalLiquidity, roundMoney(baseline.monthlyMargin * months3))
        if (liquidityIn3Months >= costs.upfrontCost) {
          alts.push({
            type: 'DEFER_3',
            text: `Rimandando l'acquisto di 3 mesi, la liquidità stimata sarebbe ${fmt(liquidityIn3Months)} (compatibile con il parametro di sicurezza).`,
            value: liquidityIn3Months,
          })
        }
      }
    }

    // Suggest switching to installments if that would be better
    if (liquidityAfter >= 0 && liquidityAfter < minBuffer && baseline.monthlyMargin > 0) {
      // Already suggested above
    }
  }

  // If INSTALLMENTS — suggest reducing installment, more months, or larger down payment
  if (input.paymentMode === 'INSTALLMENTS') {
    const installmentRatio = baseline.monthlyMargin > 0
      ? roundMoney(costs.monthlyInstallment / baseline.monthlyMargin)
      : null

    if (installmentRatio !== null && installmentRatio > maxRatio) {
      const targetInstallment = roundMoney(baseline.monthlyMargin * maxRatio)
      if (targetInstallment > 0 && targetInstallment < costs.monthlyInstallment) {
        alts.push({
          type: 'REDUCE_INSTALLMENT',
          text: `Con una rata di ${fmt(targetInstallment)}/mese invece di ${fmt(costs.monthlyInstallment)}/mese, il peso sul margine scenderebbe al ${Math.round(maxRatio * 100)}%.`,
          value: targetInstallment,
        })
      }
    }

    if (liquidityAfter < minBuffer && baseline.totalLiquidity > minBuffer) {
      // Suggest increasing down payment is not always possible; just note the impact
      const maxDown = subtractMoney(baseline.totalLiquidity, minBuffer)
      if (maxDown > (input.downPayment ?? 0)) {
        const additionalDown = subtractMoney(maxDown, input.downPayment ?? 0)
        alts.push({
          type: 'INCREASE_DOWN',
          text: `Aumentando l'anticipo di ${fmt(additionalDown)}, il saldo iniziale resterebbe sopra il fondo di sicurezza impostato.`,
          value: maxDown,
        })
      }
    }

    if (marginAfter < 0 && costs.monthlyInstallment > 0) {
      // Suggest spreading over more months
      const maxInstallment = Math.max(1, roundMoney(baseline.monthlyMargin * maxRatio))
      const impliedMonths = Math.ceil(
        (input.totalPrice - (input.downPayment ?? 0)) / maxInstallment,
      )
      if (impliedMonths > (input.numberOfInstallments ?? 0)) {
        alts.push({
          type: 'EXTEND_MONTHS',
          text: `Distribuendo il finanziamento su ${impliedMonths} rate invece di ${input.numberOfInstallments}, la rata scenderebbe a circa ${fmt(maxInstallment)}/mese.`,
          value: impliedMonths,
        })
      }
    }

    // Compare with immediate payment
    const immediateUpfront = addMoney(input.totalPrice, input.additionalUpfrontCosts ?? 0)
    if (immediateUpfront < baseline.totalLiquidity - minBuffer) {
      alts.push({
        type: 'COMPARE_IMMEDIATE',
        text: `Il pagamento immediato (${fmt(immediateUpfront)}) è compatibile con i tuoi parametri e risparmia il costo aggiuntivo del finanziamento.`,
        value: immediateUpfront,
      })
    }
  }

  // General: suggest waiting if margin allows
  if (alts.length === 0 && baseline.monthlyMargin > 0) {
    const months6 = 6
    const liquidityIn6Months = addMoney(baseline.totalLiquidity, roundMoney(baseline.monthlyMargin * months6))
    alts.push({
      type: 'DEFER_6',
      text: `Aspettando 6 mesi, la liquidità stimata crescerebbe fino a ${fmt(liquidityIn6Months)}, migliorando la situazione.`,
      value: liquidityIn6Months,
    })
  }

  return alts
}
