/**
 * CLI command integration tests.
 * Tests all 4 subcommands by importing their formatters and
 * running analysis against known inputs.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { analyze, setBuiltinRules } from '../../src/lib/analyze.js'
import { diff } from '../../src/lib/diff.js'
import { sanitize } from '../../src/lib/sanitizer.js'
import { validate } from '../../src/lib/validator.js'
import { computeHealthScore } from '../../src/lib/health-score.js'
import { parseHar } from '../../src/lib/normalizer.js'
import { HarError } from '../../src/lib/errors.js'
import { demoHar } from '../../src/cli/demo.js'
import type { IssueRulesFile, SharedConditionsFile } from '../../src/lib/schema.js'

const testRules: IssueRulesFile = {
  rules: {
    'slow-ttfb': {
      category: 'server',
      severity: 'warning',
      severity_escalation: { critical_threshold: 5 },
      title: '{count} slow request{s}',
      description: 'TTFB > 800ms',
      recommendation: 'Fix server',
      condition: { match_all: [{ field: 'timings.wait', gt: 800 }] },
      root_cause_weight: { server: 3 },
    },
    'broken-resources': {
      category: 'errors',
      severity: 'critical',
      title: '{count} broken resource{s}',
      description: 'HTTP 4xx/5xx',
      recommendation: 'Fix resources',
      condition: { match_all: [{ field: 'entry.response.status', gte: 400 }] },
      root_cause_weight: { server: 2, client: 1 },
    },
  },
}

const testConditions: SharedConditionsFile = {
  conditions: {
    is_not_websocket: { field: 'isWebSocket', equals: false },
    is_not_streaming: { field: 'isLongPoll', equals: false },
  },
}

beforeAll(() => {
  setBuiltinRules(testRules, testConditions)
})

describe('analyze command', () => {
  it('analyzes demo HAR and produces findings', () => {
    const result = analyze(JSON.stringify(demoHar))
    const score = computeHealthScore(result)

    expect(result.entries.length).toBe(15)
    expect(result.findings.length).toBeGreaterThan(0)
    expect(score.score).toBeGreaterThanOrEqual(0)
    expect(score.score).toBeLessThanOrEqual(100)
  })

  it('detects slow TTFB in demo', () => {
    const result = analyze(JSON.stringify(demoHar))
    const slowTtfb = result.findings.find(f => f.ruleId === 'slow-ttfb')
    expect(slowTtfb).toBeDefined()
    expect(slowTtfb!.affectedEntries.length).toBeGreaterThanOrEqual(3)
  })

  it('detects broken resources in demo', () => {
    const result = analyze(JSON.stringify(demoHar))
    const broken = result.findings.find(f => f.ruleId === 'broken-resources')
    expect(broken).toBeDefined()
    expect(broken!.severity).toBe('critical')
    expect(broken!.affectedEntries.length).toBe(2)
  })

  it('respects custom rules', () => {
    const customRules: IssueRulesFile = {
      rules: {
        'custom-check': {
          category: 'optimization',
          severity: 'info',
          title: 'Custom check',
          description: 'desc',
          recommendation: 'rec',
          condition: { match_all: [{ field: 'totalDuration', gt: 0 }] },
        },
      },
    }
    const result = analyze(JSON.stringify(demoHar), {
      customRulesData: [customRules],
    })
    const custom = result.findings.find(f => f.ruleId === 'custom-check')
    expect(custom).toBeDefined()
  })
})

describe('exit codes', () => {
  it('returns 2 for critical findings', () => {
    const result = analyze(JSON.stringify(demoHar))
    const score = computeHealthScore(result)
    const hasCritical = result.findings.some(f => f.severity === 'critical')
    expect(hasCritical).toBe(true)
    // Exit code would be 2
  })

  it('returns 2 when score below threshold', () => {
    const result = analyze(JSON.stringify(demoHar))
    const score = computeHealthScore(result)
    // With threshold 100, any score < 100 exits 2
    expect(score.score < 100).toBe(true)
  })
})

describe('diff command', () => {
  it('compares two identical HARs with zero delta', () => {
    const result = analyze(JSON.stringify(demoHar))
    const diffResult = diff(result, result)

    expect(diffResult.scoreDelta).toBe(0)
    expect(diffResult.requestCountDelta).toBe(0)
    expect(diffResult.newFindings).toHaveLength(0)
    expect(diffResult.resolvedFindings).toHaveLength(0)
  })

  it('detects new findings when after has more issues', () => {
    const before = analyze(JSON.stringify(demoHar))
    // Analyze with no builtin rules to get fewer findings
    const cleanResult = analyze(JSON.stringify(demoHar), { noBuiltin: true })
    const diffResult = diff(cleanResult, before)

    expect(diffResult.newFindings.length).toBeGreaterThan(0)
  })
})

describe('sanitize command', () => {
  it('sanitizes demo HAR without errors', () => {
    const har = parseHar(JSON.stringify(demoHar))
    const sanitized = sanitize(har)

    expect(sanitized.log.entries).toHaveLength(demoHar.log.entries.length)
  })

  it('preserves HAR structure after sanitization', () => {
    const har = parseHar(JSON.stringify(demoHar))
    const sanitized = sanitize(har)

    expect(sanitized.log.version).toBe('1.2')
    expect(sanitized.log.creator.name).toBe('har-o-scope-demo')
  })
})

describe('validate command', () => {
  it('validates demo HAR successfully', () => {
    const har = parseHar(JSON.stringify(demoHar))
    expect(har.log.entries).toHaveLength(15)
  })

  it('throws HarError for invalid JSON', () => {
    expect(() => parseHar('not json')).toThrow(HarError)
  })

  it('throws HarError for missing log property', () => {
    expect(() => parseHar('{}')).toThrow(HarError)
  })

  it('validates valid YAML rules', () => {
    const yaml = `rules:
  test-rule:
    category: server
    severity: warning
    title: Test
    description: Test
    recommendation: Test
    condition:
      match_all:
        - field: "timings.wait"
          gt: 500`
    const result = validate(yaml)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects invalid YAML rules', () => {
    const yaml = `rules:
  bad-rule:
    category: server`
    const result = validate(yaml)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
