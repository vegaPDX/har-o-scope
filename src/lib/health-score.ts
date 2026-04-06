/**
 * Health score: 0-100 pure function.
 *
 * Scoring formula (from CEO plan):
 *   Base: 100
 *   Deductions:
 *     - critical finding: -15 * confidenceMultiplier
 *     - warning finding: -5 * confidenceMultiplier
 *     - info finding: -1 * confidenceMultiplier
 *     - Confidence multiplier from root cause: >=0.6 high (1.0x), >=0.4 medium (0.7x), <0.4 low (0.5x)
 *     - Timing penalty: median TTFB >1000ms: -10, >2000ms: -20
 *     - Volume penalty: >200 requests: -5, >500 requests: -10
 *   Floor: 0, Ceiling: 100
 */
import type {
  AnalysisResult,
  HealthScore,
  ScoreBreakdown,
  ScoreDeduction,
  NormalizedEntry,
  RootCauseResult,
  Finding,
} from './types.js'

export function computeHealthScore(result: AnalysisResult): HealthScore {
  const { findings, rootCause, entries } = result
  return computeHealthScoreFromParts(findings, rootCause, entries)
}

export function computeHealthScoreFromParts(
  findings: Finding[],
  rootCause: RootCauseResult,
  entries: NormalizedEntry[],
): HealthScore {
  const confidenceMultiplier = getConfidenceMultiplier(rootCause)
  const findingDeductions: ScoreDeduction[] = []
  let findingPoints = 0

  for (const finding of findings) {
    let points: number
    switch (finding.severity) {
      case 'critical':
        points = 15
        break
      case 'warning':
        points = 5
        break
      case 'info':
        points = 1
        break
      default:
        points = 0
    }
    if (points > 0) {
      const adjusted = Math.round(points * confidenceMultiplier * 10) / 10
      findingDeductions.push({ reason: `${finding.severity}: ${finding.ruleId}`, points: adjusted })
      findingPoints += adjusted
    }
  }

  const timingPenalty = computeTimingPenalty(entries)
  const volumePenalty = computeVolumePenalty(entries.length)
  const totalDeductions = findingPoints + timingPenalty + volumePenalty

  const score = Math.max(0, Math.min(100, Math.round(100 - totalDeductions)))

  return {
    score,
    breakdown: {
      findingDeductions,
      timingPenalty,
      volumePenalty,
      confidenceMultiplier,
      totalDeductions,
    },
  }
}

function getConfidenceMultiplier(rootCause: RootCauseResult): number {
  const maxWeight = Math.max(rootCause.client, rootCause.network, rootCause.server)
  if (maxWeight >= 0.6) return 1.0
  if (maxWeight >= 0.4) return 0.7
  return 0.5
}

function computeTimingPenalty(entries: NormalizedEntry[]): number {
  // Filter to non-WebSocket, non-long-poll entries with wait > 0
  const waits = entries
    .filter((e) => !e.isWebSocket && !e.isLongPoll && e.timings.wait > 0)
    .map((e) => e.timings.wait)
    .sort((a, b) => a - b)

  if (waits.length === 0) return 0

  const median = waits[Math.floor(waits.length / 2)]
  if (median > 2000) return 20
  if (median > 1000) return 10
  return 0
}

function computeVolumePenalty(count: number): number {
  if (count > 500) return 10
  if (count > 200) return 5
  return 0
}
