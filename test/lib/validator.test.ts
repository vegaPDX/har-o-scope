import { describe, it, expect } from 'vitest'
import { validate } from '../../src/lib/validator.js'

describe('validate', () => {
  describe('YAML syntax (Level 1)', () => {
    it('passes valid YAML', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
`)
      expect(result.errors.filter((e) => e.code === 'RULE001')).toHaveLength(0)
    })

    it('rejects invalid YAML syntax', () => {
      const result = validate('rules:\n  test:\n    bad: [unclosed')
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe('RULE001')
    })

    it('rejects empty content', () => {
      const result = validate('')
      expect(result.valid).toBe(false)
    })
  })

  describe('Schema conformance (Level 2)', () => {
    it('rejects missing rules key', () => {
      const result = validate('categories:\n  test: foo')
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'RULE004')).toBe(true)
    })

    it('rejects missing required fields', () => {
      const result = validate(`
rules:
  test:
    category: server
`)
      expect(result.valid).toBe(false)
      const missingFields = result.errors.filter((e) => e.message.includes('missing required field'))
      expect(missingFields.length).toBeGreaterThanOrEqual(3)
    })

    it('rejects invalid severity value', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: extreme
    title: test
    description: test
    recommendation: test
`)
      expect(result.errors.some((e) => e.code === 'RULE008')).toBe(true)
    })

    it('warns on unknown category', () => {
      const result = validate(`
rules:
  test:
    category: custom-category
    severity: warning
    title: test
    description: test
    recommendation: test
`)
      expect(result.warnings.some((e) => e.message.includes('unknown category'))).toBe(true)
    })

    it('warns on unknown rule fields', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    unknown_field: value
`)
      expect(result.warnings.some((e) => e.message.includes('unknown field'))).toBe(true)
    })

    it('accepts all valid severity values', () => {
      for (const sev of ['info', 'warning', 'critical']) {
        const result = validate(`
rules:
  test:
    category: server
    severity: ${sev}
    title: test
    description: test
    recommendation: test
`)
        expect(result.errors.filter((e) => e.code === 'RULE008')).toHaveLength(0)
      }
    })
  })

  describe('Semantic validation (Level 3)', () => {
    it('rejects unknown field paths', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    condition:
      match_all:
        - field: "nonexistent.path"
          gt: 100
`)
      expect(result.errors.some((e) => e.code === 'RULE002')).toBe(true)
    })

    it('suggests similar field paths', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    condition:
      match_all:
        - field: "timing.wait"
          gt: 100
`)
      const error = result.errors.find((e) => e.code === 'RULE002')
      expect(error).toBeDefined()
      expect(error!.suggestion).toContain('timings.wait')
    })

    it('accepts valid field paths', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    condition:
      match_all:
        - field: "timings.wait"
          gt: 100
        - field: "entry.response.status"
          gte: 200
        - field: "resourceType"
          equals: "xhr"
`)
      expect(result.errors.filter((e) => e.code === 'RULE002')).toHaveLength(0)
    })

    it('detects numeric range contradictions (gt >= lt)', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    condition:
      match_all:
        - field: "timings.wait"
          gt: 100
        - field: "timings.wait"
          lt: 50
`)
      expect(result.errors.some((e) => e.code === 'RULE005')).toBe(true)
    })

    it('detects equals + not_equals contradiction', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    condition:
      match_all:
        - field: "resourceType"
          equals: "xhr"
        - field: "resourceType"
          not_equals: "xhr"
`)
      expect(result.errors.some((e) => e.code === 'RULE005')).toBe(true)
    })

    it('detects in/not_in contradiction', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    condition:
      match_all:
        - field: "resourceType"
          in: ["xhr", "fetch"]
        - field: "resourceType"
          not_in: ["xhr", "fetch"]
`)
      expect(result.errors.some((e) => e.code === 'RULE005')).toBe(true)
    })

    it('rejects unknown operators', () => {
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    condition:
      match_all:
        - field: "timings.wait"
          bigger_than: 100
`)
      expect(result.errors.some((e) => e.code === 'RULE007')).toBe(true)
    })

    it('checks inherited condition references', () => {
      const shared = {
        conditions: {
          is_not_websocket: { field: 'isWebSocket', equals: false },
        },
      }
      const result = validate(`
rules:
  test:
    category: server
    severity: warning
    title: test
    description: test
    recommendation: test
    inherits: ["is_not_websocket", "nonexistent"]
`, shared)
      expect(result.errors.some((e) => e.message.includes('nonexistent'))).toBe(true)
    })
  })

  it('validates a complete valid rule file', () => {
    const result = validate(`
rules:
  slow-ttfb:
    category: server
    severity: warning
    severity_escalation:
      critical_threshold: 5
    title: "{count} slow request{s}"
    description: "Slow TTFB detected"
    recommendation: "Investigate server performance"
    condition:
      match_all:
        - field: "timings.wait"
          gt: 800
    impact:
      field: "timings.wait"
      baseline: 200
    root_cause_weight:
      server: 3

  excessive-requests:
    type: aggregate
    category: client
    severity: warning
    aggregate_condition:
      min_entries: 200
    title: "Too many requests"
    description: "High request count"
    recommendation: "Reduce requests"
`)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
