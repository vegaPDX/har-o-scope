import { describe, it, expect } from 'vitest'
import { generateHtmlReport } from '../../src/lib/html-report'
import type { HealthScore, Finding } from '../../src/lib/types'
import { makeAnalysisResult, makeFinding } from './helpers'

function makeScore(score: number): HealthScore {
  return {
    score,
    breakdown: {
      findingDeductions: [],
      timingPenalty: 0,
      volumePenalty: 0,
      confidenceMultiplier: 1,
      totalDeductions: 100 - score,
    },
  }
}

describe('generateHtmlReport', () => {
  it('returns valid HTML document', () => {
    const html = generateHtmlReport(makeAnalysisResult(), makeScore(100))

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('</html>')
    expect(html).toContain('<meta charset="UTF-8">')
  })

  it('includes health score in the SVG donut', () => {
    const html = generateHtmlReport(makeAnalysisResult(), makeScore(72))
    expect(html).toContain('>72</text>')
    expect(html).toContain('/100')
  })

  it('includes all findings sorted by severity', () => {
    const findings: Finding[] = [
      makeFinding({ ruleId: 'info-rule', severity: 'info', title: 'Info finding' }),
      makeFinding({ ruleId: 'crit-rule', severity: 'critical', title: 'Critical finding' }),
      makeFinding({ ruleId: 'warn-rule', severity: 'warning', title: 'Warning finding' }),
    ]
    const html = generateHtmlReport(makeAnalysisResult({ findings }), makeScore(50))

    expect(html).toContain('Critical finding')
    expect(html).toContain('Warning finding')
    expect(html).toContain('Info finding')

    // Sorted: critical before warning before info
    const critIdx = html.indexOf('Critical finding')
    const warnIdx = html.indexOf('Warning finding')
    const infoIdx = html.indexOf('Info finding')
    expect(critIdx).toBeLessThan(warnIdx)
    expect(warnIdx).toBeLessThan(infoIdx)
  })

  it('includes severity badges with counts', () => {
    const findings = [
      makeFinding({ severity: 'critical' }),
      makeFinding({ severity: 'critical' }),
      makeFinding({ severity: 'warning' }),
    ]
    const html = generateHtmlReport(makeAnalysisResult({ findings }), makeScore(50))

    expect(html).toContain('2 critical')
    expect(html).toContain('1 warning')
  })

  it('shows "No issues found" when no findings', () => {
    const html = generateHtmlReport(makeAnalysisResult(), makeScore(100))
    expect(html).toContain('No issues found')
  })

  it('includes root cause classification', () => {
    const result = makeAnalysisResult({
      rootCause: { client: 0.1, network: 0.2, server: 0.7 },
    })
    const html = generateHtmlReport(result, makeScore(50))
    expect(html).toContain('Server (70%)')
  })

  it('includes request count and total time', () => {
    const result = makeAnalysisResult({
      metadata: {
        rulesEvaluated: 17, customRulesLoaded: 0, analysisTimeMs: 5,
        totalRequests: 156, totalTimeMs: 42000,
      },
    })
    const html = generateHtmlReport(result, makeScore(80))
    expect(html).toContain('156')
    expect(html).toContain('42.0s')
  })

  it('uses custom title when provided', () => {
    const html = generateHtmlReport(makeAnalysisResult(), makeScore(80), { title: 'My Custom Report' })
    expect(html).toContain('My Custom Report')
    expect(html).toContain('<title>My Custom Report</title>')
  })

  it('escapes HTML in finding text', () => {
    const findings = [
      makeFinding({ title: '<script>alert("xss")</script>' }),
    ]
    const html = generateHtmlReport(makeAnalysisResult({ findings }), makeScore(50))
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('includes dark mode CSS via prefers-color-scheme', () => {
    const html = generateHtmlReport(makeAnalysisResult(), makeScore(100))
    expect(html).toContain('prefers-color-scheme: light')
  })

  it('includes recommendation text', () => {
    const findings = [
      makeFinding({ recommendation: 'Check server logs for errors.' }),
    ]
    const html = generateHtmlReport(makeAnalysisResult({ findings }), makeScore(70))
    expect(html).toContain('Check server logs for errors.')
  })

  it('uses green donut for high scores', () => {
    const html = generateHtmlReport(makeAnalysisResult(), makeScore(95))
    expect(html).toContain('var(--good)')
  })

  it('uses yellow donut for medium scores', () => {
    const html = generateHtmlReport(makeAnalysisResult(), makeScore(72))
    expect(html).toContain('var(--ok)')
  })

  it('uses red donut for low scores', () => {
    const html = generateHtmlReport(makeAnalysisResult(), makeScore(30))
    expect(html).toContain('var(--bad)')
  })
})
