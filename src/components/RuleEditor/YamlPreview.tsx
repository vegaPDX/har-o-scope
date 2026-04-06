import type { Condition } from './ConditionBuilder'
import type { IssueSeverity, IssueCategory } from '../../lib/types'

interface YamlPreviewProps {
  ruleId: string
  title: string
  description: string
  recommendation: string
  category: IssueCategory
  severity: IssueSeverity
  scope: 'per_entry' | 'aggregate'
  minCount: number
  conditions: Condition[]
  logic: 'and' | 'or'
  headerConditions: { headerName: string; operator: string; value: string; absent: boolean }[]
  escalations: { threshold: number; to: IssueSeverity }[]
}

function buildYaml(props: YamlPreviewProps): string {
  const lines: string[] = []

  lines.push(`${props.ruleId}:`)
  lines.push(`  title: "${props.title}"`)
  lines.push(`  description: "${props.description}"`)
  if (props.recommendation) {
    lines.push(`  recommendation: "${props.recommendation}"`)
  }
  lines.push(`  category: ${props.category}`)
  lines.push(`  severity: ${props.severity}`)
  lines.push(`  scope: ${props.scope}`)

  if (props.minCount > 1) {
    lines.push(`  min_count: ${props.minCount}`)
  }

  // Conditions
  if (props.conditions.length > 0 || props.headerConditions.length > 0) {
    lines.push(`  condition:`)
    const groupKey = props.logic === 'and' ? 'match_all' : 'match_any'
    lines.push(`    ${groupKey}:`)

    for (const cond of props.conditions) {
      if (!cond.field || !cond.value) continue
      const val = isNaN(Number(cond.value)) ? `"${cond.value}"` : cond.value
      lines.push(`      - field: ${cond.field}`)
      lines.push(`        ${cond.operator}: ${val}`)
    }

    for (const h of props.headerConditions) {
      if (!h.headerName) continue
      lines.push(`      - response_header:`)
      lines.push(`          name: "${h.headerName}"`)
      if (h.absent) {
        lines.push(`          absent: true`)
      } else {
        lines.push(`          ${h.operator}: "${h.value}"`)
      }
    }
  }

  // Escalation
  if (props.escalations.length > 0) {
    lines.push(`  severity_escalation:`)
    for (const esc of props.escalations) {
      lines.push(`    - threshold: ${esc.threshold}`)
      lines.push(`      to: ${esc.to}`)
    }
  }

  // Root cause weight
  lines.push(`  root_cause_weight:`)
  switch (props.category) {
    case 'server':
      lines.push(`    server: 0.8`)
      break
    case 'network':
      lines.push(`    network: 0.8`)
      break
    case 'client':
      lines.push(`    client: 0.8`)
      break
    default:
      lines.push(`    client: 0.3`)
      lines.push(`    network: 0.3`)
      lines.push(`    server: 0.3`)
  }

  return lines.join('\n')
}

export function YamlPreview(props: YamlPreviewProps) {
  const yaml = buildYaml(props)

  return (
    <div style={{
      background: 'var(--surface-0)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--surface-3)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 8px',
        borderBottom: '1px solid var(--surface-2)',
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
        }}>
          YAML Preview
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(yaml)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Copy
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: 8,
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
        overflow: 'auto',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}>
        {yaml}
      </pre>
    </div>
  )
}
