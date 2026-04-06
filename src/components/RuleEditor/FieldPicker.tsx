interface FieldPickerProps {
  value: string
  onChange: (value: string) => void
}

const FIELD_GROUPS = [
  {
    label: 'Timing',
    fields: [
      { path: 'timings.wait', desc: 'TTFB / server wait (ms)' },
      { path: 'timings.blocked', desc: 'Stalled/queuing (ms)' },
      { path: 'timings.dns', desc: 'DNS lookup (ms)' },
      { path: 'timings.connect', desc: 'TCP connect (ms)' },
      { path: 'timings.ssl', desc: 'TLS negotiation (ms)' },
      { path: 'timings.send', desc: 'Request send (ms)' },
      { path: 'timings.receive', desc: 'Content download (ms)' },
      { path: 'timings.total', desc: 'Total timing (ms)' },
    ],
  },
  {
    label: 'Response',
    fields: [
      { path: 'entry.response.status', desc: 'HTTP status code' },
      { path: 'transferSizeResolved', desc: 'Transfer size (bytes)' },
      { path: 'contentSize', desc: 'Content size (bytes)' },
      { path: 'entry.response.content.mimeType', desc: 'MIME type' },
    ],
  },
  {
    label: 'Request',
    fields: [
      { path: 'entry.request.url', desc: 'Full URL' },
      { path: 'entry.request.method', desc: 'HTTP method' },
      { path: 'httpVersion', desc: 'HTTP version' },
      { path: 'resourceType', desc: 'Resource type' },
    ],
  },
  {
    label: 'State',
    fields: [
      { path: 'isLongPoll', desc: 'Is long-polling' },
      { path: 'isWebSocket', desc: 'Is WebSocket' },
      { path: 'totalDuration', desc: 'Total duration (ms)' },
      { path: 'startTimeMs', desc: 'Start time from first request (ms)' },
    ],
  },
]

export function FieldPicker({ value, onChange }: FieldPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Select field"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--surface-3)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-primary)',
        padding: '4px 6px',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        minWidth: 180,
      }}
    >
      <option value="">Select field...</option>
      {FIELD_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.fields.map((f) => (
            <option key={f.path} value={f.path}>
              {f.path} — {f.desc}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
