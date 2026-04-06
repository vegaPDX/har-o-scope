import { memo, useCallback, useRef, useEffect, useState } from 'react'
import { List, useListRef } from 'react-window'
import type { ListImperativeAPI } from 'react-window'
import type { NormalizedEntry } from '../lib/types'
import type { SortField } from '../hooks/useFilters'
import { RESOURCE_TYPE_LABELS, TIMING_COLORS } from '../constants'

interface RequestTableProps {
  entries: NormalizedEntry[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  onSort: (field: SortField) => void
  sortField: SortField
  sortDir: 'asc' | 'desc'
  highlightIndices?: Set<number>
}

const ROW_HEIGHT = 36

function formatMs(ms: number): string {
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getStatusColor(status: number): string {
  if (status >= 500) return 'var(--severity-critical)'
  if (status >= 400) return 'var(--severity-warning)'
  if (status >= 300) return 'var(--text-muted)'
  return 'var(--text-primary)'
}

function truncateUrl(url: string, maxLen = 80): string {
  try {
    const u = new URL(url)
    const path = u.pathname + u.search
    if (path.length <= maxLen) return path
    return path.slice(0, maxLen - 3) + '...'
  } catch {
    return url.length <= maxLen ? url : url.slice(0, maxLen - 3) + '...'
  }
}

function getTimingBarWidth(entry: NormalizedEntry, maxDuration: number): number {
  if (maxDuration <= 0) return 0
  return Math.max(1, (entry.totalDuration / maxDuration) * 100)
}

const SortArrow = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => (
  <span style={{ opacity: active ? 1 : 0.3, fontSize: 10, marginLeft: 2 }}>
    {dir === 'asc' ? '▲' : '▼'}
  </span>
)

interface RowProps {
  entries: NormalizedEntry[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  maxDuration: number
  highlightIndices?: Set<number>
}

const RequestRow = memo(function RequestRow(props: {
  ariaAttributes: Record<string, unknown>
  index: number
  style: React.CSSProperties
} & RowProps) {
  const { index, style, entries, selectedIndex, onSelect, maxDuration, highlightIndices } = props
  const entry = entries[index]
  const isSelected = selectedIndex === index
  const isHighlighted = highlightIndices?.has(index)

  return (
    <div
      role="row"
      aria-selected={isSelected}
      onClick={() => onSelect(index)}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: '50px 60px 50px 1fr 70px 70px 100px',
        alignItems: 'center',
        gap: 0,
        padding: '0 8px',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        background: isSelected
          ? 'var(--accent)'
          : isHighlighted
            ? 'var(--severity-warning-bg)'
            : index % 2 === 0
              ? 'transparent'
              : 'var(--surface-1)',
        color: isSelected ? '#fff' : 'var(--text-primary)',
        borderBottom: '1px solid var(--surface-2)',
      }}
    >
      <div style={{ color: isSelected ? '#fff' : 'var(--text-muted)' }}>{index + 1}</div>
      <div>{RESOURCE_TYPE_LABELS[entry.resourceType]}</div>
      <div style={{ color: isSelected ? '#fff' : getStatusColor(entry.entry.response.status) }}>
        {entry.entry.response.status}
      </div>
      <div
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={entry.entry.request.url}
      >
        {truncateUrl(entry.entry.request.url)}
      </div>
      <div style={{ textAlign: 'right' }}>{formatMs(entry.totalDuration)}</div>
      <div style={{ textAlign: 'right' }}>{formatSize(entry.transferSizeResolved)}</div>
      <div style={{ padding: '0 4px' }}>
        <div
          style={{
            height: 6,
            borderRadius: 2,
            background: TIMING_COLORS.wait,
            width: `${getTimingBarWidth(entry, maxDuration)}%`,
            minWidth: 1,
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  )
}) as any

export function RequestTable({
  entries,
  selectedIndex,
  onSelect,
  onSort,
  sortField,
  sortDir,
  highlightIndices,
}: RequestTableProps) {
  const listRef = useListRef(null)
  const maxDuration = entries.reduce((max, e) => Math.max(max, e.totalDuration), 0)

  // Scroll selected into view
  useEffect(() => {
    if (selectedIndex !== null && listRef.current) {
      listRef.current.scrollToRow({ index: selectedIndex, align: 'smart' })
    }
  }, [selectedIndex, listRef])

  const headerStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    userSelect: 'none',
    padding: '0 2px',
  }

  const handleSort = useCallback((field: SortField) => () => onSort(field), [onSort])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header row */}
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: '50px 60px 50px 1fr 70px 70px 100px',
          alignItems: 'center',
          padding: '0 8px',
          height: 32,
          borderBottom: '2px solid var(--surface-3)',
          background: 'var(--surface-1)',
          flexShrink: 0,
        }}
      >
        <div style={headerStyle} onClick={handleSort('startTime')}>
          # <SortArrow active={sortField === 'startTime'} dir={sortDir} />
        </div>
        <div style={headerStyle}>Type</div>
        <div style={headerStyle} onClick={handleSort('status')}>
          Status <SortArrow active={sortField === 'status'} dir={sortDir} />
        </div>
        <div style={headerStyle} onClick={handleSort('url')}>
          URL <SortArrow active={sortField === 'url'} dir={sortDir} />
        </div>
        <div style={{ ...headerStyle, textAlign: 'right' }} onClick={handleSort('duration')}>
          Time <SortArrow active={sortField === 'duration'} dir={sortDir} />
        </div>
        <div style={{ ...headerStyle, textAlign: 'right' }} onClick={handleSort('size')}>
          Size <SortArrow active={sortField === 'size'} dir={sortDir} />
        </div>
        <div style={headerStyle}>Timing</div>
      </div>

      {/* Virtualized rows */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <List
          listRef={listRef}
          rowComponent={RequestRow}
          rowProps={{
            entries,
            selectedIndex,
            onSelect,
            maxDuration,
            highlightIndices,
          }}
          rowCount={entries.length}
          rowHeight={ROW_HEIGHT}
        />
      </div>
    </div>
  )
}
