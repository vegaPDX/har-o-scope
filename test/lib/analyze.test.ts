import { describe, it, expect, beforeEach } from 'vitest'
import { analyze, setBuiltinRules } from '../../src/lib/analyze.js'
import { HarError } from '../../src/lib/errors.js'
import { makeEntry, makeHar } from './helpers.js'
import type { IssueRulesFile, SharedConditionsFile } from '../../src/lib/schema.js'

const testRules: IssueRulesFile = {
  rules: {
    'slow-ttfb': {
      category: 'server',
      severity: 'warning',
      title: '{count} slow request{s}',
      description: 'TTFB > 800ms',
      recommendation: 'Fix server',
      condition: { match_all: [{ field: 'timings.wait', gt: 800 }] },
      root_cause_weight: { server: 3 },
    },
  },
}

const testConditions: SharedConditionsFile = {
  conditions: {
    is_not_websocket: { field: 'isWebSocket', equals: false },
  },
}

beforeEach(() => {
  setBuiltinRules(testRules, testConditions)
})

describe('analyze', () => {
  it('analyzes a HAR string', () => {
    const har = makeHar([
      makeEntry({ wait: 1500 }),
      makeEntry({ wait: 100 }),
    ])
    const result = analyze(JSON.stringify(har))

    expect(result.entries).toHaveLength(2)
    expect(result.findings.length).toBeGreaterThanOrEqual(1)
    expect(result.rootCause).toBeDefined()
    expect(result.metadata.totalRequests).toBe(2)
    expect(result.metadata.analysisTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('analyzes a HAR object', () => {
    const har = makeHar([makeEntry({ wait: 1500 })])
    const result = analyze(har)

    expect(result.entries).toHaveLength(1)
    expect(result.findings.some((f) => f.ruleId === 'slow-ttfb')).toBe(true)
  })

  it('throws HarError for invalid JSON', () => {
    expect(() => analyze('not json')).toThrow(HarError)
  })

  it('throws HarError for non-HAR JSON', () => {
    expect(() => analyze(JSON.stringify({ foo: 'bar' }))).toThrow(HarError)
  })

  it('respects minSeverity filter', () => {
    const har = makeHar([makeEntry({ wait: 1500 })])
    const result = analyze(har, { minSeverity: 'critical' })
    expect(result.findings.filter((f) => f.severity === 'warning')).toHaveLength(0)
  })

  it('supports noBuiltin option', () => {
    const har = makeHar([makeEntry({ wait: 1500 })])
    const result = analyze(har, { noBuiltin: true })
    // Without builtin rules, only unbatched-detect (TypeScript rule) runs
    expect(result.findings.filter((f) => f.ruleId === 'slow-ttfb')).toHaveLength(0)
  })

  it('evaluates custom rules', () => {
    const customRules: IssueRulesFile = {
      rules: {
        'custom-check': {
          category: 'optimization',
          severity: 'info',
          title: 'Custom',
          description: 'Custom check',
          recommendation: 'Custom fix',
          condition: { match_all: [{ field: 'timings.wait', gt: 0 }] },
        },
      },
    }

    const har = makeHar([makeEntry()])
    const result = analyze(har, { customRulesData: [customRules] })
    expect(result.findings.some((f) => f.ruleId === 'custom-check')).toBe(true)
  })

  it('adds warnings for bad custom rules', () => {
    const har = makeHar([makeEntry()])
    const result = analyze(har, { customRulesData: [{ bad: 'data' }] })
    // Should not crash, may add warnings
    expect(result).toBeDefined()
  })

  it('computes wall-clock time correctly', () => {
    const e1 = makeEntry({ wait: 100 })
    e1.startedDateTime = '2024-01-01T00:00:00.000Z'
    const e2 = makeEntry({ wait: 100 })
    e2.startedDateTime = '2024-01-01T00:00:02.000Z'

    const har = makeHar([e1, e2])
    const result = analyze(har)

    // Wall clock: max(start+duration) - min(start) should be > 2000ms
    expect(result.metadata.totalTimeMs).toBeGreaterThanOrEqual(2000)
  })

  it('includes metadata', () => {
    const har = makeHar([makeEntry()])
    const result = analyze(har)

    expect(result.metadata.rulesEvaluated).toBeGreaterThan(0)
    expect(result.metadata.customRulesLoaded).toBe(0)
    expect(result.metadata.totalRequests).toBe(1)
  })
})
