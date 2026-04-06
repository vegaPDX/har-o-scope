/**
 * Error system for har-o-scope.
 * Two channels: thrown HarError for fatal, result.warnings[] for non-fatal.
 */

export interface HarErrorOptions {
  code: string
  message: string
  help: string
  docsUrl?: string
}

const DOCS_BASE = 'https://github.com/vegaPDX/har-o-scope/blob/main/docs/errors'

export class HarError extends Error {
  readonly code: string
  readonly help: string
  readonly docsUrl: string

  constructor(opts: HarErrorOptions) {
    super(opts.message)
    this.name = 'HarError'
    this.code = opts.code
    this.help = opts.help
    this.docsUrl = opts.docsUrl ?? `${DOCS_BASE}/${opts.code}.md`

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, HarError.prototype)
  }
}

// ── Error code constants ───────────────────────────────────────

/** HAR parse/validation errors */
export const HAR_ERRORS = {
  /** Input is not valid JSON */
  HAR001: 'HAR001',
  /** Valid JSON but not a valid HAR file (missing log property) */
  HAR002: 'HAR002',
  /** HAR file has no entries */
  HAR003: 'HAR003',
  /** HAR file exceeds size limit */
  HAR004: 'HAR004',
} as const

/** Rule engine errors */
export const RULE_ERRORS = {
  /** Invalid YAML syntax in rule file */
  RULE001: 'RULE001',
  /** Unknown field path in rule condition */
  RULE002: 'RULE002',
  /** Circular inheritance in rule composition */
  RULE003: 'RULE003',
  /** Invalid rule schema (missing required fields) */
  RULE004: 'RULE004',
  /** Contradictory conditions detected */
  RULE005: 'RULE005',
  /** Condition nesting too deep (>5 levels) */
  RULE006: 'RULE006',
  /** Unknown operator in condition */
  RULE007: 'RULE007',
  /** Invalid severity value */
  RULE008: 'RULE008',
} as const

/** CLI-specific errors */
export const CLI_ERRORS = {
  /** File not found */
  CLI001: 'CLI001',
  /** Invalid CLI arguments */
  CLI002: 'CLI002',
} as const

// ── Warning factory ────────────────────────────────────────────

import type { AnalysisWarning } from './types.js'

export function createWarning(
  code: string,
  message: string,
  help: string,
): AnalysisWarning {
  return {
    code,
    message,
    help,
    docsUrl: `${DOCS_BASE}/${code}.md`,
  }
}
