import type { DiffResult, HealthScore, Finding } from '../lib/types'
import { HealthScoreDonut } from './HealthScoreDonut'
import { SEVERITY_STYLES } from '../constants'

interface CompareDashboardProps {
  diff: DiffResult
  beforeScore: HealthScore
  afterScore: HealthScore
  beforeName: string
  afterName: string
  onBack: () => void
}

function formatMs(ms: number): string {
  if (Math.abs(ms) < 1) return '<1 ms'
  if (Math.abs(ms) < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function formatDelta(n: number, unit: string): string {
  const prefix = n > 0 ? '+' : ''
  return `${prefix}${n}${unit}`
}

function deltaColor(delta: number, lowerIsBetter = true): string {
  if (delta === 0) return 'var(--diff-neutral)'
  return (lowerIsBetter ? delta < 0 : delta > 0) ? 'var(--diff-better)' : 'var(--diff-worse)'
}

export function CompareDashboard({
  diff,
  beforeScore,
  afterScore,
  beforeName,
  afterName,
  onBack,
}: CompareDashboardProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
      padding: 'var(--space-6)',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Comparing: {beforeName} vs {afterName}
        </span>
      </div>

      {/* Score comparison */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: 'var(--space-6)',
        alignItems: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
            {beforeName}
          </div>
          <HealthScoreDonut score={beforeScore.score} size={120} />
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{
            fontSize: 28,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: deltaColor(diff.scoreDelta, false),
          }}>
            {formatDelta(diff.scoreDelta, '')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>score delta</span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
            {afterName}
          </div>
          <HealthScoreDonut score={afterScore.score} size={120} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-3)',
      }}>
        <StatCard
          label="Request Count"
          delta={diff.requestCountDelta}
          unit=""
          lowerIsBetter
        />
        <StatCard
          label="Total Time"
          delta={diff.totalTimeDelta}
          unit=" ms"
          lowerIsBetter
        />
        <StatCard
          label="Score Change"
          delta={diff.scoreDelta}
          unit=""
          lowerIsBetter={false}
        />
      </div>

      {/* New findings */}
      {diff.newFindings.length > 0 && (
        <FindingList title="New Findings (regressions)" findings={diff.newFindings} color="var(--diff-worse)" />
      )}

      {/* Resolved findings */}
      {diff.resolvedFindings.length > 0 && (
        <FindingList title="Resolved Findings (improvements)" findings={diff.resolvedFindings} color="var(--diff-better)" />
      )}

      {/* Timing deltas */}
      {diff.timingDeltas.length > 0 && (
        <div style={{
          background: 'var(--surface-1)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Timing Deltas
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}>
              <thead>
                <tr>
                  {['URL Pattern', 'Before', 'After', 'Delta'].map((h) => (
                    <th key={h} style={{
                      textAlign: h === 'URL Pattern' ? 'left' : 'right',
                      padding: '4px 8px',
                      borderBottom: '1px solid var(--surface-3)',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                      fontSize: 11,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diff.timingDeltas.slice(0, 20).map((td) => (
                  <tr key={td.urlPattern}>
                    <td style={{
                      padding: '4px 8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 300,
                    }}>
                      {td.urlPattern}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      {formatMs(td.beforeAvgMs)}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      {formatMs(td.afterAvgMs)}
                    </td>
                    <td style={{
                      padding: '4px 8px',
                      textAlign: 'right',
                      color: deltaColor(td.deltaMs),
                      fontWeight: 600,
                    }}>
                      {formatDelta(Math.round(td.deltaMs), ' ms')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  delta,
  unit,
  lowerIsBetter,
}: {
  label: string
  delta: number
  unit: string
  lowerIsBetter: boolean
}) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--surface-3)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-3)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: deltaColor(delta, lowerIsBetter),
      }}>
        {formatDelta(delta, unit)}
      </div>
    </div>
  )
}

function FindingList({
  title,
  findings,
  color,
}: {
  title: string
  findings: Finding[]
  color: string
}) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-3)',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {title} ({findings.length})
      </div>
      {findings.map((f, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 0',
          borderBottom: i < findings.length - 1 ? '1px solid var(--surface-2)' : 'none',
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 4px',
            borderRadius: 'var(--radius-sm)',
            background: SEVERITY_STYLES[f.severity].bg,
            color: SEVERITY_STYLES[f.severity].text,
            fontFamily: 'var(--font-mono)',
          }}>
            {f.severity}
          </span>
          <span style={{ fontSize: 12, flex: 1 }}>{f.title}</span>
        </div>
      ))}
    </div>
  )
}
