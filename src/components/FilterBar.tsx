import { useRef } from 'react'
import type { FilterState, SortField, GroupBy } from '../hooks/useFilters'
import type { ResourceType } from '../lib/types'

interface FilterBarProps {
  filters: FilterState
  onUpdate: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  onReset: () => void
  entryCount: number
  totalCount: number
}

export function FilterBar({ filters, onUpdate, onReset, entryCount, totalCount }: FilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  const hasActiveFilters =
    filters.search !== '' ||
    filters.resourceType !== 'all' ||
    filters.statusCode !== 'all' ||
    filters.minDuration > 0

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--surface-2)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Search */}
      <input
        ref={searchRef}
        type="text"
        placeholder="Filter URLs..."
        value={filters.search}
        onChange={(e) => onUpdate('search', e.target.value)}
        aria-label="Filter by URL"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--surface-3)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          padding: '4px 8px',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          width: 200,
          outline: 'none',
        }}
      />

      {/* Resource type */}
      <select
        value={filters.resourceType}
        onChange={(e) => onUpdate('resourceType', e.target.value as ResourceType | 'all')}
        aria-label="Filter by resource type"
        style={selectStyle}
      >
        <option value="all">All types</option>
        <option value="document">Doc</option>
        <option value="script">JS</option>
        <option value="stylesheet">CSS</option>
        <option value="image">Image</option>
        <option value="font">Font</option>
        <option value="xhr">XHR</option>
        <option value="fetch">Fetch</option>
        <option value="websocket">WS</option>
        <option value="other">Other</option>
      </select>

      {/* Status code */}
      <select
        value={filters.statusCode}
        onChange={(e) => onUpdate('statusCode', e.target.value)}
        aria-label="Filter by status code"
        style={selectStyle}
      >
        <option value="all">All status</option>
        <option value="2xx">2xx</option>
        <option value="3xx">3xx</option>
        <option value="4xx">4xx</option>
        <option value="5xx">5xx</option>
      </select>

      {/* Group by */}
      <select
        value={filters.groupBy}
        onChange={(e) => onUpdate('groupBy', e.target.value as GroupBy)}
        aria-label="Group by"
        style={selectStyle}
      >
        <option value="none">No grouping</option>
        <option value="resourceType">By type</option>
        <option value="domain">By domain</option>
        <option value="status">By status</option>
      </select>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Count */}
      <span style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}>
        {entryCount === totalCount
          ? `${totalCount} requests`
          : `${entryCount} / ${totalCount}`
        }
      </span>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
          }}
        >
          Reset
        </button>
      )}
    </div>
  )
}

// Shared for filter bar and the App to call focus
export function focusFilterInput() {
  const el = document.querySelector<HTMLInputElement>('[aria-label="Filter by URL"]')
  el?.focus()
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
