import { describe, it, expect } from 'vitest'
import { computeHealthScore } from '../../src/lib/health-score.js'
import { makeAnalysisResult, makeFinding, makeNormalizedEntry } from './helpers.js'

describe('computeHealthScore', () => {
  it('returns 100 for zero findings', () => {
    const result = makeAnalysisResult()
    expect(computeHealthScore(result).score).toBe(100)
  })

  it('deducts 15 per critical finding', () => {
    const result = makeAnalysisResult({
      findings: [makeFinding({ severity: 'critical' })],
      rootCause: { client: 0, network: 0, server: 0.8 },
      entries: [makeNormalizedEntry()],
    })
    const score = computeHealthScore(result)
    // 100 - 15*1.0 = 85
    expect(score.score).toBe(85)
  })

  it('deducts 5 per warning finding', () => {
    const result = makeAnalysisResult({
      findings: [makeFinding({ severity: 'warning' })],
      rootCause: { client: 0, network: 0, server: 0.8 },
      entries: [makeNormalizedEntry()],
    })
    expect(computeHealthScore(result).score).toBe(95)
  })

  it('deducts 1 per info finding', () => {
    const result = makeAnalysisResult({
      findings: [makeFinding({ severity: 'info' })],
      rootCause: { client: 0, network: 0, server: 0.8 },
      entries: [makeNormalizedEntry()],
    })
    expect(computeHealthScore(result).score).toBe(99)
  })

  it('floors at 0', () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({ ruleId: `rule-${i}`, severity: 'critical' }),
    )
    const result = makeAnalysisResult({
      findings,
      rootCause: { client: 0, network: 0, server: 0.8 },
      entries: [makeNormalizedEntry()],
    })
    expect(computeHealthScore(result).score).toBe(0)
  })

  it('applies confidence multiplier for low confidence', () => {
    const result = makeAnalysisResult({
      findings: [makeFinding({ severity: 'critical' })],
      rootCause: { client: 0.3, network: 0.3, server: 0.3 },
      entries: [makeNormalizedEntry()],
    })
    // max weight 0.3 < 0.4 = 0.5 multiplier: 100 - 15*0.5 = 92.5 -> 93
    expect(computeHealthScore(result).score).toBe(93)
  })

  it('applies timing penalty for high median TTFB', () => {
    const entries = Array.from({ length: 5 }, () =>
      makeNormalizedEntry({
        timings: { blocked: 0, dns: 0, connect: 0, ssl: 0, send: 10, wait: 1500, receive: 50, total: 1560 },
      }),
    )
    const result = makeAnalysisResult({
      entries,
      rootCause: { client: 0, network: 0, server: 0 },
    })
    // 100 - 10 (timing penalty for median >1000ms)
    expect(computeHealthScore(result).score).toBe(90)
  })

  it('applies volume penalty for >200 requests', () => {
    const entries = Array.from({ length: 250 }, () => makeNormalizedEntry())
    const result = makeAnalysisResult({
      entries,
      rootCause: { client: 0, network: 0, server: 0 },
    })
    expect(computeHealthScore(result).score).toBe(95)
  })

  it('excludes WebSocket and long-poll from timing penalty', () => {
    const entries = [
      makeNormalizedEntry({
        isLongPoll: true,
        timings: { blocked: 0, dns: 0, connect: 0, ssl: 0, send: 10, wait: 30000, receive: 50, total: 30060 },
      }),
      makeNormalizedEntry({
        timings: { blocked: 0, dns: 0, connect: 0, ssl: 0, send: 10, wait: 100, receive: 50, total: 160 },
      }),
    ]
    const result = makeAnalysisResult({
      entries,
      rootCause: { client: 0, network: 0, server: 0 },
    })
    // Long-poll excluded, median of remaining is 100ms, no penalty
    expect(computeHealthScore(result).score).toBe(100)
  })

  it('breakdown contains deduction details', () => {
    const result = makeAnalysisResult({
      findings: [makeFinding({ severity: 'warning', ruleId: 'slow-ttfb' })],
      rootCause: { client: 0, network: 0, server: 0.8 },
      entries: [makeNormalizedEntry()],
    })
    const { breakdown } = computeHealthScore(result)
    expect(breakdown.findingDeductions).toHaveLength(1)
    expect(breakdown.findingDeductions[0].reason).toContain('slow-ttfb')
    expect(breakdown.confidenceMultiplier).toBe(1.0)
  })
})
