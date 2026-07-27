import type { SimulatedFinancialHealth, ScenarioProjectionResult } from './types'
import { roundMoney } from './money'

/**
 * Simulates a Financial Health score from projection data.
 *
 * Uses the same conceptual components as the real engine but operates on
 * projected (simulated) data — never touches real snapshots.
 *
 * Component weights (approximate mirror of real engine):
 *  - Emergency reserve proxy (30%): scenarioMinBalance / avg monthly expense
 *  - Cash flow trend (30%): positive months ratio
 *  - Balance trajectory (20%): final vs initial balance
 *  - Expense ratio (20%): expenses vs income
 */
export function simulateFinancialHealth(
  projection: ScenarioProjectionResult,
  baselineHealthScore: number | null,
): SimulatedFinancialHealth {
  const n = projection.months.length
  if (n === 0) {
    return {
      baseline: baselineHealthScore,
      scenario: null,
      delta: null,
      baselineLevel: baselineHealthScore !== null ? scoreToLevel(baselineHealthScore) : null,
      scenarioLevel: null,
      componentsImpacted: [],
      note: 'Nessun periodo disponibile per la simulazione.',
      isSimulated: true,
    }
  }

  const scenarioScore = computeScenarioScore(projection)

  const baselineCopy = baselineHealthScore
  const delta = baselineCopy !== null ? roundMoney(scenarioScore - baselineCopy) : null

  const impacted: string[] = []
  if (projection.scenarioMinBalance !== projection.baselineMinBalance) impacted.push('Riserva emergenze')
  if (projection.scenarioNegativeMonths !== projection.baselineNegativeMonths) impacted.push('Mesi negativi')
  if (projection.scenarioTotalIncome !== projection.baselineTotalIncome) impacted.push('Entrate')
  if (projection.scenarioTotalExpenses !== projection.baselineTotalExpenses) impacted.push('Uscite')

  return {
    baseline: baselineCopy,
    scenario: scenarioScore,
    delta,
    baselineLevel: baselineCopy !== null ? scoreToLevel(baselineCopy) : null,
    scenarioLevel: scoreToLevel(scenarioScore),
    componentsImpacted: impacted,
    note: 'Punteggio stimato su dati proiettati. Non sostituisce l\'indice calcolato su dati reali.',
    isSimulated: true,
  }
}

function computeScenarioScore(projection: ScenarioProjectionResult): number {
  const n = projection.months.length

  // Proxy: emergency reserve (scenario min balance vs avg monthly expense)
  const avgMonthlyExpense = n > 0 ? projection.scenarioTotalExpenses / n : 0
  const emergencyMonths = avgMonthlyExpense > 0
    ? Math.min(projection.scenarioMinBalance / avgMonthlyExpense, 6)
    : projection.scenarioMinBalance > 0 ? 6 : 0
  const emergencyScore = Math.max(0, Math.min(100, (emergencyMonths / 6) * 100))

  // Cash flow positivity ratio
  const positiveMonths = projection.months.filter(
    (m) => m.scenarioClosingBalance >= m.scenarioOpeningBalance,
  ).length
  const cashFlowScore = Math.max(0, Math.min(100, (positiveMonths / n) * 100))

  // Balance trajectory: final vs initial
  const initial = projection.months[0]?.scenarioOpeningBalance ?? 0
  const finalBal = projection.scenarioFinalBalance
  const trajectoryScore = initial === 0
    ? finalBal >= 0 ? 75 : 25
    : Math.max(0, Math.min(100, 50 + ((finalBal - initial) / Math.abs(initial)) * 50))

  // Expense ratio
  const income = projection.scenarioTotalIncome || 1
  const expenseRatio = projection.scenarioTotalExpenses / income
  const expenseScore = Math.max(0, Math.min(100, (1 - Math.min(expenseRatio, 1.5) / 1.5) * 100))

  const score = roundMoney(
    emergencyScore * 0.30 +
    cashFlowScore * 0.30 +
    trajectoryScore * 0.20 +
    expenseScore * 0.20,
  )

  return Math.round(Math.max(0, Math.min(100, score)))
}

function scoreToLevel(score: number): string {
  if (score >= 80) return 'Eccellente'
  if (score >= 65) return 'Buono'
  if (score >= 50) return 'Sufficiente'
  if (score >= 30) return 'Critico'
  return 'Molto critico'
}
