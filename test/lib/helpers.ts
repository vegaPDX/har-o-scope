/**
 * Test helpers: factory functions for creating test HAR data.
 */
import type { Har, Entry } from 'har-format'
import type { NormalizedEntry, NormalizedTimings, Finding, AnalysisResult, RootCauseResult } from '../../src/lib/types.js'

export function makeEntry(overrides: Partial<Entry> & { url?: string; status?: number; mimeType?: string; wait?: number; blocked?: number; dns?: number; connect?: number; ssl?: number; method?: string } = {}): Entry {
  const { url, status, mimeType, wait, blocked, dns, connect, ssl, method, ...rest } = overrides
  return {
    startedDateTime: '2024-01-01T00:00:00.000Z',
    time: (wait ?? 100) + (blocked ?? 0) + (dns ?? 0) + (connect ?? 0) + (ssl ?? 0) + 10 + 50,
    request: {
      method: method ?? 'GET',
      url: url ?? 'https://example.com/api/data',
      httpVersion: 'HTTP/2',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: status ?? 200,
      statusText: 'OK',
      httpVersion: 'HTTP/2',
      headers: [],
      cookies: [],
      content: {
        size: 1000,
        mimeType: mimeType ?? 'application/json',
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: 1000,
    },
    cache: {},
    timings: {
      blocked: blocked ?? 0,
      dns: dns ?? 0,
      connect: connect ?? 0,
      ssl: ssl ?? 0,
      send: 10,
      wait: wait ?? 100,
      receive: 50,
    },
    ...rest,
  } as Entry
}

export function makeHar(entries: Entry[], overrides?: Partial<Har>): Har {
  return {
    log: {
      version: '1.2',
      creator: { name: 'test', version: '1.0' },
      entries,
      ...(overrides?.log ?? {}),
    },
  } as Har
}

export function makeNormalizedEntry(overrides: Partial<NormalizedEntry> = {}): NormalizedEntry {
  return {
    entry: makeEntry(),
    startTimeMs: 0,
    totalDuration: 160,
    transferSizeResolved: 1000,
    contentSize: 1000,
    timings: {
      blocked: 0, dns: 0, connect: 0, ssl: 0,
      send: 10, wait: 100, receive: 50, total: 160,
    },
    resourceType: 'xhr',
    isLongPoll: false,
    isWebSocket: false,
    httpVersion: 'HTTP/2',
    ...overrides,
  }
}

export function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'test-rule',
    category: 'server',
    severity: 'warning',
    title: 'Test finding',
    description: 'A test finding',
    recommendation: 'Fix it',
    affectedEntries: [0],
    impact: 0,
    ...overrides,
  }
}

export function makeAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    entries: [],
    findings: [],
    rootCause: { client: 0, network: 0, server: 0 },
    warnings: [],
    metadata: {
      rulesEvaluated: 0,
      customRulesLoaded: 0,
      analysisTimeMs: 0,
      totalRequests: 0,
      totalTimeMs: 0,
    },
    ...overrides,
  }
}
