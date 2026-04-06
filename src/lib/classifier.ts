/**
 * Root cause classifier: weighted scoring across findings.
 * Produces client/network/server scores from rule-defined weights.
 */
import type { Finding, RootCauseResult, NormalizedEntry } from './types.js'
import type { IssueRulesFile } from './schema.js'
import { getRootCauseWeights } from './rule-engine.js'

const SEVERITY_MULTIPLIER: Record<string, number> = {
  critical: 3,
  warning: 2,
  info: 1,
}

export function classifyRootCause(
  findings: Finding[],
  entries: NormalizedEntry[],
  rulesFile?: IssueRulesFile,
  customWeights?: Map<string, Record<string, number>>,
): RootCauseResult {
  const scores = { client: 0, network: 0, server: 0 }

  // Merge weights from rules file + custom weights
  const weights = new Map<string, Record<string, number>>()
  if (rulesFile) {
    for (const [id, w] of getRootCauseWeights(rulesFile)) {
      weights.set(id, w)
    }
  }
  if (customWeights) {
    for (const [id, w] of customWeights) {
      weights.set(id, w)
    }
  }

  for (const finding of findings) {
    // Skip WebSocket-only findings from root cause scoring
    if (finding.affectedEntries.length > 0) {
      const allWebSocket = finding.affectedEntries.every(
        (idx) => entries[idx]?.isWebSocket,
      )
      if (allWebSocket) continue
    }

    const ruleWeights = weights.get(finding.ruleId)
    const severityMult = SEVERITY_MULTIPLIER[finding.severity] ?? 1
    const countFactor = Math.min(finding.affectedEntries.length, 20) / 20 + 0.5

    if (ruleWeights) {
      scores.client += (ruleWeights.client ?? 0) * severityMult * countFactor
      scores.network += (ruleWeights.network ?? 0) * severityMult * countFactor
      scores.server += (ruleWeights.server ?? 0) * severityMult * countFactor
    } else {
      // Default weights based on category
      const defaultWeights = getDefaultWeights(finding.category)
      scores.client += defaultWeights.client * severityMult * countFactor
      scores.network += defaultWeights.network * severityMult * countFactor
      scores.server += defaultWeights.server * severityMult * countFactor
    }
  }

  // Normalize to 0-1 range
  const total = scores.client + scores.network + scores.server
  if (total === 0) {
    return { client: 0, network: 0, server: 0 }
  }

  return {
    client: Math.round((scores.client / total) * 100) / 100,
    network: Math.round((scores.network / total) * 100) / 100,
    server: Math.round((scores.server / total) * 100) / 100,
  }
}

function getDefaultWeights(category: string): Record<string, number> {
  switch (category) {
    case 'server':
      return { client: 0, network: 0, server: 2 }
    case 'network':
      return { client: 0, network: 2, server: 0 }
    case 'client':
      return { client: 2, network: 0, server: 0 }
    case 'errors':
      return { client: 0, network: 1, server: 2 }
    case 'optimization':
      return { client: 1, network: 0, server: 1 }
    case 'security':
      return { client: 0, network: 1, server: 1 }
    case 'performance':
      return { client: 1, network: 1, server: 1 }
    default:
      return { client: 1, network: 1, server: 1 }
  }
}
