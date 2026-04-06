import { describe, it, expect } from 'vitest'
import { parseHar, normalizeHar } from '../../src/lib/normalizer.js'
import { HarError } from '../../src/lib/errors.js'
import { makeEntry, makeHar } from './helpers.js'

describe('parseHar', () => {
  it('parses valid HAR JSON', () => {
    const har = parseHar(JSON.stringify({ log: { version: '1.2', entries: [] } }))
    expect(har.log).toBeDefined()
  })

  it('throws HAR001 for invalid JSON', () => {
    expect(() => parseHar('not json')).toThrow(HarError)
    try {
      parseHar('not json')
    } catch (e) {
      expect((e as HarError).code).toBe('HAR001')
    }
  })

  it('throws HAR002 for valid JSON without log property', () => {
    expect(() => parseHar(JSON.stringify({ foo: 'bar' }))).toThrow(HarError)
    try {
      parseHar(JSON.stringify({ foo: 'bar' }))
    } catch (e) {
      expect((e as HarError).code).toBe('HAR002')
    }
  })

  it('throws HAR002 for non-object JSON', () => {
    expect(() => parseHar('"hello"')).toThrow(HarError)
  })
})

describe('normalizeHar', () => {
  it('normalizes a basic HAR file', () => {
    const har = makeHar([makeEntry()])
    const { entries, warnings } = normalizeHar(har)

    expect(entries).toHaveLength(1)
    expect(warnings).toHaveLength(0)
    expect(entries[0].startTimeMs).toBe(0)
    expect(entries[0].timings.wait).toBe(100)
    expect(entries[0].isWebSocket).toBe(false)
    expect(entries[0].isLongPoll).toBe(false)
  })

  it('throws HAR002 for missing entries array', () => {
    expect(() => normalizeHar({ log: {} } as any)).toThrow(HarError)
  })

  it('throws HAR003 for empty entries', () => {
    expect(() => normalizeHar(makeHar([]))).toThrow(HarError)
    try {
      normalizeHar(makeHar([]))
    } catch (e) {
      expect((e as HarError).code).toBe('HAR003')
    }
  })

  it('computes relative startTimeMs', () => {
    const e1 = makeEntry()
    e1.startedDateTime = '2024-01-01T00:00:00.000Z'
    const e2 = makeEntry()
    e2.startedDateTime = '2024-01-01T00:00:01.000Z'

    const { entries } = normalizeHar(makeHar([e1, e2]))
    expect(entries[0].startTimeMs).toBe(0)
    expect(entries[1].startTimeMs).toBe(1000)
  })

  it('clamps negative timings to 0', () => {
    const entry = makeEntry()
    entry.timings!.blocked = -1
    entry.timings!.dns = -1
    entry.timings!.ssl = -1

    const { entries } = normalizeHar(makeHar([entry]))
    expect(entries[0].timings.blocked).toBe(0)
    expect(entries[0].timings.dns).toBe(0)
    expect(entries[0].timings.ssl).toBe(0)
  })

  it('handles missing timings', () => {
    const entry = makeEntry()
    delete (entry as any).timings

    const { entries } = normalizeHar(makeHar([entry]))
    expect(entries[0].timings.total).toBe(0)
  })

  it('detects WebSocket entries', () => {
    const entry = makeEntry({ url: 'wss://example.com/socket' })
    const { entries } = normalizeHar(makeHar([entry]))
    expect(entries[0].isWebSocket).toBe(true)
    expect(entries[0].resourceType).toBe('websocket')
  })

  it('detects long-poll entries (high wait, small body)', () => {
    const entry = makeEntry({ wait: 30000 })
    entry.response!.content!.size = 100
    const { entries } = normalizeHar(makeHar([entry]))
    expect(entries[0].isLongPoll).toBe(true)
  })

  it('detects SSE as long-poll', () => {
    const entry = makeEntry({ mimeType: 'text/event-stream' })
    const { entries } = normalizeHar(makeHar([entry]))
    expect(entries[0].isLongPoll).toBe(true)
  })

  it('resolves transfer size: Chrome _transferSize > bodySize > content.size', () => {
    const entry = makeEntry()
    ;(entry as any)._transferSize = 5000
    entry.response!.bodySize = 3000
    entry.response!.content!.size = 2000

    const { entries } = normalizeHar(makeHar([entry]))
    expect(entries[0].transferSizeResolved).toBe(5000)
  })

  it('falls back to bodySize when _transferSize missing', () => {
    const entry = makeEntry()
    entry.response!.bodySize = 3000
    entry.response!.content!.size = 2000

    const { entries } = normalizeHar(makeHar([entry]))
    expect(entries[0].transferSizeResolved).toBe(3000)
  })

  it('falls back to content.size when bodySize is -1', () => {
    const entry = makeEntry()
    entry.response!.bodySize = -1
    entry.response!.content!.size = 2000

    const { entries } = normalizeHar(makeHar([entry]))
    expect(entries[0].transferSizeResolved).toBe(2000)
  })

  it('detects resource types from MIME type', () => {
    expect(normalizeHar(makeHar([makeEntry({ mimeType: 'text/html' })])).entries[0].resourceType).toBe('document')
    expect(normalizeHar(makeHar([makeEntry({ mimeType: 'application/javascript' })])).entries[0].resourceType).toBe('script')
    expect(normalizeHar(makeHar([makeEntry({ mimeType: 'text/css' })])).entries[0].resourceType).toBe('stylesheet')
    expect(normalizeHar(makeHar([makeEntry({ mimeType: 'image/png' })])).entries[0].resourceType).toBe('image')
    expect(normalizeHar(makeHar([makeEntry({ mimeType: 'font/woff2' })])).entries[0].resourceType).toBe('font')
  })

  it('warns on invalid startedDateTime', () => {
    const entry = makeEntry()
    entry.startedDateTime = 'not-a-date'
    const { warnings } = normalizeHar(makeHar([entry]))
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0].code).toBe('HAR002')
  })
})
