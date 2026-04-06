/**
 * Top-level analyze pipeline: parse -> normalize -> rules -> classify -> score.
 * This is the main entry point for library consumers.
 */
import type { Har } from 'har-format'
import type {
  AnalysisResult,
  AnalysisOptions,
  AnalysisWarning,
  NormalizedEntry,
  Finding,
} from './types.js'
import type { IssueRulesFile, SharedConditionsFile, FiltersFile } from './schema.js'
import { parseHar, normalizeHar } from './normalizer.js'
import { evaluateRules } from './rule-engine.js'
import { classifyRootCause } from './classifier.js'
import { detectUnbatchedApis } from './unbatched-detect.js'
import { createWarning } from './errors.js'

// ── Built-in rules (loaded lazily) ──────────────────────────────

let builtinRules: IssueRulesFile | null = null
let builtinConditions: SharedConditionsFile | null = null
let builtinFilters: FiltersFile | null = null

export function setBuiltinRules(
  rules: IssueRulesFile,
  conditions?: SharedConditionsFile,
  filters?: FiltersFile,
): void {
  builtinRules = rules
  builtinConditions = conditions ?? null
  builtinFilters = filters ?? null
}

// ── Severity filter ─────────────────────────────────────────────

const SEVERITY_ORDER = { info: 0, warning: 1, critical: 2 } as const

function filterBySeverity(
  findings: Finding[],
  minSeverity?: string,
): Finding[] {
  if (!minSeverity || minSeverity === 'info') return findings
  const minOrder = SEVERITY_ORDER[minSeverity as keyof typeof SEVERITY_ORDER] ?? 0
  return findings.filter(
    (f) => (SEVERITY_ORDER[f.severity] ?? 0) >= minOrder,
  )
}

// ── Main analyze function ───────────────────────────────────────

export function analyze(input: string | Har, options?: AnalysisOptions): AnalysisResult {
  const startTime = performance.now()
  const warnings: AnalysisWarning[] = []

  // Parse if string input
  const har = typeof input === 'string' ? parseHar(input) : input

  // Normalize
  const { entries, warnings: normalizeWarnings } = normalizeHar(har)
  warnings.push(...normalizeWarnings)

  // Evaluate rules
  let findings: Finding[] = []

  if (!options?.noBuiltin && builtinRules) {
    const builtinFindings = evaluateRules(
      builtinRules,
      entries,
      builtinConditions ?? undefined,
      builtinFilters ?? undefined,
    )
    findings.push(...builtinFindings)
  }

  // Custom rules
  if (options?.customRulesData) {
    for (const data of options.customRulesData) {
      try {
        const customFile = data as IssueRulesFile
        if (customFile?.rules) {
          const customFindings = evaluateRules(customFile, entries)
          findings.push(...customFindings)
        }
      } catch (e) {
        warnings.push(
          createWarning(
            'RULE001',
            `Failed to evaluate custom rules: ${e instanceof Error ? e.message : 'unknown error'}`,
            'Check that custom rules follow the YAML rule schema.',
          ),
        )
      }
    }
  }

  // TypeScript-only rules
  const unbatchedFinding = detectUnbatchedApis(entries)
  if (unbatchedFinding) findings.push(unbatchedFinding)

  // Severity filter
  findings = filterBySeverity(findings, options?.minSeverity)

  // Classify root cause
  const rootCause = classifyRootCause(findings, entries, builtinRules ?? undefined)

  const analysisTimeMs = Math.round(performance.now() - startTime)

  // Compute total wall-clock time
  let totalTimeMs = 0
  if (entries.length > 0) {
    const maxEnd = Math.max(...entries.map((e) => e.startTimeMs + e.totalDuration))
    const minStart = Math.min(...entries.map((e) => e.startTimeMs))
    totalTimeMs = Math.round(maxEnd - minStart)
  }

  return {
    entries,
    findings,
    rootCause,
    warnings,
    metadata: {
      rulesEvaluated: Object.keys(builtinRules?.rules ?? {}).length +
        (options?.customRulesData?.length ?? 0) + 1, // +1 for unbatched detect
      customRulesLoaded: options?.customRulesData?.length ?? 0,
      analysisTimeMs,
      totalRequests: entries.length,
      totalTimeMs,
    },
  }
}
