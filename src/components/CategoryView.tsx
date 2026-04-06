import { useMemo } from 'react'
import type { Finding, IssueCategory } from '../lib/types'
import { FindingCard } from './FindingCard'

interface CategoryViewProps {
  findings: Finding[]
  onShowInWaterfall?: (entryIndices: number[]) => void
}

const CATEGORY_ORDER: IssueCategory[] = [
  'performance',
  'server',
  'network',
  'client',
  'security',
  'optimization',
  'errors',
  'informational',
]

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  performance: 'Performance',
  server: 'Server',
  network: 'Network',
  client: 'Client',
  security: 'Security',
  optimization: 'Optimization',
  errors: 'Errors',
  informational: 'Informational',
}

export function CategoryView({ findings, onShowInWaterfall }: CategoryViewProps) {
  const grouped = useMemo(() => {
    const groups = new Map<IssueCategory, Finding[]>()
    for (const f of findings) {
      const existing = groups.get(f.category) ?? []
      existing.push(f)
      groups.set(f.category, existing)
    }
    // Sort groups by category order, then findings by severity within each group
    const sevOrder = { critical: 0, warning: 1, info: 2 }
    return CATEGORY_ORDER
      .filter((cat) => groups.has(cat))
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        findings: groups.get(cat)!.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]),
      }))
  }, [findings])

  if (findings.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12)',
        color: 'var(--text-muted)',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <div style={{ marginTop: 8, fontSize: 14 }}>No findings</div>
        <div style={{ fontSize: 12 }}>All rules passed</div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
      padding: 'var(--space-4)',
      overflow: 'auto',
    }}>
      {grouped.map((group) => (
        <div key={group.category}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {group.label}
            <span style={{
              fontSize: 10,
              fontWeight: 400,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              ({group.findings.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.findings.map((finding, i) => (
              <FindingCard
                key={`${finding.ruleId}-${i}`}
                finding={finding}
                onShowInWaterfall={onShowInWaterfall}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
