import { describe, it, expect } from 'vitest'
import { detectUnbatchedApis } from '../../src/lib/unbatched-detect.js'
import { makeNormalizedEntry } from './helpers.js'
import { makeEntry } from './helpers.js'

describe('detectUnbatchedApis', () => {
  it('returns null for fewer than 5 similar requests', () => {
    const entries = Array.from({ length: 4 }, (_, i) => {
      const e = makeNormalizedEntry({ startTimeMs: i * 100 })
      e.entry.request.url = 'https://api.example.com/users/1'
      return e
    })
    expect(detectUnbatchedApis(entries)).toBeNull()
  })

  it('detects 5+ similar requests within 2-second window', () => {
    const entries = Array.from({ length: 6 }, (_, i) => {
      const e = makeNormalizedEntry({ startTimeMs: i * 200 })
      e.entry = makeEntry({ url: `https://api.example.com/data/${i}` })
      return e
    })

    const result = detectUnbatchedApis(entries)
    expect(result).not.toBeNull()
    expect(result!.ruleId).toBe('unbatched-api-calls')
    expect(result!.affectedEntries.length).toBeGreaterThanOrEqual(5)
  })

  it('does not flag requests spread across time', () => {
    const entries = Array.from({ length: 6 }, (_, i) => {
      const e = makeNormalizedEntry({ startTimeMs: i * 5000 })
      e.entry = makeEntry({ url: `https://api.example.com/data/${i}` })
      return e
    })

    expect(detectUnbatchedApis(entries)).toBeNull()
  })

  it('normalizes URLs (numeric segments become *)', () => {
    const entries = Array.from({ length: 6 }, (_, i) => {
      const e = makeNormalizedEntry({ startTimeMs: i * 100 })
      e.entry = makeEntry({ url: `https://api.example.com/users/${i * 100}/profile` })
      return e
    })

    const result = detectUnbatchedApis(entries)
    expect(result).not.toBeNull()
  })

  it('skips WebSocket entries', () => {
    const entries = Array.from({ length: 6 }, (_, i) => {
      const e = makeNormalizedEntry({ startTimeMs: i * 100, isWebSocket: true })
      e.entry = makeEntry({ url: 'https://api.example.com/data' })
      return e
    })
    expect(detectUnbatchedApis(entries)).toBeNull()
  })

  it('escalates to critical at 10+ affected', () => {
    const entries = Array.from({ length: 12 }, (_, i) => {
      const e = makeNormalizedEntry({ startTimeMs: i * 100 })
      e.entry = makeEntry({ url: `https://api.example.com/items/${i}` })
      return e
    })

    const result = detectUnbatchedApis(entries)
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('critical')
  })
})
