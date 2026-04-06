/**
 * Output formatters for CLI: text, json, markdown, ci annotations.
 */
import type { AnalysisResult, HealthScore, DiffResult, Finding } from '../lib/types.js'
import {
  bold, dim, red, green, yellow, cyan,
  severityColor, severityIcon, healthScoreColor, scoreBar,
} from './colors.js'

// ── Shared helpers ──────────────────────────────────────────────

function ms(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}s`
  return `${Math.round(n)}ms`
}

function rootCauseLabel(rootCause: { client: number; network: number; server: number }): string {
  const entries = Object.entries(rootCause) as Array<[string, number]>
  entries.sort((a, b) => b[1] - a[1])
  const top = entries[0]
  if (top[1] === 0) return 'none (no findings)'
  const pct = Math.round(top[1] * 100)
  return `${top[0]} (confidence: ${pct}%)`
}

function findingsByServerity(findings: Finding[]): { critical: Finding[]; warning: Finding[]; info: Finding[] } {
  const critical = findings.filter(f => f.severity === 'critical')
  const warning = findings.filter(f => f.severity === 'warning')
  const info = findings.filter(f => f.severity === 'info')
  return { critical, warning, info }
}

// ── Text formatter ──────────────────────────────────────────────

export function formatText(
  result: AnalysisResult,
  score: HealthScore,
  verbose: boolean,
): string {
  const lines: string[] = []

  // Health score
  const scoreStr = `${score.score}/100`
  const bar = scoreBar(score.score)
  const colorFn = healthScoreColor(score.score)
  lines.push('')
  lines.push(`  ${bold('Health Score:')} ${colorFn(scoreStr)}  ${colorFn(bar)}`)

  // Root cause + stats
  lines.push(`  ${bold('Root Cause:')}   ${rootCauseLabel(result.rootCause)}`)
  lines.push(`  ${dim(`Requests: ${result.metadata.totalRequests} | Time: ${ms(result.metadata.totalTimeMs)} | Analysis: ${ms(result.metadata.analysisTimeMs)}`)}`)
  lines.push('')

  // Findings
  const { findings } = result
  if (findings.length === 0) {
    lines.push(`  ${green('No issues found.')}`)
  } else {
    const { critical, warning, info } = findingsByServerity(findings)
    const counts: string[] = []
    if (critical.length) counts.push(red(`${critical.length} critical`))
    if (warning.length) counts.push(yellow(`${warning.length} warning`))
    if (info.length) counts.push(dim(`${info.length} info`))
    lines.push(`  ${bold('Findings')} (${counts.join(', ')})`)
    lines.push('')

    const sorted = [...critical, ...warning, ...info]
    for (const finding of sorted) {
      const icon = severityIcon(finding.severity)
      const color = severityColor(finding.severity)
      lines.push(`  ${color(icon)} ${color(`[${finding.severity}]`)} ${finding.title}`)
      lines.push(`    ${dim(finding.description)}`)
      lines.push(`    ${cyan('\u2192')} ${finding.recommendation}`)
      lines.push(`    ${dim(`Affected: ${finding.affectedEntries.length} entries`)}`)
      lines.push('')
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push(`  ${bold('Warnings')}`)
    lines.push('')
    for (const w of result.warnings) {
      lines.push(`  ${yellow('\u26A0')} ${dim(`[${w.code}]`)} ${w.message}`)
      lines.push(`    ${dim(`Help: ${w.help}`)}`)
    }
    lines.push('')
  }

  // Verbose: per-entry timing
  if (verbose) {
    lines.push(`  ${bold('Per-Entry Timing')}`)
    lines.push('')
    lines.push(`  ${'URL'.padEnd(60)} ${'Wait'.padStart(8)} ${'Total'.padStart(8)} ${'Status'.padStart(6)}`)
    lines.push(`  ${'\u2500'.repeat(60)} ${'\u2500'.repeat(8)} ${'\u2500'.repeat(8)} ${'\u2500'.repeat(6)}`)

    const sorted = [...result.entries]
      .filter(e => !e.isWebSocket)
      .sort((a, b) => b.timings.wait - a.timings.wait)

    for (const entry of sorted) {
      const url = entry.entry.request?.url ?? 'unknown'
      const truncUrl = url.length > 58 ? url.slice(0, 55) + '...' : url
      const status = entry.entry.response?.status ?? 0
      const statusStr = status >= 400 ? red(String(status)) : String(status)
      lines.push(`  ${truncUrl.padEnd(60)} ${ms(entry.timings.wait).padStart(8)} ${ms(entry.totalDuration).padStart(8)} ${statusStr.padStart(6)}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── JSON formatter ──────────────────────────────────────────────

