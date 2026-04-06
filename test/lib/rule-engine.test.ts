import { describe, it, expect } from 'vitest'
import { evaluateRules, resolveComposition, getRootCauseWeights } from '../../src/lib/rule-engine.js'
import { makeNormalizedEntry } from './helpers.js'
import type { IssueRulesFile, SharedConditionsFile, FiltersFile } from '../../src/lib/schema.js'

describe('resolveComposition', () => {
  const shared: SharedConditionsFile = {
    conditions: {
      is_not_websocket: { field: 'isWebSocket', equals: false },
      is_not_streaming: { field: 'isLongPoll', equals: false },
    },
  }

  it('returns rule condition when no inherits', () => {
    const result = resolveComposition(
      { inherits: undefined, condition: { match_all: [{ field: 'timings.wait', gt: 800 }] } } as any,
      shared,
    )
    expect(result?.match_all).toHaveLength(1)
  })

  it('prepends inherited conditions to match_all', () => {
    const result = resolveComposition(
      {
        inherits: ['is_not_websocket'],
        condition: { match_all: [{ field: 'timings.wait', gt: 800 }] },
      } as any,
      shared,
    )
    expect(result?.match_all).toHaveLength(2)
    expect((result?.match_all![0] as any).field).toBe('isWebSocket')
  })

  it('uses overrides for inherited conditions', () => {
    const result = resolveComposition(
      {
        inherits: ['is_not_websocket'],
        overrides: { is_not_websocket: { field: 'resourceType', not_equals: 'websocket' } },
        condition: { match_all: [] },
      } as any,
      shared,
    )
    expect((result?.match_all![0] as any).field).toBe('resourceType')
  })

  it('skips missing shared conditions', () => {
    const result = resolveComposition(
      { inherits: ['nonexistent'], condition: { match_all: [] } } as any,
      shared,
    )
    expect(result?.match_all).toHaveLength(0)
  })
})

describe('evaluateRules', () => {
  it('evaluates per-entry rules', () => {
    const rules: IssueRulesFile = {
      rules: {
        'slow-server': {
          category: 'server',
          severity: 'warning',
          title: '{count} slow request{s}',
          description: 'Slow',
          recommendation: 'Fix it',
          condition: { match_all: [{ field: 'timings.wait', gt: 800 }] },
        },
      },
    }

    const entries = [
      makeNormalizedEntry({ timings: { blocked: 0, dns: 0, connect: 0, ssl: 0, send: 10, wait: 1500, receive: 50, total: 1560 } }),
      makeNormalizedEntry({ timings: { blocked: 0, dns: 0, connect: 0, ssl: 0, send: 10, wait: 100, receive: 50, total: 160 } }),
    ]

    const findings = evaluateRules(rules, entries)
    expect(findings).toHaveLength(1)
    expect(findings[0].ruleId).toBe('slow-server')
    expect(findings[0].affectedEntries).toEqual([0])
    expect(findings[0].title).toBe('1 slow request')
  })

  it('respects min_count', () => {
    const rules: IssueRulesFile = {
      rules: {
        'need-many': {
          category: 'network',
          severity: 'warning',
          min_count: 3,
          title: 'test',
          description: 'test',
          recommendation: 'test',
          condition: { match_all: [{ field: 'timings.wait', gt: 0 }] },
        },
      },
    }

    const entries = [makeNormalizedEntry(), makeNormalizedEntry()]
    expect(evaluateRules(rules, entries)).toHaveLength(0)

    entries.push(makeNormalizedEntry())
    expect(evaluateRules(rules, entries)).toHaveLength(1)
  })

  it('evaluates aggregate rules', () => {
    const rules: IssueRulesFile = {
      rules: {
        'too-many': {
          type: 'aggregate',
          category: 'client',
          severity: 'warning',
          aggregate_condition: { min_entries: 3 },
          title: '{total} requests',
          description: 'Too many',
          recommendation: 'Reduce',
        },
      },
    }

    const entries = [makeNormalizedEntry(), makeNormalizedEntry()]
    expect(evaluateRules(rules, entries)).toHaveLength(0)

    entries.push(makeNormalizedEntry())
    const findings = evaluateRules(rules, entries)
    expect(findings).toHaveLength(1)
    expect(findings[0].title).toBe('3 requests')
  })

  it('evaluates prerequisite rules', () => {
    const rules: IssueRulesFile = {
      rules: {
        'needs-https': {
          category: 'security',
          severity: 'critical',
          prerequisite: { any_entry_matches: { field: 'entry.request.url', matches: '^https://' } },
          title: 'Mixed content',
          description: 'test',
          recommendation: 'test',
          condition: { match_all: [{ field: 'entry.request.url', matches: '^http://' }] },
        },
      },
    }

    const httpEntry = makeNormalizedEntry()
    httpEntry.entry.request.url = 'http://example.com/insecure'
    const httpsEntry = makeNormalizedEntry()
    httpsEntry.entry.request.url = 'https://example.com/secure'

    // Without HTTPS entry, prerequisite fails
    expect(evaluateRules(rules, [httpEntry])).toHaveLength(0)

    // With HTTPS entry, prerequisite passes and http entry matches
    const findings = evaluateRules(rules, [httpsEntry, httpEntry])
    expect(findings).toHaveLength(1)
  })

  it('applies severity escalation', () => {
    const rules: IssueRulesFile = {
      rules: {
        'escalating': {
          category: 'server',
          severity: 'info',
          severity_escalation: { warning_threshold: 3 },
          title: 'test',
          description: 'test',
          recommendation: 'test',
          condition: { match_all: [{ field: 'timings.wait', gt: 0 }] },
        },
      },
    }

    const entries = Array.from({ length: 5 }, () => makeNormalizedEntry())
    const findings = evaluateRules(rules, entries)
    expect(findings[0].severity).toBe('warning')
  })

  it('applies exclude filters', () => {
    const rules: IssueRulesFile = {
      rules: {
        'filtered': {
          category: 'server',
          severity: 'warning',
          exclude: ['analytics'],
          title: 'test',
          description: 'test',
          recommendation: 'test',
          condition: { match_all: [{ field: 'timings.wait', gt: 0 }] },
        },
      },
    }

    const filters: FiltersFile = {
      filters: {
        analytics: { field: 'entry.request.url', matches: 'analytics' },
      },
    }

    const normal = makeNormalizedEntry()
    const analytics = makeNormalizedEntry()
    analytics.entry.request.url = 'https://google-analytics.com/collect'

    const findings = evaluateRules(rules, [normal, analytics], undefined, filters)
    expect(findings).toHaveLength(1)
    expect(findings[0].affectedEntries).toEqual([0])
  })
})

describe('getRootCauseWeights', () => {
  it('extracts weights from rules', () => {
    const rules: IssueRulesFile = {
      rules: {
        'server-issue': {
          category: 'server',
          severity: 'warning',
          title: 'test',
          description: 'test',
          recommendation: 'test',
          root_cause_weight: { server: 3 },
        },
      },
    }

    const weights = getRootCauseWeights(rules)
    expect(weights.get('server-issue')).toEqual({ server: 3 })
  })
})
