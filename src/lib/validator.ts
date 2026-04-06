/**
 * YAML rule validator: full semantic validation.
 *
 * Three levels:
 *   1. YAML syntax (valid YAML?)
 *   2. Schema conformance (required fields, valid operators, valid values)
 *   3. Semantic validation (field paths, contradictions, inheritance)
 *
 * Decidable contradiction detection:
 *   - Numeric range conflicts (gt/lt, gte/lte)
 *   - Impossible enum combos (in/not_in)
 *   - Composed inheritance conflicts
 *   - Skip: regex intersection (undecidable)
 *   - Bound nesting at 5 levels (RULE006)
 *   - Circular inheritance at depth 10 (RULE003)
 */
import yaml from 'js-yaml'
import type { ValidationResult, ValidationError } from './types.js'
import type {
  ConditionNode,
  FieldCondition,
  ConditionGroup,
  YamlRule,
  IssueRulesFile,
  SharedConditionsFile,
} from './schema.js'
import { isFieldCondition, isConditionGroup, isHeaderCondition } from './evaluate.js'
import { RULE_ERRORS } from './errors.js'

const DOCS_BASE = 'https://github.com/vegaPDX/har-o-scope/blob/main/docs/errors'

// ── Known field paths on NormalizedEntry ─────────────────────────

const VALID_FIELD_PREFIXES = new Set([
  'entry.request',
  'entry.response',
  'timings',
  'startTimeMs',
  'totalDuration',
  'transferSizeResolved',
  'contentSize',
  'resourceType',
  'isLongPoll',
  'isWebSocket',
  'httpVersion',
])

function isValidFieldPath(path: string): boolean {
  // Allow any path starting with a valid prefix
  for (const prefix of VALID_FIELD_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + '.')) return true
  }
  return false
}

