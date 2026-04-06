/**
 * SARIF 2.1.0 output formatter.
 *
 * Uses logicalLocation (URL patterns, not source files) since
 * HAR findings reference network requests, not code.
 */
import type { AnalysisResult, HealthScore, Finding } from '../lib/types.js'

// ── SARIF severity mapping ─────────────────────────────────────
// har-o-scope: info | warning | critical
// SARIF:       note | warning | error

function sarifLevel(severity: string): string {
  switch (severity) {
    case 'critical': return 'error'
    case 'warning': return 'warning'
    case 'info': return 'note'
    default: return 'none'
  }
}

// ── Extract URL patterns from affected entries ──────────────────

function extractLogicalLocations(
  finding: Finding,
  entries: AnalysisResult['entries'],
): Array<{ name: string; kind: string; fullyQualifiedName: string }> {
  const patterns = new Map<string, string>()

  for (const idx of finding.affectedEntries) {
    const entry = entries[idx]
    if (!entry) continue
    const url = entry.entry.request?.url ?? ''
    try {
      const parsed = new URL(url)
      // Normalize: strip query params, replace numeric/UUID segments
      const path = parsed.pathname
        .split('/')
        .map(seg => /^\d+$/.test(seg) ? '*' : seg)
        .join('/')
      const pattern = `${parsed.hostname}${path}`
      if (!patterns.has(pattern)) {
        patterns.set(pattern, path)
      }
    } catch {
      // Malformed URL, skip
    }
  }

  return [...patterns.entries()].map(([fqn, name]) => ({
    name,
    kind: 'url-pattern',
    fullyQualifiedName: fqn,
  }))
}

// ── Main SARIF formatter ────────────────────────────────────────

export function formatSarif(
  result: AnalysisResult,
  score: HealthScore,
  version: string,
): string {
  // Build rule definitions
  const ruleMap = new Map<string, { id: string; shortDescription: string }>()
  for (const finding of result.findings) {
    if (!ruleMap.has(finding.ruleId)) {
      ruleMap.set(finding.ruleId, {
        id: finding.ruleId,
        shortDescription: finding.title,
      })
    }
  }

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0' as const,
    runs: [
      {
        tool: {
          driver: {
            name: 'har-o-scope',
            version,
            informationUri: 'https://github.com/vegaPDX/har-o-scope',
            rules: [...ruleMap.values()].map(r => ({
              id: r.id,
              shortDescription: { text: r.shortDescription },
              helpUri: `https://github.com/vegaPDX/har-o-scope/blob/main/docs/rules/${r.id}.md`,
            })),
            properties: {
              healthScore: score.score,
              scoreBreakdown: score.breakdown,
            },
          },
        },
        results: result.findings.map(finding => ({
          ruleId: finding.ruleId,
          ruleIndex: [...ruleMap.keys()].indexOf(finding.ruleId),
          level: sarifLevel(finding.severity),
          message: {
            text: `${finding.title}\n\n${finding.description}\n\nRecommendation: ${finding.recommendation}`,
          },
          logicalLocations: extractLogicalLocations(finding, result.entries),
          properties: {
            severity: finding.severity,
            category: finding.category,
            affectedEntries: finding.affectedEntries.length,
            impact: finding.impact,
          },
        })),
        invocations: [
          {
            executionSuccessful: true,
            properties: {
              healthScore: score.score,
              totalRequests: result.metadata.totalRequests,
              analysisTimeMs: result.metadata.analysisTimeMs,
            },
          },
        ],
      },
    ],
  }

  return JSON.stringify(sarif, null, 2)
}
