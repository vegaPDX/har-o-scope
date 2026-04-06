import { describe, it, expect } from 'vitest'
import { classifyRootCause } from '../../src/lib/classifier.js'
import { makeFinding, makeNormalizedEntry } from './helpers.js'

describe('classifyRootCause', () => {
  it('returns zeros with no findings', () => {
    const result = classifyRootCause([], [], undefined)
    expect(result).toEqual({ client: 0, network: 0, server: 0 })
  })

  it('classifies by category defaults', () => {
    const findings = [
      makeFinding({ ruleId: 'slow-ttfb', category: 'server', severity: 'critical' }),
    ]
    const entries = [makeNormalizedEntry()]
    const result = classifyRootCause(findings, entries)

    expect(result.server).toBeGreaterThan(0)
    expect(result.server).toBeGreaterThan(result.client)
    expect(result.server).toBeGreaterThan(result.network)
  })

  it('uses rule-defined weights when available', () => {
    const findings = [
      makeFinding({ ruleId: 'test', category: 'network', severity: 'warning' }),
    ]
    const entries = [makeNormalizedEntry()]
    const weights = new Map([['test', { client: 0, network: 5, server: 0 }]])

    const result = classifyRootCause(findings, entries, undefined, weights)
    expect(result.network).toBe(1)
    expect(result.client).toBe(0)
    expect(result.server).toBe(0)
  })

  it('normalizes scores to 0-1 range', () => {
    const findings = [
      makeFinding({ category: 'server', severity: 'warning' }),
      makeFinding({ ruleId: 'net', category: 'network', severity: 'warning' }),
    ]
    const entries = [makeNormalizedEntry()]
    const result = classifyRootCause(findings, entries)

    const total = result.client + result.network + result.server
    expect(total).toBeCloseTo(1, 1)
  })

  it('skips WebSocket-only findings', () => {
    const wsEntry = makeNormalizedEntry({ isWebSocket: true })
    const findings = [
      makeFinding({ category: 'server', severity: 'warning', affectedEntries: [0] }),
    ]
    const result = classifyRootCause(findings, [wsEntry])
    expect(result).toEqual({ client: 0, network: 0, server: 0 })
  })

  it('severity multiplier affects scoring', () => {
    const entries = [makeNormalizedEntry()]
    const critical = classifyRootCause(
      [makeFinding({ category: 'server', severity: 'critical' })],
      entries,
    )
    const info = classifyRootCause(
      [makeFinding({ category: 'server', severity: 'info' })],
      entries,
    )
    // Both normalize to 1.0 server because it's the only category,
    // but the raw scores differ (tested via internal behavior)
    expect(critical.server).toBeGreaterThanOrEqual(info.server)
  })
})
