/**
 * Rule engine: evaluates YAML-defined rules against NormalizedEntry arrays.
 *
 * Adapted from the reference engine (yaml_base RuleEngine.ts).
 * Generalized: DisplayEntry -> NormalizedEntry, stripped SF-specific imports.
 */
import type { NormalizedEntry, Finding, IssueCategory, IssueSeverity } from './types.js'
import type {
  IssueRulesFile,
  YamlRule,
  ConditionGroup,
  ConditionNode,
  SharedConditionsFile,
  FiltersFile,
} from './schema.js'
import {
  evaluateCondition,
  evaluateFieldCondition,
  computeSeverity,
  computeImpact,
  interpolate,
} from './evaluate.js'

// ── Composition resolution ──────────────────────────────────────

export function resolveComposition(
  rule: YamlRule,
  sharedConditions?: SharedConditionsFile,
): ConditionGroup | undefined {
  if (!rule.inherits || !sharedConditions) return rule.condition

  const inherited: ConditionNode[] = []
  for (const name of rule.inherits) {
    const cond = sharedConditions.conditions[name]
    if (!cond) continue
    if (rule.overrides?.[name]) {
      inherited.push(rule.overrides[name])
    } else {
      inherited.push(cond)
    }
  }

  const existing = rule.condition?.match_all ?? []
  return { match_all: [...inherited, ...existing] }
}

function matchesExcludeFilter(
  entry: NormalizedEntry,
  excludeNames: string[] | undefined,
  filtersFile?: FiltersFile,
): boolean {
  if (!excludeNames || !filtersFile) return false
  for (const name of excludeNames) {
    const filter = filtersFile.filters[name]
    if (filter && evaluateFieldCondition(entry, filter)) return true
  }
  return false
}

// ── Single rule evaluation ──────────────────────────────────────

function evaluateRule(
  ruleId: string,
  rule: YamlRule,
  entries: NormalizedEntry[],
  sharedConditions?: SharedConditionsFile,
  filtersFile?: FiltersFile,
): Finding | null {
  if (rule.type === 'aggregate') {
    return evaluateAggregateRule(ruleId, rule, entries)
  }

  if (rule.prerequisite) {
    const prereqMet = entries.some((e) =>
      evaluateFieldCondition(e as unknown as Record<string, unknown>, rule.prerequisite!.any_entry_matches),
    )
    if (!prereqMet) return null
  }

  const resolvedCondition = resolveComposition(rule, sharedConditions) ?? rule.condition
  const affectedIndices: number[] = []

  if (resolvedCondition) {
    for (let i = 0; i < entries.length; i++) {
      if (matchesExcludeFilter(entries[i], rule.exclude, filtersFile)) continue
      if (evaluateCondition(entries[i] as unknown as Record<string, unknown>, resolvedCondition)) {
        affectedIndices.push(i)
      }
    }
  }

  const minCount = rule.min_count ?? 1
  if (affectedIndices.length < minCount) return null

  const severity = computeSeverity(
    rule.severity,
    rule.severity_escalation,
    affectedIndices.length,
    entries.length,
  )

  const impact = computeImpact(
    entries as unknown as Record<string, unknown>[],
    affectedIndices,
    rule.impact,
  )
  const count = affectedIndices.length
  const vars: Record<string, string | number> = {
    count,
    total: entries.length,
    impact: Math.round(impact),
    s: count !== 1 ? 's' : '',
  }

  return {
    ruleId,
    category: rule.category as IssueCategory,
    severity,
    title: interpolate(rule.title, vars),
    description: interpolate(rule.description, vars),
    recommendation: interpolate(rule.recommendation, vars),
    affectedEntries: affectedIndices,
    impact,
  }
}

function evaluateAggregateRule(
  ruleId: string,
  rule: YamlRule,
  entries: NormalizedEntry[],
): Finding | null {
  if (rule.aggregate_condition?.min_entries !== undefined) {
    if (entries.length < rule.aggregate_condition.min_entries) return null
  }

  const severity = computeSeverity(
    rule.severity,
    rule.severity_escalation,
    entries.length,
    entries.length,
  )

  const vars: Record<string, string | number> = {
    count: entries.length,
    total: entries.length,
    impact: 0,
    s: entries.length !== 1 ? 's' : '',
  }

  return {
    ruleId,
    category: rule.category as IssueCategory,
    severity,
    title: interpolate(rule.title, vars),
    description: interpolate(rule.description, vars),
    recommendation: interpolate(rule.recommendation, vars),
    affectedEntries: [],
    impact: 0,
  }
}

// ── Main evaluation ─────────────────────────────────────────────

export function evaluateRules(
  rulesFile: IssueRulesFile,
  entries: NormalizedEntry[],
  sharedConditions?: SharedConditionsFile,
  filtersFile?: FiltersFile,
): Finding[] {
  const findings: Finding[] = []
  for (const [ruleId, rule] of Object.entries(rulesFile.rules)) {
    const finding = evaluateRule(ruleId, rule, entries, sharedConditions, filtersFile)
    if (finding) findings.push(finding)
  }
  return findings
}

// ── Root cause weight extraction ────────────────────────────────

export function getRootCauseWeights(
  rulesFile: IssueRulesFile,
): Map<string, Record<string, number>> {
  const weights = new Map<string, Record<string, number>>()
  for (const [ruleId, rule] of Object.entries(rulesFile.rules)) {
    if (rule.root_cause_weight) {
      const w: Record<string, number> = {}
      for (const [k, v] of Object.entries(rule.root_cause_weight)) {
        if (v !== undefined) w[k] = v
      }
      weights.set(ruleId, w)
    }
  }
  return weights
}
