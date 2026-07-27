import type {
  FinancialScenario,
  ScenarioEngineInput,
  ScenarioEngineResult,
  ScenarioResultSummary,
} from './types'
import { SCENARIO_ENGINE_VERSION, SCENARIO_SCHEMA_VERSION } from './constants'
import { generatePeriods } from './dates'
import { buildBaseline } from './baseline'
import { projectScenario } from './projection'
import { buildComparison } from './comparison'
import { simulateFinancialHealth } from './financial-health'
import { assessReliability, buildResultSummary, computeDataCompleteness } from './summaries'
import { validateScenario } from './validation'

export function runScenarioEngine(input: ScenarioEngineInput): ScenarioEngineResult {
  const {
    scenario, accounts, recurringRules, goals, goalContributions,
    loans, loanPayments, recentTransactions, now, baselineFinancialHealthScore,
  } = input

  const errors: string[] = []
  const warnings: string[] = []

  // 1. Validate scenario
  const validation = validateScenario(scenario)
  for (const issue of validation.issues) {
    if (issue.severity === 'error') errors.push(issue.message)
    else warnings.push(issue.message)
  }
  if (!validation.valid) {
    throw new Error(`Scenario validation failed: ${errors.join('; ')}`)
  }

  // 2. Generate projection periods
  const periods = generatePeriods(scenario.start_date, scenario.horizon_months)

  // 3. Build baseline
  const baseline = buildBaseline(
    periods, accounts, recurringRules,
    loans, loanPayments, goals, goalContributions,
    scenario.assumptions,
  )
  warnings.push(...baseline.warnings)

  // 4. Project scenario (apply actions on top of baseline)
  const projection = projectScenario(
    scenario, periods, baseline,
    recurringRules, loans, loanPayments, goals, goalContributions,
  )

  // 5. Financial health simulation
  const financialHealth = simulateFinancialHealth(projection, baselineFinancialHealthScore ?? null)

  // 6. Build comparison metrics
  const comparison = buildComparison(
    projection,
    baselineFinancialHealthScore ?? null,
    financialHealth.scenario,
  )

  // 7. Reliability assessment
  const hasRecentTransactions = recentTransactions.length > 0
  const hasActiveRecurring = recurringRules.some((r) => r.is_active)
  const hasLoanData = loans.some((l) => !l.is_settled)
  const hasGoalData = goals.some((g) => g.status === 'ACTIVE' && !g.archived)
  const dataCompleteness = computeDataCompleteness(
    hasRecentTransactions, hasActiveRecurring, hasLoanData, hasGoalData, scenario.horizon_months,
  )
  const reliability = assessReliability(
    scenario, hasRecentTransactions, hasActiveRecurring, dataCompleteness,
  )

  // 8. Build result summary (for DB persistence)
  const summaryText = buildResultSummary(projection, reliability)
  const calculatedAt = now.toISOString()

  const resultSummary: ScenarioResultSummary = {
    version: SCENARIO_SCHEMA_VERSION,
    finalBalance: {
      baseline: projection.baselineFinalBalance,
      scenario: projection.scenarioFinalBalance,
      delta: projection.totalDelta,
    },
    minimumBalance: {
      baseline: projection.baselineMinBalance,
      scenario: projection.scenarioMinBalance,
    },
    negativeMonths: {
      baseline: projection.baselineNegativeMonths,
      scenario: projection.scenarioNegativeMonths,
    },
    cashFlowAvg: {
      baseline: periods.length > 0
        ? Math.round((projection.baselineFinalBalance - baseline.initialBalance) / periods.length * 100) / 100
        : 0,
      scenario: periods.length > 0
        ? Math.round((projection.scenarioFinalBalance - baseline.initialBalance) / periods.length * 100) / 100
        : 0,
    },
    financialHealth: financialHealth.baseline !== null || financialHealth.scenario !== null
      ? financialHealth
      : null,
    reliability,
    summary: summaryText,
    horizon: {
      months: scenario.horizon_months,
      startDate: scenario.start_date,
      endDate: scenario.end_date,
    },
    calculatedAt,
  }

  const updatedScenario: FinancialScenario = {
    ...scenario,
    result_summary: resultSummary,
    last_calculated_at: calculatedAt,
    baseline_as_of: now.toISOString().slice(0, 10),
    status: 'ready',
    engine_version: SCENARIO_ENGINE_VERSION,
    schema_version: SCENARIO_SCHEMA_VERSION,
  }

  return {
    scenario: updatedScenario,
    projection,
    comparison,
    financialHealth: financialHealth.scenario !== null ? financialHealth : null,
    reliability,
    resultSummary,
    calculatedAt,
    engineVersion: SCENARIO_ENGINE_VERSION,
    errors,
    warnings,
  }
}
