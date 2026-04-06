import { FieldPicker } from './FieldPicker'

export interface Condition {
  field: string
  operator: string
  value: string
}

interface ConditionBuilderProps {
  conditions: Condition[]
  logic: 'and' | 'or'
  onLogicChange: (logic: 'and' | 'or') => void
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, condition: Condition) => void
}

const OPERATORS = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
  { value: 'neq', label: '!=' },
  { value: 'contains', label: 'contains' },
  { value: 'regex', label: 'regex' },
]

export function ConditionBuilder({
  conditions,
  logic,
  onLogicChange,
  onAdd,
  onRemove,
  onUpdate,
}: ConditionBuilderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
        }}>
          Conditions
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={logic === 'and'}
              onChange={() => onLogicChange('and')}
              name="logic"
            />
            <span style={{ color: 'var(--text-secondary)' }}>AND</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={logic === 'or'}
              onChange={() => onLogicChange('or')}
              name="logic"
            />
            <span style={{ color: 'var(--text-secondary)' }}>OR</span>
          </label>
        </div>
      </div>

      {conditions.map((cond, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FieldPicker
            value={cond.field}
            onChange={(field) => onUpdate(i, { ...cond, field })}
          />
          <select
            value={cond.operator}
            onChange={(e) => onUpdate(i, { ...cond, operator: e.target.value })}
            aria-label="Operator"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--surface-3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '4px 6px',
              fontSize: 12,
              cursor: 'pointer',
              width: 90,
            }}
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Value"
            value={cond.value}
            onChange={(e) => onUpdate(i, { ...cond, value: e.target.value })}
            aria-label="Condition value"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--surface-3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '4px 6px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              flex: 1,
              outline: 'none',
            }}
          />
          <button
            onClick={() => onRemove(i)}
            aria-label="Remove condition"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={onAdd}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          border: '1px dashed var(--surface-3)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--accent)',
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: 11,
        }}
      >
        + Add condition
      </button>
    </div>
  )
}
