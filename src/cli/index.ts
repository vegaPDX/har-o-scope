#!/usr/bin/env node
/**
 * har-o-scope CLI entry point.
 *
 * Subcommands: analyze, diff, sanitize, validate
 * Exit codes: 0 = clean, 1 = warnings, 2 = critical or below threshold
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'

import { analyze } from '../lib/analyze.js'
import { diff } from '../lib/diff.js'
import { sanitize } from '../lib/sanitizer.js'
import { validate } from '../lib/validator.js'
import { computeHealthScore } from '../lib/health-score.js'
import { parseHar } from '../lib/normalizer.js'
import { HarError } from '../lib/errors.js'
import type { AnalysisResult, HealthScore, IssueSeverity, SanitizeMode } from '../lib/types.js'

import { setColorEnabled } from './colors.js'
import { loadBuiltinRules, loadCustomRules } from './rules.js'
import { demoHar } from './demo.js'
import { formatText, formatJson, formatMarkdown, formatCi, formatDiffText, formatDiffJson, formatDiffMarkdown } from './formatters.js'
import { formatSarif } from './sarif.js'
import { generateHtmlReport } from '../lib/html-report.js'

const VERSION = '0.1.0'

// ── Exit code logic ─────────────────────────────────────────────

function computeExitCode(result: AnalysisResult, score: HealthScore, threshold: number): number {
  const hasCritical = result.findings.some(f => f.severity === 'critical')
  if (hasCritical || score.score < threshold) return 2
  const hasWarning = result.findings.some(f => f.severity === 'warning')
  if (hasWarning) return 1
  return 0
}

// ── Helpers ─────────────────────────────────────────────────────

async function readHarFile(path: string): Promise<string> {
  const resolved = resolve(path)
  try {
    return await readFile(resolved, 'utf-8')
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') {
      process.stderr.write(`Error: File not found: ${resolved}\n`)
      process.exit(2)
    }
    throw err
  }
}

function output(text: string): void {
  process.stdout.write(text + '\n')
}

// ── Commands ────────────────────────────────────────────────────

async function runAnalyze(file: string | undefined, opts: {
  format: string; sarif: boolean; ci: boolean
  baseline?: string; threshold: string; verbose: boolean
  rules?: string; demo: boolean; color: boolean
}): Promise<void> {
  if (!opts.color) setColorEnabled(false)
  await loadBuiltinRules()

  // Determine input
  let harData: string
  if (opts.demo) {
    harData = JSON.stringify(demoHar)
  } else if (file) {
    harData = await readHarFile(file)
  } else {
    process.stderr.write('Error: Provide a HAR file or use --demo\n')
    process.exit(2)
    return // unreachable, but satisfies TS definite assignment
  }

  // Load custom rules if specified
  const customRulesData = opts.rules ? await loadCustomRules(opts.rules) : undefined

  const result = analyze(harData, { customRulesData })
  const score = computeHealthScore(result)
  const threshold = parseInt(opts.threshold, 10) || 50

  // Baseline comparison mode
  if (opts.baseline) {
    const baselineData = await readHarFile(opts.baseline)
    const baselineResult = analyze(baselineData, { customRulesData })
    const diffResult = diff(baselineResult, result)

    if (opts.format === 'json') {
      output(formatDiffJson(diffResult))
    } else if (opts.format === 'markdown') {
      output(formatDiffMarkdown(diffResult))
    } else {
      output(formatDiffText(diffResult))
    }

    // Exit 2 if score dropped below threshold
    const exitCode = computeExitCode(result, score, threshold)
    process.exit(exitCode)
    return
  }

  // Output format selection
  if (opts.sarif) {
    output(formatSarif(result, score, VERSION))
  } else if (opts.ci) {
    const ciOutput = formatCi(result, score, threshold)
    if (ciOutput) output(ciOutput)
  } else {
    switch (opts.format) {
      case 'json':
        output(formatJson(result, score))
        break
      case 'markdown':
        output(formatMarkdown(result, score))
        break
      case 'html':
        output(generateHtmlReport(result, score))
        break
      default:
        output(formatText(result, score, opts.verbose))
    }
  }

  process.exit(computeExitCode(result, score, threshold))
}

async function runDiff(before: string, after: string, opts: {
  format: string; color: boolean
}): Promise<void> {
  if (!opts.color) setColorEnabled(false)
  await loadBuiltinRules()

  const [beforeData, afterData] = await Promise.all([
    readHarFile(before),
    readHarFile(after),
  ])

  const beforeResult = analyze(beforeData)
  const afterResult = analyze(afterData)
  const diffResult = diff(beforeResult, afterResult)

  switch (opts.format) {
    case 'json':
      output(formatDiffJson(diffResult))
      break
    case 'markdown':
      output(formatDiffMarkdown(diffResult))
      break
    default:
      output(formatDiffText(diffResult))
  }

  // Exit 1 if new findings, 2 if new critical findings
  const hasCriticalNew = diffResult.newFindings.some(f => f.severity === 'critical')
  if (hasCriticalNew) process.exit(2)
  if (diffResult.newFindings.length > 0) process.exit(1)
}

async function runSanitize(file: string, opts: {
  output?: string; mode: string
}): Promise<void> {
  const data = await readHarFile(file)
  const har = parseHar(data)
  const sanitized = sanitize(har, { mode: opts.mode as SanitizeMode })
  const json = JSON.stringify(sanitized, null, 2)

  if (opts.output) {
    await writeFile(resolve(opts.output), json, 'utf-8')
    process.stderr.write(`Sanitized HAR written to ${opts.output}\n`)
  } else {
    output(json)
  }
}

async function runValidate(file: string, opts: {
  rules?: string
}): Promise<void> {
  const data = await readHarFile(file)

  // Validate as HAR
  try {
    parseHar(data)
    process.stderr.write('HAR structure: valid\n')
  } catch (err) {
    if (err instanceof HarError) {
      process.stderr.write(`HAR structure: invalid\n`)
      process.stderr.write(`  ${err.code}: ${err.message}\n`)
      process.stderr.write(`  Help: ${err.help}\n`)
      process.exit(2)
    }
    throw err
  }

  // Validate custom rules if specified
  if (opts.rules) {
    const rulesContent = await readFile(resolve(opts.rules), 'utf-8')
    const result = validate(rulesContent)

    if (result.errors.length > 0) {
      process.stderr.write(`Rules validation: ${result.errors.length} error(s)\n`)
      for (const e of result.errors) {
        process.stderr.write(`  ${e.code}: ${e.message}\n`)
        if (e.suggestion) process.stderr.write(`    Suggestion: ${e.suggestion}\n`)
      }
    }
    if (result.warnings.length > 0) {
      process.stderr.write(`Rules validation: ${result.warnings.length} warning(s)\n`)
      for (const w of result.warnings) {
        process.stderr.write(`  ${w.code}: ${w.message}\n`)
      }
    }
    if (result.valid) {
      process.stderr.write('Rules validation: valid\n')
    } else {
      process.exit(2)
    }
  }
}

// ── Program ─────────────────────────────────────────────────────

const program = new Command()
  .name('har-o-scope')
  .description('Zero-trust intelligent HAR file analyzer')
  .version(VERSION)

program
  .command('analyze')
  .argument('[file]', 'HAR file to analyze')
  .description('Analyze a HAR file for performance and security issues')
  .option('-f, --format <format>', 'Output format: text, json, markdown, html', 'text')
  .option('--sarif', 'Output SARIF 2.1.0 JSON')
  .option('--ci', 'Output GitHub-compatible annotations')
  .option('--baseline <file>', 'Compare against a baseline HAR file')
  .option('--threshold <score>', 'Minimum health score (default: 50)', '50')
  .option('--verbose', 'Show per-entry timing details', false)
  .option('--rules <path>', 'Path to custom YAML rules file or directory')
  .option('--demo', 'Analyze a built-in demo HAR file', false)
  .option('--no-color', 'Disable colored output')
  .action(runAnalyze)

program
  .command('diff')
  .arguments('<before> <after>')
  .description('Compare two HAR files for regressions and improvements')
  .option('-f, --format <format>', 'Output format: text, json, markdown, html', 'text')
  .option('--no-color', 'Disable colored output')
  .action(runDiff)

program
  .command('sanitize')
  .argument('<file>', 'HAR file to sanitize')
  .description('Strip secrets and sensitive data from a HAR file')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-m, --mode <mode>', 'Sanitization mode: aggressive, selective', 'aggressive')
  .action(runSanitize)

program
  .command('validate')
  .argument('<file>', 'HAR file to validate')
  .description('Validate HAR file structure and optionally custom rules')
  .option('--rules <path>', 'Also validate a YAML rules file')
  .action(runValidate)

// Handle errors globally
program.exitOverride()

try {
  await program.parseAsync()
} catch (err) {
  if (err instanceof HarError) {
    process.stderr.write(`\nError [${err.code}]: ${err.message}\n`)
    process.stderr.write(`Help: ${err.help}\n`)
    process.stderr.write(`Docs: ${err.docsUrl}\n`)
    process.exit(2)
  }
  // Commander exits with code 0 for --help and --version
  if (err && typeof err === 'object' && 'exitCode' in err) {
    process.exit((err as { exitCode: number }).exitCode)
  }
  throw err
}
