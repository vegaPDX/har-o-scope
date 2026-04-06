import type { AnalysisResult, HealthScore, RootCauseResult, IssueSeverity } from '../lib/types'
import type { TabKey } from '../constants'
import { SEVERITY_STYLES } from '../constants'
import { HealthScoreDonut } from './HealthScoreDonut'
import { MetricCard } from './MetricCard'

interface SummaryDashboardProps {
  result: AnalysisResult
  healthScore: HealthScore
  onNavigate: (tab: TabKey, filter?: Record<string, string>) => void
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getRootCauseLabel(rc: RootCauseResult): string {
  const max = Math.max(rc.client, rc.network, rc.server)
  if (max === 0) return 'None'
  if (rc.server === max) return 'Server'
  if (rc.network === max) return 'Network'
  return 'Client'
}

function getRootCausePercent(rc: RootCauseResult): string {
  const max = Math.max(rc.client, rc.network, rc.server)
  return `${Math.round(max * 100)}%`
}

export function SummaryDashboard({ result, healthScore, onNavigate }: SummaryDashboardProps) {
  const { entries, findings, rootCause, metadata } = result

  const totalTransfer = entries.reduce((sum, e) => sum + e.transferSizeResolved, 0)

  const severityCounts: Record<IssueSeverity, number> = { critical: 0, warning: 0, info: 0 }
  for (const f of findings) severityCounts[f.severity]++

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: 'var(--space-6)',
      padding: 'var(--space-6)',
      alignItems: 'start',
    }}>
      {/* Health Score Donut */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}>
        <HealthScoreDonut score={healthScore.score} />
        {healthScore.score === 100 && (
          <div style={{
            fontSize: 13,
            color: 'var(--health-good)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            No issues found
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          analyzed in {metadata.analysisTimeMs}ms
        </div>
      </div>

      {/* Right side: metric cards + breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Metric cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-3)',
        }}>
          <MetricCard
            label="Requests"
            value={metadata.totalRequests}
            sublabel={`${metadata.rulesEvaluated} rules evaluated`}
            onClick={() => onNavigate('requests')}
            delay={0}
          />
          <MetricCard
            label="Wall Clock"
            value={formatMs(metadata.totalTimeMs)}
            onClick={() => onNavigate('waterfall')}
            delay={50}
          />
          <MetricCard
            label="Root Cause"
            value={getRootCauseLabel(rootCause)}
            sublabel={`${getRootCausePercent(rootCause)} confidence`}
            onClick={() => onNavigate('findings')}
            delay={100}
          />
          <MetricCard
            label="Findings"
            value={findings.length}
            sublabel={`${severityCounts.critical} critical, ${severityCounts.warning} warning`}
            onClick={() => onNavigate('findings')}
            delay={150}
          />
          <MetricCard
            label="Transfer"
            value={formatSize(totalTransfer)}
            onClick={() => onNavigate('requests')}
            delay={200}
          />
        </div>

        {/* Severity breakdown */}
        {findings.length > 0 && (
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            animation: 'fade-slide-up 200ms var(--ease-enter) 300ms both',
          }}>
            <div style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 500,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Findings by Severity
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {(['critical', 'warning', 'info'] as const).map((sev) => (
                <div
                  key={sev}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: SEVERITY_STYLES[sev].bg,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: SEVERITY_STYLES[sev].text, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {severityCounts[sev]}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {SEVERITY_STYLES[sev].label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Root cause bar */}
        <div style={{
          background: 'var(--surface-1)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          animation: 'fade-slide-up 200ms var(--ease-enter) 350ms both',
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontWeight: 500,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Root Cause Distribution
          </div>
          <RootCauseBar rootCause={rootCause} />
        </div>

        {/* Score breakdown */}
        {healthScore.breakdown.totalDeductions > 0 && (
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            animation: 'fade-slide-up 200ms var(--ease-enter) 400ms both',
          }}>
            <div style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 500,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Score Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              {healthScore.breakdown.findingDeductions.slice(0, 5).map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.reason}</span>
                  <span style={{ color: 'var(--severity-critical)' }}>-{d.points}</span>
                </div>
              ))}
              {healthScore.breakdown.findingDeductions.length > 5 && (
                <div style={{ color: 'var(--text-muted)' }}>
                  +{healthScore.breakdown.findingDeductions.length - 5} more deductions
                </div>
              )}
              {healthScore.breakdown.timingPenalty > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Timing penalty</span>
                  <span style={{ color: 'var(--severity-warning)' }}>-{healthScore.breakdown.timingPenalty}</span>
                </div>
              )}
              {healthScore.breakdown.volumePenalty > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Volume penalty</span>
                  <span style={{ color: 'var(--severity-warning)' }}>-{healthScore.breakdown.volumePenalty}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RootCauseBar({ rootCause }: { rootCause: RootCauseResult }) {
  const total = rootCause.client + rootCause.network + rootCause.server
  if (total === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No root cause signal</div>

  const segments = [
    { label: 'Client', value: rootCause.client, color: '#3b82f6' },
    { label: 'Network', value: rootCause.network, color: '#f59e0b' },
    { label: 'Server', value: rootCause.server, color: '#ef4444' },
  ]

  return (
    <div>
      <div style={{
        display: 'flex',
        height: 8,
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
        marginBottom: 6,
      }}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
              transition: 'width 300ms var(--ease-move)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(s.value * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
