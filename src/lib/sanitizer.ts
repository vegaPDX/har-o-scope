/**
 * HAR sanitizer: aggressive + selective modes.
 *
 * Operates on raw HAR objects. Produces a deep-cloned sanitized copy.
 * Never mutates the input. Library returns raw data, sanitize() is explicit.
 */
import type { Har, Entry, Header } from 'har-format'
import type { SanitizeOptions, SanitizeCategory } from './types.js'

// ── Sensitive patterns ──────────────────────────────────────────

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'x-xsrf-token',
  'proxy-authorization',
])

const SENSITIVE_QUERY_NAMES = new Set([
  'token',
  'key',
  'secret',
  'password',
  'pwd',
  'jwt',
  'session',
  'auth',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'client_secret',
])

// JWT pattern: three base64url segments separated by dots
const JWT_PATTERN = /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

// High-entropy string heuristic: 20+ chars of base64-like content
const HIGH_ENTROPY_PATTERN = /^[A-Za-z0-9+/=_-]{20,}$/

const REDACTED = '[REDACTED]'

// ── Sanitization functions ──────────────────────────────────────

function sanitizeHeaders(
  headers: Header[],
  categories: Set<SanitizeCategory>,
): Header[] {
  return headers.map((h) => {
    const name = h.name.toLowerCase()

    if (categories.has('auth-headers') && SENSITIVE_HEADERS.has(name)) {
      return { name: h.name, value: REDACTED }
    }

    if (categories.has('cookies') && (name === 'cookie' || name === 'set-cookie')) {
      return { name: h.name, value: REDACTED }
    }

    if (categories.has('response-cookies') && name === 'set-cookie') {
      return { name: h.name, value: REDACTED }
    }

    if (categories.has('jwt-signatures') && JWT_PATTERN.test(h.value)) {
      // Preserve header and payload, redact signature
      const parts = h.value.split('.')
      return { name: h.name, value: `${parts[0]}.${parts[1]}.[SIGNATURE_REDACTED]` }
    }

    if (categories.has('high-entropy') && HIGH_ENTROPY_PATTERN.test(h.value) && h.value.length > 40) {
      return { name: h.name, value: REDACTED }
    }

    return { ...h }
  })
}

function sanitizeUrl(url: string, categories: Set<SanitizeCategory>): string {
  if (!categories.has('query-params')) return url

  try {
    const parsed = new URL(url)
    const params = new URLSearchParams(parsed.search)
    let changed = false

    for (const [key] of params) {
      if (SENSITIVE_QUERY_NAMES.has(key.toLowerCase())) {
        params.set(key, REDACTED)
        changed = true
      }
    }

    if (changed) {
      parsed.search = params.toString()
      return parsed.toString()
    }
    return url
  } catch {
    return url
  }
}

function sanitizeCookies(
  cookies: Array<{ name: string; value: string; [key: string]: unknown }> | undefined,
): Array<{ name: string; value: string; [key: string]: unknown }> | undefined {
  if (!cookies) return undefined
  return cookies.map((c) => ({ ...c, value: REDACTED }))
}

function sanitizeEntry(entry: Entry, categories: Set<SanitizeCategory>): Entry {
  const sanitized = JSON.parse(JSON.stringify(entry)) as Entry

  // URL sanitization
  if (sanitized.request) {
    sanitized.request.url = sanitizeUrl(sanitized.request.url, categories)

    if (sanitized.request.headers) {
      sanitized.request.headers = sanitizeHeaders(sanitized.request.headers, categories)
    }

    if (categories.has('query-params') && sanitized.request.queryString) {
      sanitized.request.queryString = sanitized.request.queryString.map((q) => {
        if (SENSITIVE_QUERY_NAMES.has(q.name.toLowerCase())) {
          return { ...q, value: REDACTED }
        }
        return q
      })
    }

    if (categories.has('cookies') && sanitized.request.cookies) {
      sanitized.request.cookies = sanitizeCookies(
        sanitized.request.cookies as Array<{ name: string; value: string }>,
      ) as typeof sanitized.request.cookies
    }
  }

  if (sanitized.response) {
    if (sanitized.response.headers) {
      sanitized.response.headers = sanitizeHeaders(sanitized.response.headers, categories)
    }

    if (categories.has('response-cookies') && sanitized.response.cookies) {
      sanitized.response.cookies = sanitizeCookies(
        sanitized.response.cookies as Array<{ name: string; value: string }>,
      ) as typeof sanitized.response.cookies
    }
  }

  return sanitized
}

// ── Main sanitize ───────────────────────────────────────────────

const ALL_CATEGORIES: SanitizeCategory[] = [
  'cookies',
  'auth-headers',
  'query-params',
  'response-cookies',
  'jwt-signatures',
  'high-entropy',
]

export function sanitize(har: Har, options?: SanitizeOptions): Har {
  const mode = options?.mode ?? 'aggressive'
  const categories = new Set<SanitizeCategory>(
    mode === 'aggressive' ? ALL_CATEGORIES : (options?.categories ?? ALL_CATEGORIES),
  )

  const sanitized = JSON.parse(JSON.stringify(har)) as Har

  if (sanitized.log?.entries) {
    sanitized.log.entries = sanitized.log.entries.map((entry) =>
      sanitizeEntry(entry, categories),
    )
  }

  return sanitized
}
