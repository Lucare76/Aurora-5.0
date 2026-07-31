import { CRITERIA, DISCLAIMER } from './constants'
import type {
  CompatibilityResult,
  CriterionWinner,
  DominanceRelation,
  NormalizedScenario,
  RankedScenario,
  TradeoffSummary,
} from './types'

function scenarioName(scenarios: NormalizedScenario[], id: string): string {
  return scenarios.find((s) => s.id === id)?.name ?? id
}

export function buildCompatibilityExplanation(compatibility: CompatibilityResult): string {
  return compatibility.level === 'FULL'
    ? 'Confronto completo: tutti gli scenari appartengono allo stesso dominio.'
    : 'Confronto finanziario trasversale: scenari di domini differenti, confrontati solo sulle metriche comuni.'
}

export function buildRankingExplanation(ranking: RankedScenario[], scenarios: NormalizedScenario[]): string {
  const sorted = [...ranking].sort((a, b) => a.rank - b.rank)
  const parts = sorted.map((r) => {
    const name = scenarioName(scenarios, r.scenarioId)
    const tie = r.isTie ? ' (in parità con altri scenari)' : ''
    return `${r.rank}. ${name} — punteggio ${r.finalScore.toFixed(1)}/100${tie}`
  })
  return `Classifica relativa: ${parts.join('; ')}.`
}

export function buildCriterionWinnerExplanations(
  winners: CriterionWinner[],
  scenarios: NormalizedScenario[],
): string[] {
  return winners.map((w) => {
    const label = CRITERIA.find((c) => c.key === w.criterion)?.label ?? w.criterion
    if (w.winnerScenarioId === null) {
      return w.isNegligibleDifference
        ? `${label}: differenza trascurabile tra gli scenari, nessun vantaggio significativo.`
        : `${label}: dati insufficienti per determinare un vantaggio.`
    }
    return `${label}: vantaggio per "${scenarioName(scenarios, w.winnerScenarioId)}".`
  })
}

export function buildDominanceExplanations(dominance: DominanceRelation[], scenarios: NormalizedScenario[]): string[] {
  return dominance.map(
    (d) =>
      `"${scenarioName(scenarios, d.dominantScenarioId)}" domina "${scenarioName(scenarios, d.dominatedScenarioId)}": non è mai peggiore e risulta migliore su ${d.marginCriteria.length} criteri.`,
  )
}

export function buildTradeoffExplanations(tradeoffs: TradeoffSummary[], scenarios: NormalizedScenario[]): string[] {
  return tradeoffs
    .filter((t) => !t.isDominance && (t.aWinsOn.length > 0 || t.bWinsOn.length > 0))
    .map((t) => {
      const a = scenarioName(scenarios, t.scenarioAId)
      const b = scenarioName(scenarios, t.scenarioBId)
      return `Compromesso tra "${a}" e "${b}": "${a}" è preferibile su ${t.aWinsOn.length} criteri, "${b}" su ${t.bWinsOn.length}, ${t.tiedOn.length} in parità.`
    })
}

export function buildDisclaimer(): string {
  return DISCLAIMER
}

export function buildExplanations(params: {
  compatibility: CompatibilityResult
  ranking: RankedScenario[]
  criterionWinners: CriterionWinner[]
  dominance: DominanceRelation[]
  tradeoffs: TradeoffSummary[]
  scenarios: NormalizedScenario[]
}): string[] {
  return [
    buildCompatibilityExplanation(params.compatibility),
    buildRankingExplanation(params.ranking, params.scenarios),
    ...buildCriterionWinnerExplanations(params.criterionWinners, params.scenarios),
    ...buildDominanceExplanations(params.dominance, params.scenarios),
    ...buildTradeoffExplanations(params.tradeoffs, params.scenarios),
    buildDisclaimer(),
  ]
}
