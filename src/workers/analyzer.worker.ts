/**
 * Web Worker: all HAR analysis runs off the main thread.
 * Imports YAML rules as raw strings, parses once, then handles analyze messages.
 */
import * as yaml from 'js-yaml'
import { analyze, setBuiltinRules } from '../lib/analyze'
import { computeHealthScore } from '../lib/health-score'
import { diff } from '../lib/diff'
import { sanitize } from '../lib/sanitizer'
import { parseHar } from '../lib/normalizer'
import type { AnalysisResult, HealthScore, DiffResult, SanitizeOptions } from '../lib/types'
import type { IssueRulesFile, SharedConditionsFile, FiltersFile } from '../lib/schema'

// Import YAML rules as raw strings (bundled at build time)
import rulesYaml from '../../rules/generic/issue-rules.yaml?raw'
import conditionsYaml from '../../rules/generic/shared/base-conditions.yaml?raw'
import filtersYaml from '../../rules/generic/shared/filters.yaml?raw'

// Parse and register built-in rules on worker init
const rules = yaml.load(rulesYaml) as IssueRulesFile
const conditions = yaml.load(conditionsYaml) as SharedConditionsFile
const filters = yaml.load(filtersYaml) as FiltersFile
setBuiltinRules(rules, conditions, filters)

// ── Message types ────────────────────────────────────────────────

export type WorkerRequest =
  | { type: 'analyze'; id: string; data: string; customRules?: unknown[] }
  | { type: 'diff'; id: string; before: string; after: string }
  | { type: 'sanitize'; id: string; data: string; options: SanitizeOptions }

export type WorkerResponse =
  | { type: 'progress'; id: string; phase: string; percent: number }
  | { type: 'analyze-result'; id: string; result: AnalysisResult; healthScore: HealthScore }
  | { type: 'diff-result'; id: string; result: DiffResult; beforeScore: HealthScore; afterScore: HealthScore }
  | { type: 'sanitize-result'; id: string; data: string }
  | { type: 'error'; id: string; message: string }

function sendProgress(id: string, phase: string, percent: number) {
  self.postMessage({ type: 'progress', id, phase, percent } satisfies WorkerResponse)
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  try {
    switch (msg.type) {
      case 'analyze': {
        sendProgress(msg.id, 'Parsing HAR...', 10)
        const result = analyze(msg.data, {
          customRulesData: msg.customRules,
        })
        sendProgress(msg.id, 'Computing score...', 90)
        const healthScore = computeHealthScore(result)
        sendProgress(msg.id, 'Done', 100)
        self.postMessage({
          type: 'analyze-result',
          id: msg.id,
          result,
          healthScore,
        } satisfies WorkerResponse)
        break
      }
      case 'diff': {
        sendProgress(msg.id, 'Parsing first HAR...', 10)
        const beforeResult = analyze(msg.before)
        sendProgress(msg.id, 'Parsing second HAR...', 40)
        const afterResult = analyze(msg.after)
        sendProgress(msg.id, 'Comparing...', 70)
        const diffResult = diff(beforeResult, afterResult)
        const beforeScore = computeHealthScore(beforeResult)
        const afterScore = computeHealthScore(afterResult)
        sendProgress(msg.id, 'Done', 100)
        self.postMessage({
          type: 'diff-result',
          id: msg.id,
          result: diffResult,
          beforeScore,
          afterScore,
        } satisfies WorkerResponse)
        break
      }
      case 'sanitize': {
        sendProgress(msg.id, 'Sanitizing...', 50)
        const harObj = parseHar(msg.data)
        const sanitized = sanitize(harObj, msg.options)
        sendProgress(msg.id, 'Done', 100)
        self.postMessage({
          type: 'sanitize-result',
          id: msg.id,
          data: JSON.stringify(sanitized, null, 2),
        } satisfies WorkerResponse)
        break
      }
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      id: msg.id,
      message: err instanceof Error ? err.message : 'Unknown worker error',
    } satisfies WorkerResponse)
  }
}
