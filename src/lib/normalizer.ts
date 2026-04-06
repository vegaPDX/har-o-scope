/**
 * HAR normalizer: parses HAR JSON and produces NormalizedEntry[].
 *
 * Pre-computes fields needed by the rule engine: startTimeMs, totalDuration,
 * transferSizeResolved, isLongPoll, isWebSocket, resourceType.
 * Handles edge cases: missing fields, sanitized Chrome exports (transferSize=0),
 * WebSocket entries, long-polls.
 */
import type { Har, Entry } from 'har-format'
import type { NormalizedEntry, NormalizedTimings, ResourceType } from './types.js'
import { HarError, HAR_ERRORS, createWarning } from './errors.js'
import type { AnalysisWarning } from './types.js'

// ── Resource type detection ─────────────────────────────────────

const MIME_TO_RESOURCE: Array<[RegExp, ResourceType]> = [
  [/^text\/html/i, 'document'],
  [/javascript/i, 'script'],
  [/^text\/css/i, 'stylesheet'],
  [/^image\//i, 'image'],
  [/^font\/|\/woff|\/woff2|\/ttf|\/otf/i, 'font'],
  [/^audio\/|^video\//i, 'media'],
  [/^text\/event-stream/i, 'fetch'],
]

function detectResourceType(entry: Entry): ResourceType {
  const url = entry.request?.url ?? ''
  const mimeType = entry.response?.content?.mimeType ?? ''

  // WebSocket detection
  if (url.startsWith('wss://') || url.startsWith('ws://')) return 'websocket'
  if (entry.response?.status === 101) return 'websocket'

  // XHR/Fetch via _resourceType hint (Chrome DevTools export)
  const resourceHint = (entry as unknown as Record<string, unknown>)._resourceType as string | undefined
  if (resourceHint) {
    const lower = resourceHint.toLowerCase()
    if (lower === 'xhr') return 'xhr'
    if (lower === 'fetch') return 'fetch'
    if (lower === 'websocket') return 'websocket'
    if (lower === 'document') return 'document'
    if (lower === 'script') return 'script'
    if (lower === 'stylesheet') return 'stylesheet'
    if (lower === 'image') return 'image'
    if (lower === 'font') return 'font'
    if (lower === 'media') return 'media'
  }

  // MIME-based detection
  for (const [pattern, type] of MIME_TO_RESOURCE) {
    if (pattern.test(mimeType)) return type
  }

  // URL extension fallback
  const pathname = safeUrlPathname(url)
  if (/\.(js|mjs|cjs)$/i.test(pathname)) return 'script'
  if (/\.css$/i.test(pathname)) return 'stylesheet'
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|avif)$/i.test(pathname)) return 'image'
  if (/\.(woff2?|ttf|otf|eot)$/i.test(pathname)) return 'font'
  if (/\.(mp[34]|webm|ogg|wav|flac)$/i.test(pathname)) return 'media'

  // Default for API-like calls
  if (mimeType.includes('json') || mimeType.includes('xml')) return 'xhr'

  return 'other'
}

function safeUrlPathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    // Handle malformed URLs by extracting path manually
    const pathStart = url.indexOf('/', url.indexOf('//') + 2)
    const queryStart = url.indexOf('?')
    if (pathStart === -1) return ''
    return queryStart === -1 ? url.slice(pathStart) : url.slice(pathStart, queryStart)
  }
}

// ── Timing normalization ────────────────────────────────────────

function clampTiming(value: number | undefined): number {
  if (value === undefined || value < 0) return 0
  return value
}

function normalizeTimings(entry: Entry): NormalizedTimings {
  const t = entry.timings
  if (!t) {
    return { blocked: 0, dns: 0, connect: 0, ssl: 0, send: 0, wait: 0, receive: 0, total: 0 }
  }

  const blocked = clampTiming(t.blocked)
  const dns = clampTiming(t.dns)
  const connect = clampTiming(t.connect)
  const ssl = clampTiming(t.ssl)
  const send = clampTiming(t.send)
  const wait = clampTiming(t.wait)
  const receive = clampTiming(t.receive)
  const total = blocked + dns + connect + ssl + send + wait + receive

  return { blocked, dns, connect, ssl, send, wait, receive, total }
}

