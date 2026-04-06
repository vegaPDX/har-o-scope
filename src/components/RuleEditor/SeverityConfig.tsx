import type { IssueSeverity } from '../../lib/types'

interface SeverityConfigProps {
  severity: IssueSeverity
  minCount: number
  escalations: { threshold: number; to: IssueSeverity }[]
  onSeverityChange: (sev: IssueSeverity) => void
  onMinCountChange: (n: number) => void
  onEscalationChange: (idx: number, field: 'threshold' | 'to', value: number | IssueSeverity) => void
  onAddEscalation: () => void
  onRemoveEscalation: (idx: number) => void
}

export function SeverityConfig({
  severity,
  minCount,
  escalations,
  onSeverityChange,
  onMinCountChange,
  onEscalationChange,
  onAddEscalation,
  onRemoveEscalation,
}: SeverityConfigProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={labelStyle}>Base severity</label>
        <select
          value={severity}
          onChange={(e) => onSeverityChange(e.target.value as IssueSeverity)}
          style={selectStyle}
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={labelStyle}>Min matches</label>
        <input
          type="number"
          min={1}
          value={minCount}
          onChange={(e) => onMinCountChange(parseInt(e.target.value) || 1)}
          style={{ ...selectStyle, width: 60, fontFamily: 'var(--font-mono)' }}
        />
      </div>

      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}>
          <span style={labelStyle}>Escalation thresholds</span>
          <button
            onClick={onAddEscalation}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            + Add
          </button>
        </div>
        {escalations.map((esc, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>at</span>
            <input
              type="number"
              min={1}
              value={esc.threshold}
              onChange={(e) => onEscalationChange(i, 'threshold', parseInt(e.target.value) || 1)}
              style={{ ...selectStyle, width: 50, fontFamily: 'var(--font-mono)' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>matches, escalate to</span>
            <select
              value={esc.to}
              onChange={(e) => onEscalationChange(i, 'to', e.target.value as IssueSeverity)}
              style={selectStyle}
            >
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <button
              onClick={() => onRemoveEscalation(i)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  minWidth: 90,
}

const selectStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--surface-3)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '4px 6px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
}
