import { describe, it, expect } from 'vitest'
import { sanitize } from '../../src/lib/sanitizer.js'
import { makeEntry, makeHar } from './helpers.js'

describe('sanitize', () => {
  it('redacts Authorization header in aggressive mode', () => {
    const entry = makeEntry()
    entry.request.headers = [
      { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.sig123' },
      { name: 'Content-Type', value: 'application/json' },
    ]
    const har = makeHar([entry])
    const result = sanitize(har)

    const headers = result.log.entries[0].request.headers
    expect(headers.find((h) => h.name === 'Authorization')!.value).toBe('[REDACTED]')
    expect(headers.find((h) => h.name === 'Content-Type')!.value).toBe('application/json')
  })

  it('redacts Cookie and Set-Cookie headers', () => {
    const entry = makeEntry()
    entry.request.headers = [{ name: 'Cookie', value: 'session=abc123' }]
    entry.response!.headers = [{ name: 'Set-Cookie', value: 'sid=xyz; HttpOnly' }]

    const result = sanitize(makeHar([entry]))
    expect(result.log.entries[0].request.headers[0].value).toBe('[REDACTED]')
    expect(result.log.entries[0].response.headers[0].value).toBe('[REDACTED]')
  })

  it('sanitizes sensitive query parameters in URLs', () => {
    const entry = makeEntry({ url: 'https://example.com/api?token=secret123&page=1' })
    const result = sanitize(makeHar([entry]))

    const url = result.log.entries[0].request.url
    expect(url).toContain('page=1')
    expect(url).toContain('token=%5BREDACTED%5D')
    expect(url).not.toContain('secret123')
  })

  it('sanitizes queryString array', () => {
    const entry = makeEntry()
    entry.request.queryString = [
      { name: 'api_key', value: 'my-secret-key' },
      { name: 'page', value: '1' },
    ]
    const result = sanitize(makeHar([entry]))
    const qs = result.log.entries[0].request.queryString
    expect(qs.find((q) => q.name === 'api_key')!.value).toBe('[REDACTED]')
    expect(qs.find((q) => q.name === 'page')!.value).toBe('1')
  })

  it('redacts JWT signatures', () => {
    const entry = makeEntry()
    entry.request.headers = [
      { name: 'X-Token', value: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk' },
    ]
    const result = sanitize(makeHar([entry]))
    const value = result.log.entries[0].request.headers[0].value
    expect(value).toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(value).toContain('[SIGNATURE_REDACTED]')
    expect(value).not.toContain('dBjftJeZ4CVP')
  })

  it('does not mutate input', () => {
    const entry = makeEntry()
    entry.request.headers = [{ name: 'Authorization', value: 'Bearer token' }]
    const har = makeHar([entry])
    const originalValue = har.log.entries[0].request.headers[0].value

    sanitize(har)
    expect(har.log.entries[0].request.headers[0].value).toBe(originalValue)
  })

  it('selective mode only sanitizes specified categories', () => {
    const entry = makeEntry({ url: 'https://example.com/api?token=secret' })
    entry.request.headers = [{ name: 'Authorization', value: 'Bearer token' }]

    const result = sanitize(makeHar([entry]), {
      mode: 'selective',
      categories: ['query-params'],
    })

    // Auth header should be preserved in selective mode without auth-headers
    expect(result.log.entries[0].request.headers[0].value).toBe('Bearer token')
    // But query params should be sanitized
    expect(result.log.entries[0].request.url).not.toContain('secret')
  })

  it('sanitizes request cookies', () => {
    const entry = makeEntry()
    entry.request.cookies = [
      { name: 'session', value: 'abc123' },
    ] as any
    const result = sanitize(makeHar([entry]))
    expect((result.log.entries[0].request.cookies as any)[0].value).toBe('[REDACTED]')
  })
})
