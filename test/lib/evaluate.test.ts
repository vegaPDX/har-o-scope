import { describe, it, expect } from 'vitest'
import {
  getField,
  evaluateFieldCondition,
  evaluateCondition,
  computeSeverity,
  computeImpact,
  interpolate,
} from '../../src/lib/evaluate.js'

describe('getField', () => {
  it('accesses nested properties', () => {
    expect(getField({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
  })

  it('returns undefined for missing paths', () => {
    expect(getField({ a: 1 }, 'b.c')).toBeUndefined()
  })

  it('returns undefined for null intermediate', () => {
    expect(getField({ a: null }, 'a.b')).toBeUndefined()
  })

  it('blocks __proto__ traversal', () => {
    expect(getField({}, '__proto__.toString')).toBeUndefined()
  })

  it('blocks constructor traversal', () => {
    expect(getField({}, 'constructor.name')).toBeUndefined()
  })

  it('blocks prototype traversal', () => {
    expect(getField({}, 'prototype.toString')).toBeUndefined()
  })
})

describe('evaluateFieldCondition', () => {
  const entry = {
    timings: { wait: 1500, blocked: 200 },
    resourceType: 'xhr',
    entry: { response: { status: 200 } },
  }

  it('equals', () => {
    expect(evaluateFieldCondition(entry, { field: 'resourceType', equals: 'xhr' })).toBe(true)
    expect(evaluateFieldCondition(entry, { field: 'resourceType', equals: 'script' })).toBe(false)
  })

  it('not_equals', () => {
    expect(evaluateFieldCondition(entry, { field: 'resourceType', not_equals: 'script' })).toBe(true)
    expect(evaluateFieldCondition(entry, { field: 'resourceType', not_equals: 'xhr' })).toBe(false)
  })

  it('gt / lt / gte / lte', () => {
    expect(evaluateFieldCondition(entry, { field: 'timings.wait', gt: 800 })).toBe(true)
    expect(evaluateFieldCondition(entry, { field: 'timings.wait', gt: 2000 })).toBe(false)
    expect(evaluateFieldCondition(entry, { field: 'timings.wait', lt: 2000 })).toBe(true)
    expect(evaluateFieldCondition(entry, { field: 'timings.wait', gte: 1500 })).toBe(true)
    expect(evaluateFieldCondition(entry, { field: 'timings.wait', lte: 1500 })).toBe(true)
  })

  it('in / not_in', () => {
    expect(evaluateFieldCondition(entry, { field: 'resourceType', in: ['xhr', 'fetch'] })).toBe(true)
    expect(evaluateFieldCondition(entry, { field: 'resourceType', in: ['script'] })).toBe(false)
    expect(evaluateFieldCondition(entry, { field: 'resourceType', not_in: ['script'] })).toBe(true)
  })

  it('matches / not_matches', () => {
    expect(evaluateFieldCondition(entry, { field: 'resourceType', matches: 'xhr|fetch' })).toBe(true)
    expect(evaluateFieldCondition(entry, { field: 'resourceType', not_matches: 'script' })).toBe(true)
  })

  it('matches is case-insensitive', () => {
    expect(evaluateFieldCondition({ val: 'Hello' }, { field: 'val', matches: 'hello' })).toBe(true)
  })

  it('handles missing field gracefully', () => {
    expect(evaluateFieldCondition(entry, { field: 'missing.path', gt: 0 })).toBe(false)
  })

  it('uses field_fallback when primary is 0', () => {
    const obj = { primary: 0, fallback: 500 }
    expect(evaluateFieldCondition(obj, { field: 'primary', field_fallback: 'fallback', gt: 100 })).toBe(true)
  })

  it('uses field_fallback when primary is null', () => {
    const obj = { primary: null, fallback: 500 }
    expect(evaluateFieldCondition(obj, { field: 'primary', field_fallback: 'fallback', gt: 100 })).toBe(true)
  })

  it('returns true when no operator is specified', () => {
    expect(evaluateFieldCondition(entry, { field: 'resourceType' })).toBe(true)
  })
})

describe('evaluateCondition', () => {
  const entry = {
    timings: { wait: 1500 },
    resourceType: 'xhr',
    entry: {
      response: {
        headers: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Cache-Control', value: 'no-store' },
        ],
      },
    },
  }

  it('match_all: all must pass', () => {
    expect(evaluateCondition(entry, {
      match_all: [
        { field: 'timings.wait', gt: 800 },
        { field: 'resourceType', equals: 'xhr' },
      ],
    })).toBe(true)

    expect(evaluateCondition(entry, {
      match_all: [
        { field: 'timings.wait', gt: 800 },
        { field: 'resourceType', equals: 'script' },
      ],
    })).toBe(false)
  })

  it('match_any: at least one must pass', () => {
    expect(evaluateCondition(entry, {
      match_any: [
        { field: 'timings.wait', gt: 2000 },
        { field: 'resourceType', equals: 'xhr' },
      ],
    })).toBe(true)
  })

  it('has_response_header', () => {
    expect(evaluateCondition(entry, {
      has_response_header: { name: 'cache-control', value_matches: 'no-store' },
    })).toBe(true)

    expect(evaluateCondition(entry, {
      has_response_header: { name: 'cache-control', value_matches: 'max-age' },
    })).toBe(false)
  })

  it('no_response_header', () => {
    expect(evaluateCondition(entry, {
      no_response_header: { name: 'etag' },
    })).toBe(true)

    expect(evaluateCondition(entry, {
      no_response_header: { name: 'cache-control' },
    })).toBe(false)
  })

  it('header name matching is case-insensitive', () => {
    expect(evaluateCondition(entry, {
      has_response_header: { name: 'CONTENT-TYPE', value_matches: 'json' },
    })).toBe(true)
  })

  it('nested condition groups', () => {
    expect(evaluateCondition(entry, {
      match_all: [
        { field: 'timings.wait', gt: 800 },
        {
          match_any: [
            { field: 'resourceType', equals: 'script' },
            { field: 'resourceType', equals: 'xhr' },
          ],
        },
      ],
    })).toBe(true)
  })
})

describe('computeSeverity', () => {
  it('returns base severity without escalation', () => {
    expect(computeSeverity('info', undefined, 10, 100)).toBe('info')
  })

  it('escalates by threshold', () => {
    expect(computeSeverity('info', { warning_threshold: 5 }, 10, 100)).toBe('warning')
    expect(computeSeverity('info', { warning_threshold: 5 }, 3, 100)).toBe('info')
  })

  it('escalates by ratio', () => {
    expect(computeSeverity('info', { warning_ratio: 0.3 }, 40, 100)).toBe('warning')
    expect(computeSeverity('info', { warning_ratio: 0.3 }, 20, 100)).toBe('info')
  })

  it('escalates to critical', () => {
    expect(computeSeverity('warning', { critical_threshold: 10 }, 15, 100)).toBe('critical')
  })

  it('never downgrades severity', () => {
    expect(computeSeverity('critical', { warning_threshold: 1 }, 5, 100)).toBe('critical')
  })
})

describe('computeImpact', () => {
  const entries = [
    { val: 100 },
    { val: 200 },
    { val: 300 },
  ]

  it('sums field values for affected indices', () => {
    expect(computeImpact(entries, [0, 2], { field: 'val' })).toBe(400)
  })

  it('subtracts baseline', () => {
    expect(computeImpact(entries, [0, 2], { field: 'val', baseline: 50 })).toBe(300)
  })

  it('returns fixed value', () => {
    expect(computeImpact(entries, [0], { value: 42 })).toBe(42)
  })

  it('returns 0 without impact spec', () => {
    expect(computeImpact(entries, [0], undefined)).toBe(0)
  })

  it('sums multiple fields', () => {
    const multi = [{ a: 10, b: 20 }, { a: 30, b: 40 }]
    expect(computeImpact(multi, [0, 1], { fields: ['a', 'b'] })).toBe(100)
  })
})

describe('interpolate', () => {
  it('replaces known variables', () => {
    expect(interpolate('{count} items found', { count: 5 })).toBe('5 items found')
  })

  it('preserves unknown variables', () => {
    expect(interpolate('{count} {unknown}', { count: 5 })).toBe('5 {unknown}')
  })

  it('handles pluralization', () => {
    expect(interpolate('{count} item{s}', { count: 1, s: '' })).toBe('1 item')
    expect(interpolate('{count} item{s}', { count: 5, s: 's' })).toBe('5 items')
  })
})
