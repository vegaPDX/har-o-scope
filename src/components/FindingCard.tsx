import { useState } from 'react'
import type { Finding } from '../lib/types'
import { SEVERITY_STYLES } from '../constants'

interface FindingCardProps {
  finding: Finding
  onShowInWaterfall?: (entryIndices: number[]) => void
}

export function FindingCard({ finding, onShowInWaterfall }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const style = SEVERITY_STYLES[finding.severity]

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--surface-3)',
        borderLeft: `3px solid ${style.text}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
        }}
      >
        <span
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}
        >
          ▶
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: 'var(--radius-sm)',
            background: style.bg,
            color: style.text,
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
          }}
          aria-label={`Severity: ${finding.severity}`}
        >
          {style.label}
        </span>
        <span style={{ fontWeight: 500, flex: 1 }}>{finding.title}</span>
        <span style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          {finding.affectedEntries.length} {finding.affectedEntries.length === 1 ? 'request' : 'requests'}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: '0 12px 12px 32px',
            animation: 'fade-slide-up 200ms var(--ease-enter)',
          }}
        >
          <div style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginBottom: 8,
            lineHeight: 1.5,
          }}>
            {finding.description}
          </div>

          {finding.recommendation && (
            <div style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              background: 'var(--surface-2)',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 8,
            }}>
              <span style={{ fontWeight: 500 }}>Fix: </span>
              {finding.recommendation}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              Rule: {finding.ruleId}
            </span>
            <span style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              Category: {finding.category}
            </span>
            {onShowInWaterfall && finding.affectedEntries.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowInWaterfall(finding.affectedEntries)
                }}
                style={{
                  fontSize: 11,
                  color: 'var(--accent)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Show in Waterfall
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