export function formatJson(
  result: AnalysisResult,
  score: HealthScore,
): string {
  const output = {
    healthScore: score.score,
    scoreBreakdown: score.breakdown,
    rootCause: result.rootCause,
    findings: result.findings.map(f => ({
      ruleId: f.ruleId,
      severity: f.severity,
      category: f.category,
      title: f.title,
      description: f.description,
      recommendation: f.recommendation,
      affectedEntries: f.affectedEntries.length,
      impact: f.impact,
    })),
    metadata: result.metadata,
    warnings: result.warnings,
  }
  return JSON.stringify(output, null, 2)
}

// ── Markdown formatter ──────────────────────────────────────────

export function formatMarkdown(
  result: AnalysisResult,
  score: HealthScore,
): string {
  const lines: string[] = []

  lines.push(`# HAR Analysis Report`)
  lines.push('')
  lines.push(`**Health Score:** ${score.score}/100`)
  lines.push(`**Root Cause:** ${rootCauseLabel(result.rootCause)}`)
  lines.push(`**Requests:** ${result.metadata.totalRequests} | **Total Time:** ${ms(result.metadata.totalTimeMs)}`)
  lines.push('')

  if (result.findings.length === 0) {
    lines.push('No issues found.')
  } else {
    lines.push('## Findings')
    lines.push('')
    lines.push('| Severity | Rule | Title | Affected |')
    lines.push('|----------|------|-------|----------|')
    for (const f of result.findings) {
      const sev = f.severity === 'critical' ? '\u274C' : f.severity === 'warning' ? '\u26A0\uFE0F' : '\u2139\uFE0F'
      lines.push(`| ${sev} ${f.severity} | ${f.ruleId} | ${f.title} | ${f.affectedEntries.length} |`)
    }
    lines.push('')

    for (const f of result.findings) {
      lines.push(`### ${f.title}`)
      lines.push('')
      lines.push(f.description)
      lines.push('')
      lines.push(`**Recommendation:** ${f.recommendation}`)
      lines.push('')
    }
  }

  if (result.warnings.length > 0) {
    lines.push('## Warnings')
    lines.push('')
    for (const w of result.warnings) {
      lines.push(`- **${w.code}:** ${w.message}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── CI annotations ──────────────────────────────────────────────

export function formatCi(result: AnalysisResult, score: HealthScore, threshold: number): string {
  const lines: string[] = []

  for (const finding of result.findings) {
    // CI annotations: critical → error, warning → warning, info → skip
    if (finding.severity === 'info') continue
    const level = finding.severity === 'critical' ? 'error' : 'warning'
    const msg = `[${finding.ruleId}] ${finding.title}`.replace(/\n/g, '%0A')
    lines.push(`::${level}::${msg}`)
  }

  if (score.score < threshold) {
    lines.push(`::error::Health score ${score.score} is below threshold ${threshold}`)
  }

  return lines.join('\n')
}

// ── Diff formatters ─────────────────────────────────────────────

export function formatDiffText(diff: DiffResult): string {
  const lines: string[] = []

  lines.push('')
  const deltaColor = diff.scoreDelta >= 0 ? green : red
  const deltaSign = diff.scoreDelta >= 0 ? '+' : ''
  lines.push(`  ${bold('Score Delta:')} ${deltaColor(`${deltaSign}${diff.scoreDelta}`)}`)
  lines.push(`  ${bold('Request Delta:')} ${diff.requestCountDelta >= 0 ? '+' : ''}${diff.requestCountDelta}`)
  lines.push(`  ${bold('Time Delta:')} ${diff.totalTimeDelta >= 0 ? '+' : ''}${ms(diff.totalTimeDelta)}`)
  lines.push('')

  if (diff.newFindings.length > 0) {
    lines.push(`  ${red(bold('New Issues'))} (${diff.newFindings.length})`)
    for (const f of diff.newFindings) {
      lines.push(`    ${red('+')} [${f.severity}] ${f.title}`)
    }
    lines.push('')
  }

  if (diff.resolvedFindings.length > 0) {
    lines.push(`  ${green(bold('Resolved'))} (${diff.resolvedFindings.length})`)
    for (const f of diff.resolvedFindings) {
      lines.push(`    ${green('-')} [${f.severity}] ${f.title}`)
    }
    lines.push('')
  }

  if (diff.persistedFindings.length > 0) {
    lines.push(`  ${yellow(bold('Persisted'))} (${diff.persistedFindings.length})`)
    for (const f of diff.persistedFindings) {
      const delta = f.afterCount - f.beforeCount
      const deltaStr = delta === 0 ? '=' : delta > 0 ? `+${delta}` : `${delta}`
      lines.push(`    ${dim('\u2022')} ${f.ruleId}: ${f.beforeSeverity} \u2192 ${f.afterSeverity} (${deltaStr} entries)`)
    }
    lines.push('')
  }

  if (diff.timingDeltas.length > 0) {
    lines.push(`  ${bold('Top Timing Changes')}`)
    const top = diff.timingDeltas.slice(0, 10)
    for (const td of top) {
      const color = td.deltaMs > 0 ? red : green
      const sign = td.deltaMs > 0 ? '+' : ''
      lines.push(`    ${td.urlPattern.slice(0, 50).padEnd(50)} ${color(`${sign}${ms(td.deltaMs)}`)} (${sign}${td.deltaPercent}%)`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function formatDiffJson(diff: DiffResult): string {
  return JSON.stringify(diff, null, 2)
}

export function formatDiffMarkdown(diff: DiffResult): string {
  const lines: string[] = []

  lines.push('# HAR Diff Report')
  lines.push('')
  lines.push(`**Score Delta:** ${diff.scoreDelta >= 0 ? '+' : ''}${diff.scoreDelta}`)
  lines.push(`**Request Delta:** ${diff.requestCountDelta >= 0 ? '+' : ''}${diff.requestCountDelta}`)
  lines.push(`**Time Delta:** ${diff.totalTimeDelta >= 0 ? '+' : ''}${ms(diff.totalTimeDelta)}`)
  lines.push('')

  if (diff.newFindings.length > 0) {
    lines.push('## New Issues')
    for (const f of diff.newFindings) lines.push(`- \u274C **[${f.severity}]** ${f.title}`)
    lines.push('')
  }

  if (diff.resolvedFindings.length > 0) {
    lines.push('## Resolved')
    for (const f of diff.resolvedFindings) lines.push(`- \u2705 **[${f.severity}]** ${f.title}`)
    lines.push('')
  }

  if (diff.timingDeltas.length > 0) {
    lines.push('## Timing Changes')
    lines.push('| URL Pattern | Before | After | Delta |')
    lines.push('|-------------|--------|-------|-------|')
    for (const td of diff.timingDeltas.slice(0, 15)) {
      lines.push(`| ${td.urlPattern} | ${ms(td.beforeAvgMs)} | ${ms(td.afterAvgMs)} | ${td.deltaMs >= 0 ? '+' : ''}${ms(td.deltaMs)} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
