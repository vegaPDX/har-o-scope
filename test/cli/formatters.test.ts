/**
 * Formatter unit tests.
 * Tests text, json, markdown, ci, diff, and SARIF output.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setColorEnabled } from '../../src/cli/colors.js'
import {
  formatText, formatJson, formatMarkdown, formatCi,
  formatDiffText, formatDiffJson, formatDiffMarkdown,
} from '../../src/cli/formatters.js'
import { formatSarif } from '../../src/cli/sarif.js'
import { makeAnalysisResult, makeFinding, makeNormalizedEntry } from '../lib/helpers.js'
import type { HealthScore, DiffResult } from '../../src/lib/types.js'

const baseScore: HealthScore = {
  score: 73,
  breakdown: {
    findingDeductions: [{ reason: 'warning: slow-ttfb', points: 5 }],
    timingPenalty: 10,
    volumePenalty: 0,
    confidenceMultiplier: 1.0,
    totalDeductions: 27,
  },
}

const baseResult = makeAnalysisResult({
  entries: [makeNormalizedEntry(), makeNormalizedEntry()],
  findings: [
    makeFinding({ severity: 'critical', ruleId: 'broken-resources', title: '2 broken resources' }),
    makeFinding({ severity: 'warning', ruleId: 'slow-ttfb', title: '3 slow requests' }),
    makeFinding({ severity: 'info', ruleId: 'http1-downgrade', title: '5 HTTP/1.1 requests' }),
  ],
  rootCause: { client: 0.1, network: 0.2, server: 0.7 },
  metadata: {
    rulesEvaluated: 17, customRulesLoaded: 0,
    analysisTimeMs: 12, totalRequests: 150, totalTimeMs: 4200,
  },
})

beforeEach(() => {
  setColorEnabled(false)
})

describe('text formatter', () => {
  it('includes health score', () => {
    const out = formatText(baseResult, baseScore, false)
    expect(out).toContain('73/100')
  })

  it('includes root cause', () => {
    const out = formatText(baseResult, baseScore, false)
    expect(out).toContain('server')
    expect(out).toContain('70%')
  })

  it('lists findings sorted by severity', () => {
    const out = formatText(baseResult, baseScore, false)
    const critIdx = out.indexOf('[critical]')
    const warnIdx = out.indexOf('[warning]')
    const infoIdx = out.indexOf('[info]')
    expect(critIdx).toBeLessThan(warnIdx)
    expect(warnIdx).toBeLessThan(infoIdx)
  })

  it('includes per-entry timing in verbose mode', () => {
    const out = formatText(baseResult, baseScore, true)
    expect(out).toContain('Per-Entry Timing')
    expect(out).toContain('Wait')
  })

  it('hides per-entry timing when not verbose', () => {
    const out = formatText(baseResult, baseScore, false)
    expect(out).not.toContain('Per-Entry Timing')
  })

  it('shows no issues message for clean result', () => {
    const clean = makeAnalysisResult()
    const cleanScore: HealthScore = { score: 100, breakdown: { findingDeductions: [], timingPenalty: 0, volumePenalty: 0, confidenceMultiplier: 1, totalDeductions: 0 } }
    const out = formatText(clean, cleanScore, false)
    expect(out).toContain('No issues found')
  })
})

describe('json formatter', () => {
  it('outputs valid JSON', () => {
    const out = formatJson(baseResult, baseScore)
    const parsed = JSON.parse(out)
    expect(parsed.healthScore).toBe(73)
  })

  it('includes findings with expected shape', () => {
    const out = formatJson(baseResult, baseScore)
    const parsed = JSON.parse(out)
    expect(parsed.findings).toHaveLength(3)
    expect(parsed.findings[0]).toHaveProperty('ruleId')
    expect(parsed.findings[0]).toHaveProperty('severity')
    expect(parsed.findings[0]).toHaveProperty('affectedEntries')
  })

  it('includes metadata', () => {
    const out = formatJson(baseResult, baseScore)
    const parsed = JSON.parse(out)
    expect(parsed.metadata.totalRequests).toBe(150)
  })
})

describe('markdown formatter', () => {
  it('starts with H1 header', () => {
    const out = formatMarkdown(baseResult, baseScore)
    expect(out).toMatch(/^# HAR Analysis Report/)
  })

  it('includes findings table', () => {
    const out = formatMarkdown(baseResult, baseScore)
    expect(out).toContain('| Severity | Rule |')
    expect(out).toContain('slow-ttfb')
  })

  it('includes health score', () => {
    const out = formatMarkdown(baseResult, baseScore)
    expect(out).toContain('73/100')
  })
})

describe('ci formatter', () => {
  it('outputs ::error:: for critical findings', () => {
    const out = formatCi(baseResult, baseScore, 50)
    expect(out).toContain('::error::[broken-resources]')
  })

  it('outputs ::warning:: for warning findings', () => {
    const out = formatCi(baseResult, baseScore, 50)
    expect(out).toContain('::warning::[slow-ttfb]')
  })

  it('skips info findings', () => {
    const out = formatCi(baseResult, baseScore, 50)
    expect(out).not.toContain('http1-downgrade')
  })

  it('adds threshold error when score below threshold', () => {
    const out = formatCi(baseResult, baseScore, 80)
    expect(out).toContain('::error::Health score 73 is below threshold 80')
  })

  it('does not add threshold error when score meets threshold', () => {
    const out = formatCi(baseResult, baseScore, 50)
    expect(out).not.toContain('below threshold')
  })
})

describe('SARIF formatter', () => {
  it('outputs valid JSON', () => {
    const out = formatSarif(baseResult, baseScore, '0.1.0')
    const sarif = JSON.parse(out)
    expect(sarif.version).toBe('2.1.0')
  })

  it('includes correct schema URL', () => {
    const out = formatSarif(baseResult, baseScore, '0.1.0')
    const sarif = JSON.parse(out)
    expect(sarif.$schema).toContain('sarif-schema-2.1.0')
  })

  it('maps critical to error level', () => {
    const out = formatSarif(baseResult, baseScore, '0.1.0')
    const sarif = JSON.parse(out)
    const criticalResult = sarif.runs[0].results.find((r: { ruleId: string }) => r.ruleId === 'broken-resources')
    expect(criticalResult.level).toBe('error')
  })

  it('maps warning to warning level', () => {
    const out = formatSarif(baseResult, baseScore, '0.1.0')
    const sarif = JSON.parse(out)
    const warningResult = sarif.runs[0].results.find((r: { ruleId: string }) => r.ruleId === 'slow-ttfb')
    expect(warningResult.level).toBe('warning')
  })

  it('maps info to note level', () => {
    const out = formatSarif(baseResult, baseScore, '0.1.0')
    const sarif = JSON.parse(out)
    const infoResult = sarif.runs[0].results.find((r: { ruleId: string }) => r.ruleId === 'http1-downgrade')
    expect(infoResult.level).toBe('note')
  })

  it('includes tool driver info', () => {
    const out = formatSarif(baseResult, baseScore, '0.1.0')
    const sarif = JSON.parse(out)
    expect(sarif.runs[0].tool.driver.name).toBe('har-o-scope')
    expect(sarif.runs[0].tool.driver.version).toBe('0.1.0')
  })

  it('includes rule definitions', () => {
    const out = formatSarif(baseResult, baseScore, '0.1.0')
    const sarif = JSON.parse(out)
    const rules = sarif.runs[0].tool.driver.rules
    expect(rules.length).toBe(3)
    expect(rules.map((r: { id: string }) => r.id)).toContain('slow-ttfb')
  })

  it('includes invocations with health score', () => {
    const out = formatSarif(baseResult, baseScore, '0.1.0')
    const sarif = JSON.parse(out)
    expect(sarif.runs[0].invocations[0].executionSuccessful).toBe(true)
    expect(sarif.runs[0].invocations[0].properties.healthScore).toBe(73)
  })
})

describe('diff formatters', () => {
  const diffResult: DiffResult = {
    scoreDelta: -15,
    newFindings: [makeFinding({ severity: 'critical', ruleId: 'new-issue', title: 'New issue' })],
    resolvedFindings: [makeFinding({ severity: 'warning', ruleId: 'old-issue', title: 'Old issue' })],
    persistedFindings: [{
      ruleId: 'slow-ttfb',
      beforeSeverity: 'warning',
      afterSeverity: 'critical',
      beforeCount: 3,
      afterCount: 8,
    }],
    timingDeltas: [{
      urlPattern: 'https://example.com/api/*',
      beforeCount: 5, afterCount: 5,
      beforeAvgMs: 200, afterAvgMs: 800,
      deltaMs: 600, deltaPercent: 300,
    }],
    requestCountDelta: 20,
    totalTimeDelta: 5000,
  }

  it('text format shows score delta', () => {
    const out = formatDiffText(diffResult)
    expect(out).toContain('-15')
  })

  it('text format shows new and resolved findings', () => {
    const out = formatDiffText(diffResult)
    expect(out).toContain('New Issues')
    expect(out).toContain('Resolved')
    expect(out).toContain('New issue')
    expect(out).toContain('Old issue')
  })

  it('json format outputs valid JSON', () => {
    const out = formatDiffJson(diffResult)
    const parsed = JSON.parse(out)
    expect(parsed.scoreDelta).toBe(-15)
  })

  it('markdown format includes headers', () => {
    const out = formatDiffMarkdown(diffResult)
    expect(out).toContain('# HAR Diff Report')
    expect(out).toContain('## New Issues')
    expect(out).toContain('## Resolved')
  })
})
