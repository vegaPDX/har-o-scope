# API Reference

har-o-scope exports a library API for programmatic HAR analysis. All functions are synchronous (no async, no network).

## Installation

```bash
npm install har-o-scope
```

## Root import

```typescript
import { analyze, diff, sanitize, validate, computeHealthScore } from 'har-o-scope'
```

## Subpath imports

For tree-shaking or when you only need one function:

```typescript
import { analyze } from 'har-o-scope/analyze'
import { diff } from 'har-o-scope/diff'
import { sanitize } from 'har-o-scope/sanitize'
import { validate } from 'har-o-scope/validate'
import { computeHealthScore } from 'har-o-scope/health-score'
```

---

## analyze

Analyze a HAR file for performance, security, and correctness issues.

```typescript
function analyze(input: string | Har, options?: AnalysisOptions): AnalysisResult
```

**Parameters:**
- `input` — HAR JSON as a string or parsed `Har` object
- `options.customRulesData` — Additional rules as parsed YAML objects
- `options.noBuiltin` — Disable built-in rules (default: `false`)
- `options.minSeverity` — Minimum severity to include: `'info'`, `'warning'`, or `'critical'`

**Returns:** `AnalysisResult`

```typescript
interface AnalysisResult {
  entries: NormalizedEntry[]    // Normalized HAR entries
  findings: Finding[]          // Detected issues
  rootCause: RootCauseResult   // { client, network, server } scores
  warnings: AnalysisWarning[]  // Non-fatal warnings
  metadata: AnalysisMetadata   // Timing, counts
}
```

**Example:**

```typescript
import { analyze } from 'har-o-scope'
import { readFile } from 'node:fs/promises'

const har = JSON.parse(await readFile('recording.har', 'utf-8'))
const result = analyze(har)

console.log(`${result.findings.length} findings`)
console.log(`Root cause: ${
  result.rootCause.server > result.rootCause.client ? 'server' : 'client'
}`)
```

---

## diff

Compare two HAR analyses for regressions and improvements.

```typescript
function diff(before: AnalysisResult, after: AnalysisResult): DiffResult
```

**Parameters:**
- `before` — Analysis result from the baseline HAR
- `after` — Analysis result from the new HAR

**Returns:** `DiffResult`

```typescript
interface DiffResult {
  scoreDelta: number              // Health score change
  newFindings: Finding[]          // Findings only in `after`
  resolvedFindings: Finding[]     // Findings only in `before`
  persistedFindings: FindingDelta[] // Findings in both
  timingDeltas: TimingDelta[]     // Per-URL timing changes
  requestCountDelta: number       // Change in total requests
  totalTimeDelta: number          // Change in total time
}
```

**Example:**

```typescript
import { analyze, diff } from 'har-o-scope'

const before = analyze(baselineHar)
const after = analyze(currentHar)
const result = diff(before, after)

if (result.newFindings.length > 0) {
  console.log(`${result.newFindings.length} new issues detected`)
}
```

---

## sanitize

Strip secrets, tokens, and sensitive data from a HAR file.

```typescript
function sanitize(har: Har, options?: SanitizeOptions): Har
```

**Parameters:**
- `har` — Parsed HAR object
- `options.mode` — `'aggressive'` (strip everything) or `'selective'` (choose categories)
- `options.categories` — Array of categories for selective mode: `'cookies'`, `'auth-headers'`, `'query-params'`, `'response-cookies'`, `'jwt-signatures'`, `'high-entropy'`

**Returns:** A deep clone of the HAR with sensitive data redacted. The input is never mutated.

**Example:**

```typescript
import { sanitize, parseHar } from 'har-o-scope'
import { readFile, writeFile } from 'node:fs/promises'

const har = parseHar(await readFile('recording.har', 'utf-8'))
const clean = sanitize(har, { mode: 'aggressive' })
await writeFile('clean.har', JSON.stringify(clean, null, 2))
```

---

## validate

Validate HAR file structure and/or custom YAML rules.

```typescript
function validate(yamlContent: string, sharedConditions?: SharedConditionsFile): ValidationResult
```

**Parameters:**
- `yamlContent` — YAML rule file content as a string
- `sharedConditions` — Optional shared conditions for inheritance validation

