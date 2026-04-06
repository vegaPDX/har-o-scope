/**
 * Trace sanitizer: sanitizes output for verbose/trace/error messages.
 * Public exports used by CLI --verbose, browser RuleTestRunner, and error formatting.
 *
 * Three functions:
 *   sanitizeTrace(text) - general-purpose, catches headers + URLs + tokens
 *   sanitizeUrl(url) - strips query params, preserves path
 *   sanitizeHeaderValue(name, value) - redacts value for sensitive headers
 */

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'x-xsrf-token',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
])

const REDACTED = '[REDACTED]'

// ── sanitizeUrl ─────────────────────────────────────────────────

/**
 * Strip query parameters from a URL. Preserves path and fragment.
 * Handles malformed URLs gracefully (returns input unchanged if unparseable).
 */
export function sanitizeUrl(url: string): string {
  if (!url) return url

  try {
    const parsed = new URL(url)
    // Clear all query params
    parsed.search = ''
    return parsed.toString()
  } catch {
    // Fallback: strip everything after '?'
    const queryIdx = url.indexOf('?')
    if (queryIdx === -1) return url
    const fragIdx = url.indexOf('#')
    if (fragIdx !== -1 && fragIdx < queryIdx) return url
    return fragIdx > queryIdx ? url.slice(0, queryIdx) + url.slice(fragIdx) : url.slice(0, queryIdx)
  }
}

// ── sanitizeHeaderValue ─────────────────────────────────────────

/**
 * Redact the value of sensitive headers. Non-sensitive headers pass through.
 * Case-insensitive header name matching.
 */
export function sanitizeHeaderValue(name: string, value: string): string {
  if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
    return REDACTED
  }
  return value
}

// ── sanitizeTrace ───────────────────────────────────────────────

// Patterns for common sensitive values in trace text
const HEADER_VALUE_PATTERN = /^(\s*(?:Authorization|Cookie|Set-Cookie|X-CSRF-Token|X-XSRF-Token|Proxy-Authorization|X-Api-Key|X-Auth-Token)\s*:\s*)(.+)$/gim
const URL_QUERY_PATTERN = /https?:\/\/[^\s"']+\?[^\s"']+/gi
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const JWT_LIKE_PATTERN = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g

/**
 * General-purpose trace sanitizer. Catches:
 * - Header values (Authorization: Bearer xxx -> Authorization: [REDACTED])
 * - URL query params (https://example.com?token=abc -> https://example.com)
 * - Bearer tokens
 * - JWT-like strings
 *
 * Handles multiline input. Returns empty string for null/undefined input.
 */
export function sanitizeTrace(text: string): string {
  if (!text) return ''

  let result = text

  // Redact header values (must be first to catch Authorization: Bearer xxx)
  result = result.replace(HEADER_VALUE_PATTERN, `$1${REDACTED}`)

  // Redact Bearer tokens not already caught by header patterns
  result = result.replace(BEARER_PATTERN, `Bearer ${REDACTED}`)

  // Redact JWTs
  result = result.replace(JWT_LIKE_PATTERN, `${REDACTED}`)

  // Strip query params from URLs
  result = result.replace(URL_QUERY_PATTERN, (match) => sanitizeUrl(match))

  return result
}
