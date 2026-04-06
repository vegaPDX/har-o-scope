# har-o-scope

Zero-trust intelligent HAR file analyzer. Drop a HAR file, get instant diagnosis.

[![CI](https://github.com/vegaPDX/har-o-scope/actions/workflows/ci.yml/badge.svg)](https://github.com/vegaPDX/har-o-scope/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/har-o-scope)](https://www.npmjs.com/package/har-o-scope)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)

Everything runs locally. No servers, no uploads. Your HAR data never leaves your machine.

## What do you want to do?

| I want to...                       | Start here                              |
| ---------------------------------- | --------------------------------------- |
| **Analyze a HAR file** in my browser | [Browser UI](#browser-ui)             |
| **Add HAR analysis to CI/CD**        | [CLI](#cli)                           |
| **Write custom detection rules**     | [Writing Custom Rules](#writing-custom-rules) |
| **Use it as a library**             | [Library API](#library)                |
| **Understand how it works**          | [Architecture](#architecture)         |

## Browser UI

Open [har-o-scope](https://vegaPDX.github.io/har-o-scope/) and drop a `.har` file. You get:

- Health score (0-100) with root cause classification
- Request waterfall with timing breakdown
- Categorized findings with fix recommendations
- Before/after diff comparison
- Export to JSON, CSV, or Markdown

Works offline. Dark mode. Keyboard shortcuts (`?` to see them all).

## CLI

```bash
npx har-o-scope analyze recording.har
```

```
Health Score: 62/100  ######----
Root Cause:   server (confidence: 68%)
Requests: 15 | Time: 31.2s | Analysis: 4ms

Findings (2 critical, 1 warning, 3 info)

X [critical] 5 requests with slow TTFB (> 800ms)
  ...
```

### Commands

```bash
# Output formats: text, json, markdown, sarif
har-o-scope analyze recording.har --format json

# CI mode with exit codes and GitHub annotations
har-o-scope analyze recording.har --ci --threshold 70

# Compare before/after
har-o-scope diff before.har after.har

# Strip secrets before sharing
har-o-scope sanitize recording.har -o clean.har

# Validate HAR structure and custom rules
har-o-scope validate recording.har

# Try it with built-in demo data
har-o-scope analyze --demo
```

### Exit codes

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| `0`  | Pass. No warnings or critical findings.    |
| `1`  | Warnings found.                            |
| `2`  | Critical findings, or score below threshold. |

### CI/CD Integration

SARIF output plugs directly into GitHub's Security tab:

```bash
har-o-scope analyze recording.har --sarif > results.sarif
```

See [`examples/github-action.yml`](examples/github-action.yml) for a complete GitHub Actions workflow.

## Library

```typescript
import { analyze } from 'har-o-scope'
import { readFile } from 'node:fs/promises'

const har = JSON.parse(await readFile('recording.har', 'utf-8'))
const result = analyze(har)

console.log(result.healthScore) // { score: 72, breakdown: { ... } }
console.log(result.findings)    // [{ ruleId: 'slow-ttfb', severity: 'critical', ... }]
```

Subpath imports for tree-shaking:

```typescript
import { analyze } from 'har-o-scope/analyze'
import { diff } from 'har-o-scope/diff'
import { sanitize } from 'har-o-scope/sanitize'
import { validate } from 'har-o-scope/validate'
import { computeHealthScore } from 'har-o-scope/health-score'
```

Full API docs: [docs/api/reference.md](docs/api/reference.md)

## Writing Custom Rules

Rules are YAML files. A minimal rule:

```yaml
rules:
  my-slow-api:
    category: server
    severity: warning
    title: "{count} slow API call{s}"
    description: "API requests took over 2 seconds."
    recommendation: "Check server logs."
    condition:
      match_all:
        - field: "entry.request.url"
          matches: "/api/"
        - field: "timings.wait"
          gt: 2000
```

Use it:

```bash
har-o-scope analyze recording.har --rules my-rules.yaml
```

17 built-in rules ship in `rules/generic/`. You can compose custom rules that inherit shared conditions and exclude noise filters.

Learn more:
- [Tutorial: Your First Rule](docs/rules/tutorial.md)
- [Cookbook: Common Patterns](docs/rules/cookbook.md)
- [Reference: All Fields and Operators](docs/rules/reference.md)

## Architecture

```
HAR JSON ──> Normalizer ──> Rule Engine ──> Classifier ──> Health Score
                 |                              |
                 v                              v
             Validator                     Findings[]
```

The analysis pipeline:

1. **Normalizer** parses HAR JSON, normalizes timings (replacing `-1` with `0`), classifies resource types, computes transfer sizes.
2. **Rule Engine** evaluates YAML rules against each normalized entry. Rules support conditions, inheritance, filters, severity escalation, and aggregate detection.
3. **Classifier** determines root cause (client, network, or server) using weighted scoring from rule findings.
4. **Health Score** computes a 0-100 score with per-category deductions, timing penalties, and volume penalties.

Browser: runs in a Web Worker. CLI/library: runs on the main thread. No network requests anywhere.

17 built-in rules detect: slow TTFB, stalled requests, DNS/TLS issues, missing compression, broken resources, HTTP/1.1 downgrades, missing cache headers, large payloads, redirect chains, CORS preflights, mixed content, and excessive requests.

## Requirements

- **CLI and library:** Node.js >= 20
- **Browser UI:** Any modern browser (Chrome, Firefox, Safari, Edge)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and rule contribution guidelines.

## License

[AGPL-3.0-only](LICENSE)