// ── Long-poll detection ─────────────────────────────────────────

function detectLongPoll(entry: Entry, timings: NormalizedTimings): boolean {
  // SSE (Server-Sent Events)
  const mimeType = entry.response?.content?.mimeType ?? ''
  if (mimeType === 'text/event-stream') return true

  // High wait time with small response body
  if (timings.wait > 25000) {
    const bodySize = entry.response?.content?.size ?? 0
    if (bodySize < 1024) return true
  }

  return false
}

// ── Transfer size resolution ────────────────────────────────────

function resolveTransferSize(entry: Entry): number {
  // Chrome DevTools _transferSize extension field
  const chromeTransfer = (entry as unknown as Record<string, unknown>)._transferSize
  if (typeof chromeTransfer === 'number' && chromeTransfer > 0) return chromeTransfer

  // Standard HAR response.bodySize
  const bodySize = entry.response?.bodySize
  if (typeof bodySize === 'number' && bodySize > 0) return bodySize

  // Fallback to content.size
  const contentSize = entry.response?.content?.size
  if (typeof contentSize === 'number' && contentSize > 0) return contentSize

  return 0
}

// ── Main normalizer ─────────────────────────────────────────────

export interface NormalizeResult {
  entries: NormalizedEntry[]
  warnings: AnalysisWarning[]
}

export function normalizeHar(har: Har): NormalizeResult {
  const warnings: AnalysisWarning[] = []

  if (!har?.log?.entries || !Array.isArray(har.log.entries)) {
    throw new HarError({
      code: HAR_ERRORS.HAR002,
      message: 'Invalid HAR: missing log.entries array',
      help: 'Ensure the HAR file has a valid { log: { entries: [...] } } structure.',
    })
  }

  if (har.log.entries.length === 0) {
    throw new HarError({
      code: HAR_ERRORS.HAR003,
      message: 'HAR file contains no entries',
      help: 'The HAR file has an empty entries array. Capture some network traffic and re-export.',
    })
  }

  // Parse all start times, find the earliest
  const startTimes: number[] = []
  for (const entry of har.log.entries) {
    const ms = new Date(entry.startedDateTime).getTime()
    if (isNaN(ms)) {
      warnings.push(
        createWarning(
          HAR_ERRORS.HAR002,
          `Invalid startedDateTime: ${entry.startedDateTime}`,
          'This entry has an unparseable timestamp and will use time 0.',
        ),
      )
      startTimes.push(0)
    } else {
      startTimes.push(ms)
    }
  }

  const baseTime = Math.min(...startTimes.filter((t) => t > 0)) || 0

  const entries: NormalizedEntry[] = har.log.entries.map((entry, i) => {
    const timings = normalizeTimings(entry)
    const resourceType = detectResourceType(entry)
    const isWebSocket = resourceType === 'websocket'
    const isLongPoll = !isWebSocket && detectLongPoll(entry, timings)

    return {
      entry,
      startTimeMs: startTimes[i] > 0 ? startTimes[i] - baseTime : 0,
      totalDuration: timings.total,
      transferSizeResolved: resolveTransferSize(entry),
      contentSize: Math.max(0, entry.response?.content?.size ?? 0),
      timings,
      resourceType,
      isLongPoll,
      isWebSocket,
      httpVersion: entry.request?.httpVersion ?? 'unknown',
    }
  })

  return { entries, warnings }
}

// ── HAR parsing (JSON string -> Har object) ─────────────────────

export function parseHar(input: string): Har {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (e) {
    throw new HarError({
      code: HAR_ERRORS.HAR001,
      message: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`,
      help: 'The input is not valid JSON. Ensure the file is a properly formatted HAR export.',
    })
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('log' in parsed)
  ) {
    throw new HarError({
      code: HAR_ERRORS.HAR002,
      message: 'Not a HAR file: missing top-level "log" property',
      help: 'A valid HAR file must have a { "log": { ... } } structure. Check that you exported from the Network tab correctly.',
    })
  }

  return parsed as Har
}
