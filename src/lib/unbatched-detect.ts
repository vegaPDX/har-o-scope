/**
 * Unbatched API detection: TypeScript rule (not YAML-expressible).
 * Groups requests by normalized URL path, flags 5+ requests in a 2-second window.
 */
import type { NormalizedEntry, Finding } from './types.js'
import { normalizeUrlForGrouping } from './diff.js'

const MIN_COUNT = 5
const WINDOW_MS = 2000

export function detectUnbatchedApis(entries: NormalizedEntry[]): Finding | null {
  // Group by normalized URL pattern
  const groups = new Map<string, number[]>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.isWebSocket || entry.isLongPoll) continue

    const url = entry.entry.request?.url
    if (!url) continue

    const pattern = normalizeUrlForGrouping(url)
    const existing = groups.get(pattern)
    if (existing) {
      existing.push(i)
    } else {
      groups.set(pattern, [i])
    }
  }

  // For each group with 5+ entries, check time-window clustering
  const affectedIndices: number[] = []

  for (const [, indices] of groups) {
    if (indices.length < MIN_COUNT) continue

    // Sort by start time
    const sorted = [...indices].sort(
      (a, b) => entries[a].startTimeMs - entries[b].startTimeMs,
    )

    // Sliding window: find clusters of MIN_COUNT+ within WINDOW_MS
    let windowStart = 0
    for (let windowEnd = 0; windowEnd < sorted.length; windowEnd++) {
      while (
        entries[sorted[windowEnd]].startTimeMs - entries[sorted[windowStart]].startTimeMs > WINDOW_MS
      ) {
        windowStart++
      }

      if (windowEnd - windowStart + 1 >= MIN_COUNT) {
        // Add all entries in this cluster
        for (let j = windowStart; j <= windowEnd; j++) {
          if (!affectedIndices.includes(sorted[j])) {
            affectedIndices.push(sorted[j])
          }
        }
      }
    }
  }

  if (affectedIndices.length < MIN_COUNT) return null

  const count = affectedIndices.length
  return {
    ruleId: 'unbatched-api-calls',
    category: 'performance',
    severity: count >= 10 ? 'critical' : 'warning',
    title: `${count} unbatched API call${count !== 1 ? 's' : ''}`,
    description: `${count} requests to similar API endpoints were made within short time windows. Batching these requests would reduce round-trips and improve performance.`,
    recommendation: 'Batch multiple API calls into a single request where the API supports it. Use debouncing or request coalescing for repeated similar calls.',
    affectedEntries: affectedIndices,
    impact: 0,
  }
}
