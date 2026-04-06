import type { ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: string | number
  sublabel?: string
  icon?: ReactNode
  onClick?: () => void
  delay?: number
}

export function MetricCard({ label, value, sublabel, icon, onClick, delay = 0 }: MetricCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--surface-3)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        transition: 'box-shadow 100ms, transform 100ms',
        animation: `fade-slide-up 200ms var(--ease-enter) ${delay}ms both`,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-primary)',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        color: 'var(--text-muted)',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}>
        {icon}
        {label}
      </div>
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
      {sublabel && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}>
          {sublabel}
        </div>
      )}
    </button>
  )
}
