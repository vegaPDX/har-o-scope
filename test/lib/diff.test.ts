import { describe, it, expect } from 'vitest'
import { diff, normalizeUrlForGrouping } from '../../src/lib/diff.js'
import { makeAnalysisResult, makeNormalizedEntry, makeFinding } from './helpers.js'

describe('normalizeUrlForGrouping', () => {
  it('strips query parameters', () => {
    expect(normalizeUrlForGrouping('https://example.com/api?token=abc')).toBe('https://example.com/api')
  })

  it('replaces purely numeric path segments with *', () => {
    expect(normalizeUrlForGrouping('https://example.com/users/123/posts')).toBe('https://example.com/users/*/posts')
  })

  it('replaces UUID path segments with *', () => {
    expect(normalizeUrlForGrouping('https://example.com/items/550e8400-e29b-41d4-a716-446655440000'))
      .toBe('https://example.com/items/*')
  })

  it('preserves mixed alphanumeric segments', () => {
    expect(normalizeUrlForGrouping('https://example.com/v2/page3/data')).toBe('https://example.com/v2/page3/data')
  })

  it('handles malformed URLs gracefully', () => {
    const result = normalizeUrlForGrouping('not-a-url')
    expect(typeof result).toBe('string')
  })
})

describe('diff', () => {
  it('returns zero delta for identical results', () => {
    const entry = makeNormalizedEntry()
    const result = makeAnalysisResult({ entries: [entry] })
    const d = diff(result, result)

    expect(d.scoreDelta).toBe(0)
    expect(d.requestCountDelta).toBe(0)
    expect(d.newFindings).toHaveLength(0)
    expect(d.resolvedFindings).toHaveLength(0)
  })

  it('detects new findings', () => {
    const before = makeAnalysisResult({ entries: [makeNormalizedEntry()] })
    const after = makeAnalysisResult({
      entries: [makeNormalizedEntry()],
      findings: [makeFinding({ ruleId: 'slow-ttfb' })],
    })
    const d = diff(before, after)
    expect(d.newFindings).toHaveLength(1)
    expect(d.newFindings[0].ruleId).toBe('slow-ttfb')
  })

  it('detects resolved findings', () => {
    const before = makeAnalysisResult({
      entries: [makeNormalizedEntry()],
      findings: [makeFinding({ ruleId: 'slow-ttfb' })],
    })
    const after = makeAnalysisResult({ entries: [makeNormalizedEntry()] })
    const d = diff(before, after)
    expect(d.resolvedFindings).toHaveLength(1)
  })

  it('detects persisted findings with severity changes', () => {
    const before = makeAnalysisResult({
      entries: [makeNormalizedEntry()],
      findings: [makeFinding({ ruleId: 'slow-ttfb', severity: 'warning', affectedEntries: [0] })],
    })
    const after = makeAnalysisResult({
      entries: [makeNormalizedEntry()],
      findings: [makeFinding({ ruleId: 'slow-ttfb', severity: 'critical', affectedEntries: [0, 1] })],
    })
    const d = diff(before, after)
    expect(d.persistedFindings).toHaveLength(1)
    expect(d.persistedFindings[0].beforeSeverity).toBe('warning')
    expect(d.persistedFindings[0].afterSeverity).toBe('critical')
  })

  it('computes timing deltas', () => {
    const slow = makeNormalizedEntry({ totalDuration: 2000 })
    slow.entry.request.url = 'https://example.com/api/data'
    const fast = makeNormalizedEntry({ totalDuration: 200 })
    fast.entry.request.url = 'https://example.com/api/data'

    const before = makeAnalysisResult({ entries: [slow] })
    const after = makeAnalysisResult({ entries: [fast] })

    const d = diff(before, after)
    expect(d.timingDeltas.length).toBeGreaterThan(0)
    const delta = d.timingDeltas.find((t) => t.urlPattern.includes('example.com'))
    expect(delta).toBeDefined()
    expect(delta!.deltaMs).toBeLessThan(0) // improved
  })

  it('computes request count delta', () => {
    const before = makeAnalysisResult({ entries: [makeNormalizedEntry()] })
    const after = makeAnalysisResult({
      entries: [makeNormalizedEntry(), makeNormalizedEntry(), makeNormalizedEntry()],
    })
    expect(diff(before, after).requestCountDelta).toBe(2)
  })

  it('handles empty results', () => {
    const empty = makeAnalysisResult()
    const d = diff(empty, empty)
    expect(d.scoreDelta).toBe(0)
    expect(d.requestCountDelta).toBe(0)
  })
})
