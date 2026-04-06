import { describe, it, expect } from 'vitest'
import { sanitizeTrace, sanitizeUrl, sanitizeHeaderValue } from '../../src/lib/trace-sanitizer.js'

describe('sanitizeUrl', () => {
  it('strips query parameters', () => {
    expect(sanitizeUrl('https://example.com/api?token=abc&key=xyz')).toBe('https://example.com/api')
  })

  it('preserves path', () => {
    expect(sanitizeUrl('https://example.com/users/123/profile')).toBe('https://example.com/users/123/profile')
  })

  it('handles URLs with no query params', () => {
    expect(sanitizeUrl('https://example.com/api')).toBe('https://example.com/api')
  })

  it('handles malformed URLs', () => {
    const result = sanitizeUrl('not-a-url')
    expect(typeof result).toBe('string')
  })

  it('handles empty input', () => {
    expect(sanitizeUrl('')).toBe('')
  })

  it('strips fragment after query', () => {
    const result = sanitizeUrl('https://example.com/page?token=x#section')
    expect(result).not.toContain('token=x')
  })
})

describe('sanitizeHeaderValue', () => {
  it('redacts Authorization header', () => {
    expect(sanitizeHeaderValue('Authorization', 'Bearer abc123')).toBe('[REDACTED]')
  })

  it('redacts Cookie header (case-insensitive)', () => {
    expect(sanitizeHeaderValue('cookie', 'session=abc')).toBe('[REDACTED]')
  })

  it('preserves non-sensitive headers', () => {
    expect(sanitizeHeaderValue('Content-Type', 'application/json')).toBe('application/json')
    expect(sanitizeHeaderValue('Content-Length', '1234')).toBe('1234')
  })

  it('case-insensitive matching', () => {
    expect(sanitizeHeaderValue('AUTHORIZATION', 'Bearer token')).toBe('[REDACTED]')
    expect(sanitizeHeaderValue('Set-Cookie', 'sid=abc')).toBe('[REDACTED]')
  })
})

describe('sanitizeTrace', () => {
  it('redacts header values in trace text', () => {
    const trace = 'Authorization: Bearer eyJtoken123\nContent-Type: application/json'
    const result = sanitizeTrace(trace)
    expect(result).toContain('Authorization:')
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('eyJtoken123')
    expect(result).toContain('application/json')
  })

  it('strips query params from URLs in text', () => {
    const trace = 'Fetching https://example.com/api?token=secret&page=1 ...'
    const result = sanitizeTrace(trace)
    expect(result).not.toContain('token=secret')
    expect(result).toContain('https://example.com/api')
  })

  it('redacts Bearer tokens', () => {
    const trace = 'Using Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.signature for auth'
    const result = sanitizeTrace(trace)
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9')
  })

  it('redacts JWT-like strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const result = sanitizeTrace(`Token: ${jwt}`)
    expect(result).not.toContain(jwt)
    expect(result).toContain('[REDACTED]')
  })

  it('handles multiline input', () => {
    const trace = 'Line 1\nAuthorization: Bearer secret\nLine 3'
    const result = sanitizeTrace(trace)
    expect(result).toContain('Line 1')
    expect(result).toContain('Line 3')
    expect(result).not.toContain('secret')
  })

  it('handles empty/null input', () => {
    expect(sanitizeTrace('')).toBe('')
    expect(sanitizeTrace(null as any)).toBe('')
    expect(sanitizeTrace(undefined as any)).toBe('')
  })

  it('preserves non-sensitive text unchanged', () => {
    const trace = 'Processing 247 entries, found 5 issues'
    expect(sanitizeTrace(trace)).toBe(trace)
  })
})
