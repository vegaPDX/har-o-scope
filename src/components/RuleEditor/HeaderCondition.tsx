interface HeaderConditionProps {
  headerName: string
  operator: string
  value: string
  absent: boolean
  onUpdate: (field: string, val: string | boolean) => void
  onRemove: () => void
}

export function HeaderCondition({ headerName, operator, value, absent, onUpdate, onRemove }: HeaderConditionProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 0',
    }}>
      <input
        type="text"
        placeholder="Header name"
        value={headerName}
        onChange={(e) => onUpdate('headerName', e.target.value)}
        aria-label="Header name"
        style={inputStyle}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
        <input
          type="checkbox"
          checked={absent}
          onChange={(e) => onUpdate('absent', e.target.checked)}
        />
        absent
      </label>
      {!absent && (
        <>
          <select
            value={operator}
            onChange={(e) => onUpdate('operator', e.target.value)}
            aria-label="Operator"
            style={{
              ...inputStyle,
              width: 100,
              cursor: 'pointer',
            }}
          >
            <option value="equals">equals</option>
            <option value="contains">contains</option>
            <option value="regex">regex</option>
          </select>
          <input
            type="text"
            placeholder="Value"
            value={value}
            onChange={(e) => onUpdate('value', e.target.value)}
            aria-label="Header value"
            style={{ ...inputStyle, flex: 1 }}
          />
        </>
      )}
      <button
        onClick={onRemove}
        aria-label="Remove header condition"
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
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--surface-3)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '4px 6px',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  outline: 'none',
}