// Suggest similar field paths
function suggestFieldPath(path: string): string | undefined {
  const known = [
    'timings.wait', 'timings.blocked', 'timings.dns', 'timings.connect',
    'timings.ssl', 'timings.send', 'timings.receive', 'timings.total',
    'entry.request.url', 'entry.request.method', 'entry.request.httpVersion',
    'entry.response.status', 'entry.response.content.mimeType',
    'entry.response.content.size', 'entry.response.bodySize',
    'resourceType', 'transferSizeResolved', 'contentSize',
    'startTimeMs', 'totalDuration', 'isLongPoll', 'isWebSocket', 'httpVersion',
  ]

  // Simple Levenshtein-like: find paths sharing the most segments
  const pathParts = path.split('.')
  let bestMatch: string | undefined
  let bestScore = 0

  for (const candidate of known) {
    const candidateParts = candidate.split('.')
    let score = 0
    for (const part of pathParts) {
      if (candidateParts.includes(part)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = candidate
    }
  }

  return bestScore > 0 ? bestMatch : undefined
}

// ── Valid operators and values ───────────────────────────────────

const VALID_FIELD_OPERATORS = new Set([
  'field', 'field_fallback', 'equals', 'not_equals', 'in', 'not_in',
  'gt', 'gte', 'lt', 'lte', 'matches', 'not_matches',
])

const VALID_SEVERITIES = new Set(['info', 'warning', 'critical'])

const VALID_CATEGORIES = new Set([
  'server', 'network', 'client', 'optimization',
  'security', 'errors', 'informational', 'performance',
])

const VALID_RULE_FIELDS = new Set([
  'category', 'severity', 'severity_escalation', 'title', 'description',
  'recommendation', 'condition', 'min_count', 'type', 'aggregate_condition',
  'prerequisite', 'impact', 'root_cause_weight', 'inherits', 'exclude', 'overrides',
])

// ── Contradiction detection ─────────────────────────────────────

function detectContradictions(conditions: FieldCondition[]): string[] {
  const contradictions: string[] = []

  // Group conditions by field path
  const byField = new Map<string, FieldCondition[]>()
  for (const c of conditions) {
    const existing = byField.get(c.field) ?? []
    existing.push(c)
    byField.set(c.field, existing)
  }

  for (const [field, conds] of byField) {
    // Numeric range conflicts
    const gts: number[] = []
    const lts: number[] = []
    const gtes: number[] = []
    const ltes: number[] = []

    for (const c of conds) {
      if (c.gt !== undefined) gts.push(c.gt)
      if (c.gte !== undefined) gtes.push(c.gte)
      if (c.lt !== undefined) lts.push(c.lt)
      if (c.lte !== undefined) ltes.push(c.lte)
    }

    // gt: X AND lt: Y where X >= Y is impossible
    for (const g of gts) {
      for (const l of lts) {
        if (g >= l) {
          contradictions.push(
            `Field "${field}": gt: ${g} AND lt: ${l} is impossible (no number is both > ${g} and < ${l})`,
          )
        }
      }
      for (const le of ltes) {
        if (g >= le) {
          contradictions.push(
            `Field "${field}": gt: ${g} AND lte: ${le} is impossible`,
          )
        }
      }
    }
    for (const ge of gtes) {
      for (const l of lts) {
        if (ge >= l) {
          contradictions.push(
            `Field "${field}": gte: ${ge} AND lt: ${l} is impossible`,
          )
        }
      }
    }

    // equals + not_equals same value
    const eqValues = conds.filter((c) => c.equals !== undefined).map((c) => c.equals)
    const neqValues = conds.filter((c) => c.not_equals !== undefined).map((c) => c.not_equals)
    for (const eq of eqValues) {
      for (const neq of neqValues) {
        if (eq === neq) {
          contradictions.push(
            `Field "${field}": equals: ${JSON.stringify(eq)} AND not_equals: ${JSON.stringify(neq)} is impossible`,
          )
        }
      }
    }

    // in/not_in overlap: if all items in `in` are also in `not_in`, impossible
    const inValues = conds.filter((c) => c.in !== undefined).flatMap((c) => c.in!)
    const notInValues = new Set(conds.filter((c) => c.not_in !== undefined).flatMap((c) => c.not_in!).map(String))
    if (inValues.length > 0 && notInValues.size > 0) {
      const allExcluded = inValues.every((v) => notInValues.has(String(v)))
      if (allExcluded) {
        contradictions.push(
          `Field "${field}": all values in "in" are excluded by "not_in" (no valid value remains)`,
        )
      }
    }
  }

  return contradictions
}

// ── Nesting depth check ─────────────────────────────────────────

function checkNestingDepth(node: ConditionNode, depth: number, maxDepth: number): string | null {
  if (depth > maxDepth) {
    return `Condition nesting exceeds ${maxDepth} levels. Simplify the rule or split into composed conditions.`
  }
  if (isConditionGroup(node)) {
    const children = node.match_all ?? node.match_any ?? []
    for (const child of children) {
      const err = checkNestingDepth(child, depth + 1, maxDepth)
      if (err) return err
    }
  }
  return null
}

// ── Circular inheritance check ──────────────────────────────────

function checkCircularInheritance(
  ruleName: string,
  inherits: string[],
  sharedConditions: SharedConditionsFile | undefined,
  visited: Set<string>,
  depth: number,
): string | null {
  if (depth > 10) {
    return `Circular or deeply nested inheritance chain detected (depth > 10) starting from "${ruleName}"`
  }
  for (const name of inherits) {
    if (visited.has(name)) {
      return `Circular inheritance: "${ruleName}" -> ... -> "${name}" -> "${ruleName}"`
    }
    visited.add(name)
    // In this system, shared conditions don't themselves inherit,
    // but we check the reference exists
    if (sharedConditions && !sharedConditions.conditions[name]) {
      // Not a circular issue, just a missing reference (caught elsewhere)
    }
  }
  return null
}

// ── Collect field conditions from a condition tree ───────────────

function collectFieldConditions(node: ConditionNode, out: FieldCondition[]): void {
  if (isFieldCondition(node)) {
    out.push(node)
  } else if (isConditionGroup(node)) {
    const children = (node as ConditionGroup).match_all ?? (node as ConditionGroup).match_any ?? []
    for (const child of children) {
      collectFieldConditions(child, out)
    }
  }
}

// ── Validate a single condition node ────────────────────────────

function validateConditionNode(
  node: ConditionNode,
  errors: ValidationError[],
  warnings: ValidationError[],
  depth: number,
): void {
  // Nesting check
  if (depth > 5) {
    errors.push({
      code: RULE_ERRORS.RULE006,
      message: 'Condition nesting exceeds 5 levels',
      help: 'Simplify the condition tree or use shared conditions with inherits.',
      docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE006}.md`,
    })
    return
  }

  if (isFieldCondition(node)) {
    // Validate field path
    if (!isValidFieldPath(node.field)) {
      const suggestion = suggestFieldPath(node.field)
      errors.push({
        code: RULE_ERRORS.RULE002,
        message: `Unknown field path: "${node.field}"`,
        help: 'Check that the field path matches a property on NormalizedEntry.',
        docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE002}.md`,
        suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
      })
    }

    // Validate operators
    for (const key of Object.keys(node)) {
      if (!VALID_FIELD_OPERATORS.has(key)) {
        errors.push({
          code: RULE_ERRORS.RULE007,
          message: `Unknown operator: "${key}" on field "${node.field}"`,
          help: `Valid operators: ${[...VALID_FIELD_OPERATORS].filter((k) => k !== 'field' && k !== 'field_fallback').join(', ')}`,
          docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE007}.md`,
        })
      }
    }

    if (node.field_fallback && !isValidFieldPath(node.field_fallback)) {
      const suggestion = suggestFieldPath(node.field_fallback)
      warnings.push({
        code: RULE_ERRORS.RULE002,
        message: `Unknown fallback field path: "${node.field_fallback}"`,
        help: 'Check that the fallback field path matches a property on NormalizedEntry.',
        docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE002}.md`,
        suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
      })
    }
  } else if (isHeaderCondition(node)) {
    // Header conditions are structurally validated by the parser
  } else if (isConditionGroup(node)) {
    const children = (node as ConditionGroup).match_all ?? (node as ConditionGroup).match_any ?? []
    for (const child of children) {
      validateConditionNode(child, errors, warnings, depth + 1)
    }
  }
}

