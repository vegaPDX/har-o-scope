import { useState, useCallback, useMemo } from 'react'
import type { IssueSeverity, IssueCategory, NormalizedEntry } from '../../lib/types'
import { ConditionBuilder, type Condition } from './ConditionBuilder'
import { HeaderCondition } from './HeaderCondition'
import { SeverityConfig } from './SeverityConfig'
import { YamlPreview } from './YamlPreview'
import { RuleTestRunner } from './RuleTestRunner'

interface RuleEditorProps {
  entries: NormalizedEntry[]
}

interface HeaderCond {
  headerName: string
  operator: string
  value: string
  absent: boolean
}

export function RuleEditor({ entries }: RuleEditorProps) {
  const [ruleId, setRuleId] = useState('custom-rule')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [category, setCategory] = useState<IssueCategory>('performance')
  const [scope, setScope] = useState<'per_entry' | 'aggregate'>('per_entry')
  const [severity, setSeverity] = useState<IssueSeverity>('warning')
  const [minCount, setMinCount] = useState(1)
  const [conditions, setConditions] = useState<Condition[]>([
    { field: '', operator: 'gt', value: '' },
  ])
  const [logic, setLogic] = useState<'and' | 'or'>('and')
  const [headerConditions, setHeaderConditions] = useState<HeaderCond[]>([])
  const [escalations, setEscalations] = useState<{ threshold: number; to: IssueSeverity }[]>([])

  const addCondition = useCallback(() => {
    setConditions((prev) => [...prev, { field: '', operator: 'gt', value: '' }])
  }, [])

  const removeCondition = useCallback((i: number) => {
    setConditions((prev) => prev.filter((_, idx) => idx !== i))
  }, [])

  const updateCondition = useCallback((i: number, cond: Condition) => {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? cond : c)))
  }, [])

  const addHeader = useCallback(() => {
    setHeaderConditions((prev) => [...prev, { headerName: '', operator: 'equals', value: '', absent: false }])
  }, [])

  const removeHeader = useCallback((i: number) => {
    setHeaderConditions((prev) => prev.filter((_, idx) => idx !== i))
  }, [])

  const updateHeader = useCallback((i: number, field: string, val: string | boolean) => {
    setHeaderConditions((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, [field]: val } : h)),
    )
  }, [])

  const yamlPreviewProps = useMemo(() => ({
    ruleId,
    title,
    description,
    recommendation,
    category,
    severity,
    scope,
    minCount,
    conditions,
    logic,
    headerConditions,
    escalations,
  }), [ruleId, title, description, recommendation, category, severity, scope, minCount, conditions, logic, headerConditions, escalations])

  // Build YAML for test runner (inline to avoid circular dep)
  const ruleYaml = useMemo(() => {
    const lines: string[] = [`${ruleId}:`]
    if (conditions.length > 0) {
      lines.push(`  condition:`)
      const groupKey = logic === 'and' ? 'match_all' : 'match_any'
      lines.push(`    ${groupKey}:`)
      for (const c of conditions) {
        if (!c.field || !c.value) continue
        const v = isNaN(Number(c.value)) ? `"${c.value}"` : c.value
        lines.push(`      - field: ${c.field}`)
        lines.push(`        ${c.operator}: ${v}`)
      }
    }
    return lines.join('\n')
  }, [ruleId, conditions, logic])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-4)',
      padding: 'var(--space-4)',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Left: form */}
      <div style={{
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        {/* Basic info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InputField label="Rule ID" value={ruleId} onChange={setRuleId} mono placeholder="custom-rule" />
          <InputField label="Title" value={title} onChange={setTitle} placeholder="Short title with {{count}} template" />
          <InputField label="Description" value={description} onChange={setDescription} placeholder="Detailed explanation" />
          <InputField label="Recommendation" value={recommendation} onChange={setRecommendation} placeholder="How to fix" />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IssueCategory)}
                style={{ ...inputStyleBase, width: '100%' }}
              >
                <option value="performance">Performance</option>
                <option value="server">Server</option>
                <option value="network">Network</option>
                <option value="client">Client</option>
                <option value="security">Security</option>
                <option value="optimization">Optimization</option>
                <option value="errors">Errors</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'per_entry' | 'aggregate')}
                style={{ ...inputStyleBase, width: '100%' }}
              >
                <option value="per_entry">Per entry</option>
                <option value="aggregate">Aggregate</option>
              </select>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <ConditionBuilder
          conditions={conditions}
          logic={logic}
          onLogicChange={setLogic}
          onAdd={addCondition}
          onRemove={removeCondition}
          onUpdate={updateCondition}
        />

        {/* Header conditions */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}>
              Header Conditions
            </span>
            <button
              onClick={addHeader}
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
          {headerConditions.map((h, i) => (
            <HeaderCondition
              key={i}
              headerName={h.headerName}
              operator={h.operator}
              value={h.value}
              absent={h.absent}
              onUpdate={(field, val) => updateHeader(i, field, val)}
              onRemove={() => removeHeader(i)}
            />
          ))}
        </div>

        {/* Severity */}
        <SeverityConfig
          severity={severity}
          minCount={minCount}
          escalations={escalations}
          onSeverityChange={setSeverity}
          onMinCountChange={setMinCount}
          onEscalationChange={(i, field, val) => {
            setEscalations((prev) =>
              prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)),
            )
          }}
          onAddEscalation={() =>
            setEscalations((prev) => [...prev, { threshold: 5, to: 'critical' }])
          }
          onRemoveEscalation={(i) =>
            setEscalations((prev) => prev.filter((_, idx) => idx !== i))
          }
        />
      </div>

      {/* Right: YAML preview + test runner */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        overflow: 'auto',
      }}>
        <YamlPreview {...yamlPreviewProps} />
        <RuleTestRunner entries={entries} ruleYaml={ruleYaml} />
      </div>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputStyleBase,
          width: '100%',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        }}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 2,
}

const inputStyleBase: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--surface-3)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '4px 6px',
  fontSize: 12,
  outline: 'none',
}
