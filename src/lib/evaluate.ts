/**
 * Pure rule evaluation functions. No DOM dependencies.
 * Works in Web Worker, Node.js CLI, and library consumers.
 *
 * Adapted from the reference engine (yaml_base evaluate.ts).
 * Generalized: DisplayEntry -> NormalizedEntry, stripped SF-specific fields.
 */
import type {
  FieldCondition,
  ResponseHeaderCondition,
  ConditionGroup,
  ConditionNode,
  SeverityEscalation,
  ImpactSpec,
} from './schema.js'
import type { IssueSeverity } from './types.js'

// ── Field accessor ──────────────────────────────────────────────

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function getField(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    if (BLOCKED_KEYS.has(part)) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Resolve a field value with optional fallback.
 * Fallback is used if the primary value is null, undefined, or zero.
 * Zero triggers fallback because the main use case is transferSize
 * falling back to contentSize where 0 means unavailable.
 */
function resolveFieldValue(
  entry: unknown,
  field: string,
  fieldFallback?: string,
): unknown {
  const value = getField(entry, field)
  if (fieldFallback !== undefined && (value === 0 || value == null)) {
    return getField(entry, fieldFallback)
  }
  return value
}

// ── Regex cache ─────────────────────────────────────────────────

const regexCache = new Map<string, RegExp>()

function getCachedRegex(pattern: string, flags: string): RegExp {
  const key = `${pattern}\0${flags}`
  let re = regexCache.get(key)
  if (!re) {
    re = new RegExp(pattern, flags)
    regexCache.set(key, re)
  }
  return re
}

// ── Type guards ─────────────────────────────────────────────────

export function isFieldCondition(node: ConditionNode): node is FieldCondition {
  return 'field' in node
}

export function isHeaderCondition(node: ConditionNode): node is ResponseHeaderCondition {
  return 'has_response_header' in node || 'no_response_header' in node
}

export function isConditionGroup(node: ConditionNode): node is ConditionGroup {
  return 'match_all' in node || 'match_any' in node
}

// ── Response header access ──────────────────────────────────────

function getResponseHeaders(entry: unknown): Array<{ name: string; value: string }> {
  const headers = getField(entry, 'entry.response.headers')
  return Array.isArray(headers) ? headers : []
}

// ── Condition evaluation ────────────────────────────────────────

export function evaluateFieldCondition(entry: unknown, cond: FieldCondition): boolean {
  const value = resolveFieldValue(entry, cond.field, cond.field_fallback)

  if (cond.equals !== undefined) return value === cond.equals
  if (cond.not_equals !== undefined) return value !== cond.not_equals
  if (cond.in !== undefined) return (cond.in as unknown[]).includes(value)
  if (cond.not_in !== undefined) return !(cond.not_in as unknown[]).includes(value)
  if (cond.gt !== undefined) return typeof value === 'number' && value > cond.gt
  if (cond.gte !== undefined) return typeof value === 'number' && value >= cond.gte
  if (cond.lt !== undefined) return typeof value === 'number' && value < cond.lt
  if (cond.lte !== undefined) return typeof value === 'number' && value <= cond.lte

  if (cond.matches !== undefined) {
    const str = value == null ? '' : String(value)
    return getCachedRegex(cond.matches, 'i').test(str)
  }
  if (cond.not_matches !== undefined) {
    const str = value == null ? '' : String(value)
    return !getCachedRegex(cond.not_matches, 'i').test(str)
  }

  return true
}

function evaluateHeaderCondition(entry: unknown, cond: ResponseHeaderCondition): boolean {
  const headers = getResponseHeaders(entry)

  if (cond.has_response_header) {
    const { name, value_matches, value_gt, value_lt } = cond.has_response_header
    return headers.some((h) => {
      if (h.name.toLowerCase() !== name.toLowerCase()) return false
      if (value_matches && !getCachedRegex(value_matches, 'i').test(h.value)) return false
      if (value_gt !== undefined) {
        const num = parseFloat(h.value)
        if (isNaN(num) || num <= value_gt) return false
      }
      if (value_lt !== undefined) {
        const num = parseFloat(h.value)
        if (isNaN(num) || num >= value_lt) return false
      }
      return true
    })
  }

  if (cond.no_response_header) {
    const { name, value_matches } = cond.no_response_header
    const matchingHeader = headers.some((h) => {
      if (h.name.toLowerCase() !== name.toLowerCase()) return false
      if (value_matches) return getCachedRegex(value_matches, 'i').test(h.value)
      return true
    })
    return !matchingHeader
  }

  return true
}

export function evaluateCondition(entry: unknown, node: ConditionNode): boolean {
  if (isFieldCondition(node)) return evaluateFieldCondition(entry, node)
  if (isHeaderCondition(node)) return evaluateHeaderCondition(entry, node)
  if (isConditionGroup(node)) {
    if (node.match_all) return node.match_all.every((child) => evaluateCondition(entry, child))
    if (node.match_any) return node.match_any.some((child) => evaluateCondition(entry, child))
  }
  return true
}

// ── Severity computation ────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = { info: 0, warning: 1, critical: 2 }

function escalateIfHigher(current: IssueSeverity, candidate: IssueSeverity): IssueSeverity {
  return (SEVERITY_ORDER[candidate] ?? 0) > (SEVERITY_ORDER[current] ?? 0) ? candidate : current
}

export function computeSeverity(
  baseSeverity: IssueSeverity,
  escalation: SeverityEscalation | undefined,
  affectedCount: number,
  totalCount: number,
): IssueSeverity {
  if (!escalation) return baseSeverity
  let severity = baseSeverity
  const ratio = totalCount > 0 ? affectedCount / totalCount : 0

  if (escalation.warning_threshold !== undefined && affectedCount >= escalation.warning_threshold) {
    severity = escalateIfHigher(severity, 'warning')
  }
  if (escalation.warning_ratio !== undefined && ratio > escalation.warning_ratio) {
    severity = escalateIfHigher(severity, 'warning')
  }
  if (escalation.critical_threshold !== undefined && affectedCount >= escalation.critical_threshold) {
    severity = escalateIfHigher(severity, 'critical')
  }
  if (escalation.critical_ratio !== undefined && ratio > escalation.critical_ratio) {
    severity = escalateIfHigher(severity, 'critical')
  }

  return severity
}

// ── Impact computation ──────────────────────────────────────────

export function computeImpact(
  entries: unknown[],
  affectedIndices: number[],
  impactSpec: ImpactSpec | undefined,
): number {
  if (!impactSpec) return 0
  if (impactSpec.value !== undefined) return impactSpec.value

  let total = 0
  const baseline = impactSpec.baseline ?? 0

  for (const idx of affectedIndices) {
    const entry = entries[idx]
    if (impactSpec.field) {
      const val = getField(entry, impactSpec.field)
      if (typeof val === 'number') total += val - baseline
    }
    if (impactSpec.fields) {
      let entrySum = 0
      for (const f of impactSpec.fields) {
        const val = getField(entry, f)
        if (typeof val === 'number') entrySum += val
      }
      total += entrySum - baseline
    }
  }

  return total
}

// ── Template interpolation ──────────────────────────────────────

export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key in vars) return String(vars[key])
    return `{${key}}`
  })
}
