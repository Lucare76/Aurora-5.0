import { LIQUID_ACCOUNT_TYPES } from './constants'
import { clamp, roundMoney, roundScore } from './helpers'
import type { ComponentScore, FinancialHealthInput, HealthFactor } from './types'

export function calculateLiquidAssets(input: Pick<FinancialHealthInput, 'accounts'>): number {
  return roundMoney(input.accounts
    .filter((account) => account.is_active && !account.is_hidden && LIQUID_ACCOUNT_TYPES.includes(account.type as any))
    .reduce((sum, account) => sum + account.balance, 0))
}

export function calculateLiquidityScore(input: {
  currentBalance: number
  minProjectedBalance7d: number
  minProjectedBalance30d: number
  minProjectedBalance90d: number
  negativeDays: number
  expenseCoverageMonths: number | null
  weight: number
}): ComponentScore {
  const factors: HealthFactor[] = []
  let score = 100

  if (input.currentBalance < 0) {
    score -= 35
    factors.push({
      id: 'liquidity-current-negative',
      component: 'liquidity',
      impact: 'NEGATIVE',
      severity: 'CRITICAL',
      title: 'Liquidità sotto zero',
      description: 'Il saldo disponibile aggregato risulta negativo.',
      metricValue: input.currentBalance,
      metricUnit: 'EUR',
    })
  }

  const minProjected = Math.min(input.minProjectedBalance7d, input.minProjectedBalance30d, input.minProjectedBalance90d)
  if (minProjected < 0) {
    const depthPenalty = clamp(Math.abs(minProjected) / Math.max(Math.abs(input.currentBalance), 500) * 35, 10, 35)
    score -= depthPenalty
    factors.push({
      id: 'liquidity-projected-negative',
      component: 'liquidity',
      impact: 'NEGATIVE',
      severity: input.minProjectedBalance30d < 0 ? 'CRITICAL' : 'WARNING',
      title: 'Saldo previsto negativo',
      description: 'La proiezione indica almeno un giorno con saldo aggregato sotto zero.',
      metricValue: minProjected,
      metricUnit: 'EUR',
    })
  } else {
    factors.push({
      id: 'liquidity-projected-positive',
      component: 'liquidity',
      impact: 'POSITIVE',
      severity: 'INFO',
      title: 'Saldo previsto positivo',
      description: 'Il saldo previsto resta positivo nell’orizzonte analizzato.',
      metricValue: minProjected,
      metricUnit: 'EUR',
    })
  }

  if (input.negativeDays > 0) score -= clamp(input.negativeDays * 2, 0, 20)

  if (input.expenseCoverageMonths != null) {
    if (input.expenseCoverageMonths >= 3) score += 5
    else if (input.expenseCoverageMonths < 0.5) score -= 15
  }

  const finalScore = roundScore(score)
  return {
    component: 'liquidity',
    score: finalScore,
    weight: input.weight,
    contribution: roundMoney((finalScore / 100) * input.weight),
    availability: 'AVAILABLE',
    status: finalScore >= 75 ? 'good' : finalScore >= 50 ? 'watch' : 'risk',
    factors,
  }
}
