/**
 * Diff engine: compare two HAR analyses.
 *
 * URL-based grouping: strip query params, normalize numeric/UUID path segments.
 * Statistical comparison of timing groups + finding diffing.
 */
import type {
  AnalysisResult,
  DiffResult,
  TimingDelta,
  FindingDelta,
  Finding,
  NormalizedEntry,
} from './types.js'
import { computeHealthScore } from './health-score.js'

// ── URL normalization ───────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PURE_NUMERIC = /^\d+$/

/**
 * Normalize a URL for grouping. Strip query params and fragments.
 * Replace purely numeric path segments and UUIDs with '*'.
 * Mixed alphanumeric segments (e.g., /v2/, /page3/) are preserved.
 */
export function normalizeUrlForGrouping(url: string): string {
  let pathname: string
  let origin: string
  try {
    const parsed = new URL(url)
    pathname = parsed.pathname
    origin = parsed.origin
  } catch {
    // Fallback for malformed URLs
    const protoEnd = url.indexOf('//') + 2
    const pathStart = url.indexOf('/', protoEnd)
    const queryStart = url.indexOf('?')
    if (pathStart === -1) return url
    origin = url.slice(0, pathStart)
    pathname = queryStart === -1 ? url.slice(pathStart) : url.slice(pathStart, queryStart)
  }

  const segments = pathname.split('/').map((seg) => {
    if (PURE_NUMERIC.test(seg)) return '*'
    if (UUID_PATTERN.test(seg)) return '*'
    return seg
  })

  return origin + segments.join('/')
}

// ── URL grouping ────────────────────────────────────────────────

interface UrlGroup {
  pattern: string
  entries: NormalizedEntry[]
}

function groupByUrl(entries: NormalizedEntry[]): Map<string, UrlGroup> {
  const groups = new Map<string, UrlGroup>()

  for (const entry of entries) {
    const pattern = normalizeUrlForGrouping(entry.entry.request?.url ?? '')
    const existing = groups.get(pattern)
    if (existing) {
      existing.entries.push(entry)
    } else {
      groups.set(pattern, { pattern, entries: [entry] })
    }
  }

  return groups
}

function avgDuration(entries: NormalizedEntry[]): number {
  if (entries.length === 0) return 0
  const sum = entries.reduce((acc, e) => acc + e.totalDuration, 0)
  return Math.round(sum / entries.length)
}

// ── Finding diff ────────────────────────────────────────────────

function diffFindings(
  before: Finding[],
  after: Finding[],
): { newFindings: Finding[]; resolvedFindings: Finding[]; persistedFindings: FindingDelta[] } {
  const beforeIds = new Set(before.map((f) => f.ruleId))
  const afterIds = new Set(after.map((f) => f.ruleId))
  const beforeMap = new Map(before.map((f) => [f.ruleId, f]))
  const afterMap = new Map(after.map((f) => [f.ruleId, f]))

  const newFindings = after.filter((f) => !beforeIds.has(f.ruleId))
  const resolvedFindings = before.filter((f) => !afterIds.has(f.ruleId))
  const persistedFindings: FindingDelta[] = []

  for (const ruleId of beforeIds) {
    if (!afterIds.has(ruleId)) continue
    const b = beforeMap.get(ruleId)!
    const a = afterMap.get(ruleId)!
    persistedFindings.push({
      ruleId,
      beforeSeverity: b.severity,
      afterSeverity: a.severity,
      beforeCount: b.affectedEntries.length,
      afterCount: a.affectedEntries.length,
    })
  }

  return { newFindings, resolvedFindings, persistedFindings }
}

// ── Main diff ───────────────────────────────────────────────────

export function diff(before: AnalysisResult, after: AnalysisResult): DiffResult {
  const beforeScore = computeHealthScore(before)
  const afterScore = computeHealthScore(after)

  const beforeGroups = groupByUrl(before.entries)
  const afterGroups = groupByUrl(after.entries)

  // Compute timing deltas for URL patterns that appear in both
  const allPatterns = new Set([...beforeGroups.keys(), ...afterGroups.keys()])
  const timingDeltas: TimingDelta[] = []

  for (const pattern of allPatterns) {
    const bg = beforeGroups.get(pattern)
    const ag = afterGroups.get(pattern)
    const beforeAvg = bg ? avgDuration(bg.entries) : 0
    const afterAvg = ag ? avgDuration(ag.entries) : 0
    const beforeCount = bg?.entries.length ?? 0
    const afterCount = ag?.entries.length ?? 0

    // Only include if there's something meaningful to compare
    if (beforeCount === 0 && afterCount === 0) continue

    const deltaMs = afterAvg - beforeAvg
    const deltaPercent = beforeAvg > 0 ? Math.round((deltaMs / beforeAvg) * 100) : 0

    timingDeltas.push({
      urlPattern: pattern,
      beforeCount,
      afterCount,
      beforeAvgMs: beforeAvg,
      afterAvgMs: afterAvg,
      deltaMs,
      deltaPercent,
    })
  }

  // Sort by absolute delta descending (biggest changes first)
  timingDeltas.sort((a, b) => Math.abs(b.deltaMs) - Math.abs(a.deltaMs))

  const { newFindings, resolvedFindings, persistedFindings } = diffFindings(
    before.findings,
    after.findings,
  )

  const beforeTime = before.entries.length > 0
    ? Math.max(...before.entries.map((e) => e.startTimeMs + e.totalDuration)) - Math.min(...before.entries.map((e) => e.startTimeMs))
    : 0
  const afterTime = after.entries.length > 0
    ? Math.max(...after.entries.map((e) => e.startTimeMs + e.totalDuration)) - Math.min(...after.entries.map((e) => e.startTimeMs))
    : 0

  return {
    scoreDelta: afterScore.score - beforeScore.score,
    newFindings,
    resolvedFindings,
    persistedFindings,
    timingDeltas,
    requestCountDelta: after.entries.length - before.entries.length,
    totalTimeDelta: Math.round(afterTime - beforeTime),
  }
}