**Returns:** `ValidationResult`

```typescript
interface ValidationResult {
  valid: boolean
  errors: ValidationError[]   // Fatal issues
  warnings: ValidationError[] // Non-fatal issues
}

interface ValidationError {
  code: string      // Error code (e.g., 'RULE004')
  message: string   // Human-readable message
  help: string      // Fix suggestion
  docsUrl: string   // Link to error docs
  suggestion?: string
}
```

**Example:**

```typescript
import { validate } from 'har-o-scope'
import { readFile } from 'node:fs/promises'

const yaml = await readFile('my-rules.yaml', 'utf-8')
const result = validate(yaml)

if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.code}: ${err.message}`)
    console.error(`  Fix: ${err.help}`)
  }
}
```

---

## computeHealthScore

Compute a 0-100 health score from analysis results.

```typescript
function computeHealthScore(result: AnalysisResult): HealthScore
function computeHealthScoreFromParts(
  findings: Finding[],
  rootCause: RootCauseResult,
  entries: NormalizedEntry[],
): HealthScore
```

**Parameters:**
- `result` — Full analysis result (for `computeHealthScore`)
- `findings`, `rootCause`, `entries` — Individual parts (for `computeHealthScoreFromParts`)

**Returns:** `HealthScore`

```typescript
interface HealthScore {
  score: number            // 0-100
  breakdown: ScoreBreakdown
}

interface ScoreBreakdown {
  findingDeductions: ScoreDeduction[]  // Per-finding point deductions
  timingPenalty: number                // Penalty for high median TTFB
  volumePenalty: number                // Penalty for excessive requests
  confidenceMultiplier: number         // Root cause confidence factor
  totalDeductions: number              // Sum of all deductions
}
```

**Scoring formula:**
- Base: 100
- Critical finding: -15 per finding
- Warning finding: -5 per finding
- Info finding: -1 per finding
- Multiplied by confidence factor (1.0x high, 0.7x medium, 0.5x low)
- Timing penalty: -10 if median TTFB > 1000ms, -20 if > 2000ms
- Volume penalty: -5 if > 200 requests, -10 if > 500 requests
- Floor: 0, ceiling: 100

---

## parseHar / normalizeHar

Lower-level functions for advanced consumers.

```typescript
function parseHar(input: string): Har
function normalizeHar(har: Har): { entries: NormalizedEntry[], warnings: AnalysisWarning[] }
```

`parseHar` validates JSON and HAR structure, throwing `HarError` on failure.
`normalizeHar` converts raw HAR entries into `NormalizedEntry` objects with resolved timings, resource types, and transfer sizes.

---

## Error handling

Fatal errors throw `HarError`:

```typescript
import { HarError } from 'har-o-scope'

try {
  const result = analyze('not json')
} catch (e) {
  if (e instanceof HarError) {
    console.error(e.code)    // 'HAR001'
    console.error(e.help)    // How to fix it
    console.error(e.docsUrl) // Link to error docs
  }
}
```

Non-fatal issues are in `result.warnings`:

```typescript
const result = analyze(har)
for (const w of result.warnings) {
  console.warn(`${w.code}: ${w.message}`)
}
```

Error codes: [docs/errors/](../errors/)

---

## Types

All types are exported for TypeScript consumers:

```typescript
import type {
  // Analysis
  AnalysisResult, AnalysisOptions, AnalysisWarning, AnalysisMetadata,
  Finding, RootCauseResult, IssueSeverity, IssueCategory,
  // Entries
  NormalizedEntry, NormalizedTimings, ResourceType,
  // Health
  HealthScore, ScoreBreakdown, ScoreDeduction,
  // Diff
  DiffResult, TimingDelta, FindingDelta,
  // Sanitize
  SanitizeOptions, SanitizeCategory, SanitizeMode,
  // Validate
  ValidationResult, ValidationError,
  // HAR
  Har, Entry, Header,
  // Schema (for rule authors)
  YamlRule, IssueRulesFile, SharedConditionsFile, FiltersFile,
  FieldCondition, ConditionNode, ConditionGroup,
} from 'har-o-scope'
```
