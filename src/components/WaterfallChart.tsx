import { memo, useEffect } from 'react'
import { List, useListRef } from 'react-window'
import type { NormalizedEntry, NormalizedTimings } from '../lib/types'
import { TIMING_COLORS, TIMING_LABELS } from '../constants'

interface WaterfallChartProps {
  entries: NormalizedEntry[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  highlightIndices?: Set<number>
}

const ROW_HEIGHT = 36
const LEFT_PANEL_WIDTH = 280

function formatMs(ms: number): string {
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function truncateUrl(url: string, maxLen = 40): string {
  try {
    const u = new URL(url)
    const path = u.pathname
    if (path.length <= maxLen) return path
    return '...' + path.slice(-maxLen + 3)
  } catch {
    return url.length <= maxLen ? url : '...' + url.slice(-maxLen + 3)
  }
}

const TIMING_PHASES = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'] as const

interface RowProps {
  entries: NormalizedEntry[]
  totalTimeMs: number
  selectedIndex: number | null
  onSelect: (index: number) => void
  highlightIndices?: Set<number>
}

const WaterfallRow = memo(function WaterfallRow(props: {
  ariaAttributes: Record<string, unknown>
  index: number
  style: React.CSSProperties
} & RowProps) {
  const { index, style, entries, totalTimeMs, selectedIndex, onSelect, highlightIndices } = props
  const entry = entries[index]
  const isSelected = selectedIndex === index
  const isHighlighted = highlightIndices?.has(index)

  // Calculate bar positions
  const startPercent = totalTimeMs > 0 ? (entry.startTimeMs / totalTimeMs) * 100 : 0
  const totalPercent = totalTimeMs > 0 ? (entry.totalDuration / totalTimeMs) * 100 : 0

  // Build segments
  const segments: { phase: string; width: number; color: string }[] = []
  for (const phase of TIMING_PHASES) {
    const val = entry.timings[phase as keyof NormalizedTimings]
    if (val > 0 && entry.totalDuration > 0) {
      const pct = (val / entry.totalDuration) * totalPercent
      segments.push({
        phase,
        width: pct,
        color: TIMING_COLORS[phase as keyof typeof TIMING_COLORS],
      })
    }
  }

  return (
    <div
      role="row"
      aria-selected={isSelected}
      onClick={() => onSelect(index)}
      style={{
        ...style,
        display: 'flex',
        cursor: 'pointer',
        borderBottom: '1px solid var(--surface-2)',
        background: isSelected
          ? 'var(--accent)'
          : isHighlighted
            ? 'var(--severity-warning-bg)'
            : index % 2 === 0
              ? 'transparent'
              : 'var(--surface-1)',
      }}
    >
      {/* Left frozen panel */}
      <div
        style={{
          width: LEFT_PANEL_WIDTH,
          minWidth: LEFT_PANEL_WIDTH,
          display: 'grid',
          gridTemplateColumns: '40px 40px 1fr',
          alignItems: 'center',
          padding: '0 8px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          borderRight: '1px solid var(--surface-3)',
          gap: 4,
          color: isSelected ? '#fff' : 'var(--text-primary)',
        }}
      >
        <span style={{ color: isSelected ? '#fff' : 'var(--text-muted)' }}>{index + 1}</span>
        <span>{entry.entry.response.status}</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={entry.entry.request.url}
        >
          {truncateUrl(entry.entry.request.url)}
        </span>
      </div>

      {/* Right: timing bars */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: `${startPercent}%`,
            display: 'flex',
            height: 12,
            borderRadius: 2,
          }}
          title={buildTooltip(entry)}
        >
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                width: `${(seg.width / (totalPercent || 1)) * Math.max(2, totalPercent)}vw`,
                minWidth: seg.width > 0 ? 1 : 0,
                background: seg.color,
                borderRadius: i === 0 ? '2px 0 0 2px' : i === segments.length - 1 ? '0 2px 2px 0' : 0,
                transformOrigin: 'left',
                animation: `waterfall-grow 300ms var(--ease-enter) ${index * 10}ms both`,
              }}
            />
          ))}
        </div>
        {/* Duration label */}
        <span
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: `calc(${startPercent + totalPercent}% + 4px)`,
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: isSelected ? '#fff' : 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {formatMs(entry.totalDuration)}
        </span>
      </div>
    </div>
  )
}) as any

function buildTooltip(entry: NormalizedEntry): string {
  const parts: string[] = []
  for (const phase of TIMING_PHASES) {
    const val = entry.timings[phase as keyof NormalizedTimings]
    if (val > 0) {
      parts.push(`${TIMING_LABELS[phase]}: ${formatMs(val)}`)
    }
  }
  return parts.join('\n')
}

export function WaterfallChart({ entries, selectedIndex, onSelect, highlightIndices }: WaterfallChartProps) {
  const listRef = useListRef(null)

  const totalTimeMs = entries.length > 0
    ? Math.max(...entries.map((e) => e.startTimeMs + e.totalDuration))
    : 0

  useEffect(() => {
    if (selectedIndex !== null && listRef.current) {
      listRef.current.scrollToRow({ index: selectedIndex, align: 'smart' })
    }
  }, [selectedIndex, listRef])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          height: 32,
          borderBottom: '2px solid var(--surface-3)',
          background: 'var(--surface-1)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: LEFT_PANEL_WIDTH,
            minWidth: LEFT_PANEL_WIDTH,
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted)',
            borderRight: '1px solid var(--surface-3)',
          }}
        >
          Request
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
          }}
        >
          <TimingLegend />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {formatMs(totalTimeMs)} total
          </span>
        </div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <List
          listRef={listRef}
          rowComponent={WaterfallRow}
          rowProps={{
            entries,
            totalTimeMs,
            selectedIndex,
            onSelect,
            highlightIndices,
          }}
          rowCount={entries.length}
          rowHeight={ROW_HEIGHT}
        />
      </div>
    </div>
  )
}

function TimingLegend() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {TIMING_PHASES.map((phase) => (
        <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 1,
              background: TIMING_COLORS[phase as keyof typeof TIMING_COLORS],
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{TIMING_LABELS[phase]}</span>
        </div>
      ))}
    </div>
  )
}
