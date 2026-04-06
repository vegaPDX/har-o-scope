import { useState, useCallback } from 'react'
import type { NormalizedEntry } from '../../lib/types'

interface RuleTestRunnerProps {
  entries: NormalizedEntry[]
  ruleYaml: string
}

interface TestResult {
  matched: number
  total: number
  samples: { index: number; url: string; status: number }[]
}

export function RuleTestRunner({ entries, ruleYaml }: RuleTestRunnerProps) {
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runTest = useCallback(async () => {
    setError(null)
    setResult(null)

    try {
      // Dynamic import to keep the main bundle light
      const { default: yaml } = await import('js-yaml')
      const parsed = yaml.load(ruleYaml)

      if (!parsed || typeof parsed !== 'object') {
        setError('Invalid YAML: must be an object')
        return
      }

      const rules = parsed as Record<string, any>
      const ruleId = Object.keys(rules)[0]
      const rule = rules[ruleId]

      if (!rule?.condition) {
        setError('Rule must have at least one condition')
        return
      }

      // Simple condition matching (subset of the full engine)
      const matched: { index: number; url: string; status: number }[] = []
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]
        if (simpleMatch(e, rule.condition)) {
          matched.push({
            index: i,
            url: e.entry.request.url,
            status: e.entry.response.status,
          })
        }
      }

      setResult({
        matched: matched.length,
        total: entries.length,
        samples: matched.slice(0, 10),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed')
    }
  }, [entries, ruleYaml])

  return (
    <div style={{
      borderTop: '1px solid var(--surface-3)',
      padding: '8px 0',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
        }}>
          Test Runner
        </span>
        <button
          onClick={runTest}
          disabled={entries.length === 0}
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            opacity: entries.length === 0 ? 0.5 : 1,
          }}
        >
          Run against loaded HAR
        </button>
      </div>

      {entries.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Load a HAR file first to test rules
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 11,
          color: 'var(--severity-critical)',
          padding: '4px 0',
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ fontSize: 11 }}>
          <div style={{
            color: result.matched > 0 ? 'var(--severity-warning)' : 'var(--health-good)',
            fontWeight: 600,
            marginBottom: 4,
          }}>
            {result.matched} / {result.total} entries matched
          </div>
          {result.samples.length > 0 && (
            <div style={{
              maxHeight: 150,
              overflow: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}>
              {result.samples.map((s) => (
                <div key={s.index} style={{
                  padding: '2px 0',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  [{s.status}] {s.url}
                </div>
              ))}
              {result.matched > 10 && (
                <div style={{ color: 'var(--text-muted)' }}>
                  +{result.matched - 10} more
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Simplified condition evaluator (enough for test preview, not the full engine)
function simpleMatch(entry: NormalizedEntry, condition: any): boolean {
  if (condition.match_all) {
    return (condition.match_all as any[]).every((c: any) => matchSingle(entry, c))
  }
  if (condition.match_any) {
    return (condition.match_any as any[]).some((c: any) => matchSingle(entry, c))
  }
  return matchSingle(entry, condition)
}

function matchSingle(entry: NormalizedEntry, cond: any): boolean {
  if (cond.response_header) return true // skip header checks in preview
  if (!cond.field) return true

  const val = getNestedField(entry, cond.field)
  if (val === undefined) return false

  const numVal = typeof val === 'number' ? val : parseFloat(val as string)

  if (cond.gt !== undefined) return numVal > Number(cond.gt)
  if (cond.gte !== undefined) return numVal >= Number(cond.gte)
  if (cond.lt !== undefined) return numVal < Number(cond.lt)
  if (cond.lte !== undefined) return numVal <= Number(cond.lte)
  if (cond.eq !== undefined) return String(val) === String(cond.eq)
  if (cond.neq !== undefined) return String(val) !== String(cond.neq)
  if (cond.contains !== undefined) return String(val).includes(String(cond.contains))
  if (cond.regex !== undefined) {
    try { return new RegExp(cond.regex).test(String(val)) } catch { return false }
  }
  return false
}

function getNestedField(obj: any, path: string): unknown {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}