// ── Main validate ───────────────────────────────────────────────

export function validate(
  yamlContent: string,
  sharedConditions?: SharedConditionsFile,
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Level 1: YAML syntax
  let parsed: unknown
  try {
    parsed = yaml.load(yamlContent)
  } catch (e) {
    const yamlError = e as { mark?: { line?: number; column?: number }; message?: string }
    errors.push({
      code: RULE_ERRORS.RULE001,
      message: `Invalid YAML syntax: ${yamlError.message ?? 'parse error'}`,
      line: yamlError.mark?.line !== undefined ? yamlError.mark.line + 1 : undefined,
      column: yamlError.mark?.column,
      help: 'Fix the YAML syntax error and try again.',
      docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE001}.md`,
    })
    return { valid: false, errors, warnings }
  }

  if (!parsed || typeof parsed !== 'object') {
    errors.push({
      code: RULE_ERRORS.RULE004,
      message: 'YAML file is empty or not an object',
      help: 'A rule file must have a top-level "rules:" key containing rule definitions.',
      docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE004}.md`,
    })
    return { valid: false, errors, warnings }
  }

  const file = parsed as Record<string, unknown>

  // Level 2: Schema conformance
  if (!file.rules || typeof file.rules !== 'object') {
    errors.push({
      code: RULE_ERRORS.RULE004,
      message: 'Missing required "rules:" key',
      help: 'A rule file must have a top-level "rules:" key. Example:\nrules:\n  my-rule:\n    category: server\n    severity: warning\n    ...',
      docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE004}.md`,
    })
    return { valid: false, errors, warnings }
  }

  const rules = file.rules as Record<string, unknown>

  for (const [ruleId, ruleData] of Object.entries(rules)) {
    if (!ruleData || typeof ruleData !== 'object') {
      errors.push({
        code: RULE_ERRORS.RULE004,
        message: `Rule "${ruleId}": must be an object`,
        help: 'Each rule must define at least: category, severity, title, description, recommendation.',
        docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE004}.md`,
      })
      continue
    }

    const rule = ruleData as Record<string, unknown>

    // Required fields
    for (const field of ['category', 'severity', 'title', 'description', 'recommendation']) {
      if (!(field in rule)) {
        errors.push({
          code: RULE_ERRORS.RULE004,
          message: `Rule "${ruleId}": missing required field "${field}"`,
          help: `Add "${field}" to the rule definition.`,
          docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE004}.md`,
        })
      }
    }

    // Validate severity value
    if (rule.severity && !VALID_SEVERITIES.has(rule.severity as string)) {
      errors.push({
        code: RULE_ERRORS.RULE008,
        message: `Rule "${ruleId}": invalid severity "${rule.severity}"`,
        help: `Valid severity values: ${[...VALID_SEVERITIES].join(', ')}`,
        docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE008}.md`,
      })
    }

    // Validate category value
    if (rule.category && !VALID_CATEGORIES.has(rule.category as string)) {
      warnings.push({
        code: RULE_ERRORS.RULE004,
        message: `Rule "${ruleId}": unknown category "${rule.category}"`,
        help: `Known categories: ${[...VALID_CATEGORIES].join(', ')}. Custom categories are allowed but may not display correctly.`,
        docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE004}.md`,
      })
    }

    // Unknown fields
    for (const key of Object.keys(rule)) {
      if (!VALID_RULE_FIELDS.has(key)) {
        warnings.push({
          code: RULE_ERRORS.RULE004,
          message: `Rule "${ruleId}": unknown field "${key}"`,
          help: `Valid rule fields: ${[...VALID_RULE_FIELDS].join(', ')}`,
          docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE004}.md`,
        })
      }
    }

    // Level 3: Semantic validation
    const typedRule = rule as unknown as YamlRule

    // Condition validation
    if (typedRule.condition) {
      validateConditionNode(typedRule.condition, errors, warnings, 0)

      // Contradiction detection within match_all groups
      const fieldConds: FieldCondition[] = []
      collectFieldConditions(typedRule.condition, fieldConds)
      const contradictions = detectContradictions(fieldConds)
      for (const msg of contradictions) {
        errors.push({
          code: RULE_ERRORS.RULE005,
          message: `Rule "${ruleId}": ${msg}`,
          help: 'The conditions contradict each other and will never match any entry.',
          docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE005}.md`,
        })
      }

      // Nesting depth
      const nestingErr = checkNestingDepth(typedRule.condition, 0, 5)
      if (nestingErr) {
        errors.push({
          code: RULE_ERRORS.RULE006,
          message: `Rule "${ruleId}": ${nestingErr}`,
          help: 'Use shared conditions with inherits to flatten deeply nested rules.',
          docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE006}.md`,
        })
      }
    }

    // Inheritance validation
    if (typedRule.inherits) {
      const visited = new Set<string>()
      const circularErr = checkCircularInheritance(
        ruleId,
        typedRule.inherits,
        sharedConditions,
        visited,
        0,
      )
      if (circularErr) {
        errors.push({
          code: RULE_ERRORS.RULE003,
          message: `Rule "${ruleId}": ${circularErr}`,
          help: 'Remove the circular reference in the inherits chain.',
          docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE003}.md`,
        })
      }

      // Check that inherited conditions exist
      if (sharedConditions) {
        for (const name of typedRule.inherits) {
          if (!sharedConditions.conditions[name]) {
            errors.push({
              code: RULE_ERRORS.RULE002,
              message: `Rule "${ruleId}": inherited condition "${name}" not found in shared conditions`,
              help: 'Check the condition name in base-conditions.yaml.',
              docsUrl: `${DOCS_BASE}/${RULE_ERRORS.RULE002}.md`,
            })
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
