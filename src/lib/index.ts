/**
 * har-o-scope public API.
 *
 * This barrel file IS the API contract. Anything not re-exported here is internal.
 * ~15 public exports specified in eng review #2.
 */

// Analysis
export { analyze, setBuiltinRules } from './analyze.js'
export type { AnalysisResult, AnalysisOptions } from './types.js'

// Diff
export { diff } from './diff.js'
export { normalizeUrlForGrouping } from './diff.js'
export type { DiffResult, TimingDelta, FindingDelta } from './types.js'

// Health Score
export { computeHealthScore, computeHealthScoreFromParts } from './health-score.js'
export type { HealthScore, ScoreBreakdown, ScoreDeduction } from './types.js'

// Sanitization
export { sanitize } from './sanitizer.js'
export { sanitizeTrace, sanitizeUrl, sanitizeHeaderValue } from './trace-sanitizer.js'
export type { SanitizeOptions, SanitizeCategory, SanitizeMode } from './types.js'

// Validation
export { validate } from './validator.js'
export type { ValidationResult, ValidationError } from './types.js'

// Parsing / Normalization (useful for advanced consumers)
export { parseHar, normalizeHar } from './normalizer.js'

// HTML Report
export { generateHtmlReport } from './html-report.js'
export type { HtmlReportOptions } from './html-report.js'

// Errors
export { HarError, HAR_ERRORS, RULE_ERRORS, CLI_ERRORS, createWarning } from './errors.js'
export type { AnalysisWarning } from './types.js'

// Types consumers need
export type {
  NormalizedEntry,
  NormalizedTimings,
  ResourceType,
  Finding,
  RootCauseResult,
  IssueSeverity,
  IssueCategory,
  AnalysisMetadata,
  Har,
  Entry,
  Header,
} from './types.js'

// Schema types (for rule authors)
export type {
  YamlRule,
  IssueRulesFile,
  SharedConditionsFile,
  FiltersFile,
  FieldCondition,
  ConditionNode,
  ConditionGroup,
  ResponseHeaderCondition,
  SeverityEscalation,
  ImpactSpec,
  RootCauseWeight,
} from './schema.js'
