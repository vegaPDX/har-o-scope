/**
 * Core type definitions for har-o-scope.
 * No DOM dependencies. Used by library, CLI, and Web Worker.
 */
import type { Har, Entry, Header } from 'har-format'

// ── Normalized Entry ───────────────────────────────────────────

export type ResourceType =
  | 'document'
  | 'script'
  | 'stylesheet'
  | 'image'
  | 'font'
  | 'media'
  | 'xhr'
  | 'fetch'
  | 'websocket'
  | 'other'

export interface NormalizedTimings {
  blocked: number
  dns: number
  connect: number
  ssl: number
  send: number
  wait: number
  receive: number
  total: number
}

export interface NormalizedEntry {
  /** Original HAR entry */
  entry: Entry
  /** Milliseconds since the first entry's startedDateTime */
  startTimeMs: number
  /** Total request duration in ms (sum of all timing phases) */
  totalDuration: number
  /** Resolved transfer size: transferSize > 0 ? transferSize : content.size */
  transferSizeResolved: number
  /** Resolved content size from response.content.size */
  contentSize: number
  /** Parsed timings with -1 replaced by 0 */
  timings: NormalizedTimings
  /** Detected resource type */
  resourceType: ResourceType
  /** True if this looks like a long-poll (wait > 25s + small body, or SSE) */
  isLongPoll: boolean
  /** True if this is a WebSocket connection */
  isWebSocket: boolean
  /** HTTP version string from the request */
  httpVersion: string
}

// ── Analysis Results ───────────────────────────────────────────

export type IssueSeverity = 'info' | 'warning' | 'critical'

export type IssueCategory =
  | 'server'
  | 'network'
  | 'client'
  | 'optimization'
  | 'security'
  | 'errors'
  | 'informational'
  | 'performance'

export interface Finding {
  /** Rule ID that produced this finding */
  ruleId: string
  /** Issue category */
  category: IssueCategory
  /** Final severity (after escalation) */
  severity: IssueSeverity
  /** Human-readable title (interpolated) */
  title: string
  /** Detailed description (interpolated) */
  description: string
  /** Fix recommendation (interpolated) */
  recommendation: string
  /** Indices into the NormalizedEntry array */
  affectedEntries: number[]
  /** Computed impact value */
  impact: number
}

export interface RootCauseResult {
  client: number
  network: number
  server: number
}

export interface AnalysisWarning {
  code: string
  message: string
  help: string
  docsUrl: string
}

export interface AnalysisMetadata {
  rulesEvaluated: number
  customRulesLoaded: number
  analysisTimeMs: number
  totalRequests: number
  totalTimeMs: number
}

export interface AnalysisResult {
  /** Normalized entries */
  entries: NormalizedEntry[]
  /** Detected findings */
  findings: Finding[]
  /** Root cause classification */
  rootCause: RootCauseResult
  /** Non-fatal warnings encountered during analysis */
  warnings: AnalysisWarning[]
  /** Analysis metadata */
  metadata: AnalysisMetadata
}

export interface AnalysisOptions {
  /** Path to custom YAML rules file or directory */
  customRules?: string
  /** Custom rules as parsed YAML objects */
  customRulesData?: unknown[]
  /** Disable built-in rules */
  noBuiltin?: boolean
  /** Minimum severity to include in findings */
  minSeverity?: IssueSeverity
}

// ── Health Score ────────────────────────────────────────────────

export interface ScoreDeduction {
  reason: string
  points: number
}

export interface ScoreBreakdown {
  findingDeductions: ScoreDeduction[]
  timingPenalty: number
  volumePenalty: number
  confidenceMultiplier: number
  totalDeductions: number
}

export interface HealthScore {
  score: number
  breakdown: ScoreBreakdown
}

// ── Diff ────────────────────────────────────────────────────────

export interface TimingDelta {
  urlPattern: string
  beforeCount: number
  afterCount: number
  beforeAvgMs: number
  afterAvgMs: number
  deltaMs: number
  deltaPercent: number
}

export interface FindingDelta {
  ruleId: string
  beforeSeverity: IssueSeverity
  afterSeverity: IssueSeverity
  beforeCount: number
  afterCount: number
}

export interface DiffResult {
  scoreDelta: number
  newFindings: Finding[]
  resolvedFindings: Finding[]
  persistedFindings: FindingDelta[]
  timingDeltas: TimingDelta[]
  requestCountDelta: number
  totalTimeDelta: number
}

// ── Sanitization ───────────────────────────────────────────────

export type SanitizeMode = 'aggressive' | 'selective'

export interface SanitizeOptions {
  mode: SanitizeMode
  /** Categories to sanitize in selective mode */
  categories?: SanitizeCategory[]
}

export type SanitizeCategory =
  | 'cookies'
  | 'auth-headers'
  | 'query-params'
  | 'response-cookies'
  | 'jwt-signatures'
  | 'high-entropy'

// ── Validation ─────────────────────────────────────────────────

export interface ValidationError {
  code: string
  message: string
  line?: number
  column?: number
  help: string
  docsUrl: string
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

// ── HAR type re-export for convenience ─────────────────────────

export type { Har, Entry, Header }
