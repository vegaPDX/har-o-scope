import { useState, useCallback } from 'react'
import type { NormalizedEntry, NormalizedTimings } from '../lib/types'
import { TIMING_COLORS, TIMING_LABELS } from '../constants'
import { useToast } from './Toast'

interface RequestDetailProps {
  entry: NormalizedEntry
  onClose: () => void
}

type DetailTab = 'headers' | 'timing' | 'response' | 'curl'

function formatMs(ms: number): string {
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function RequestDetail({ entry, onClose }: RequestDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('headers')
  const { addToast } = useToast()

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'headers', label: 'Headers' },
    { key: 'timing', label: 'Timing' },
    { key: 'response', label: 'Response' },
    { key: 'curl', label: 'cURL' },
  ]

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast(`${label} copied`, 'success')
    })
  }, [addToast])

  return (
    <div
      role="dialog"
      aria-label="Request detail"
      style={{
        background: 'var(--surface-1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--surface-2)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          marginRight: 8,
        }}>
          <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
            {entry.entry.request.method}
          </span>
          {entry.entry.request.url}
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--surface-2)',
          padding: '0 12px',
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        role="tabpanel"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 12,
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {activeTab === 'headers' && <HeadersTab entry={entry} />}
        {activeTab === 'timing' && <TimingTab entry={entry} />}
        {activeTab === 'response' && <ResponseTab entry={entry} />}
        {activeTab === 'curl' && <CurlTab entry={entry} onCopy={copyToClipboard} />}
      </div>
    </div>
  )
}

function HeadersTab({ entry }: { entry: NormalizedEntry }) {
  const req = entry.entry.request
  const res = entry.entry.response
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={sectionHeaderStyle}>General</div>
        <HeaderRow label="URL" value={req.url} />
        <HeaderRow label="Method" value={req.method} />
        <HeaderRow label="Status" value={`${res.status} ${res.statusText}`} />
        <HeaderRow label="HTTP Version" value={entry.httpVersion} />
        <HeaderRow label="Transfer Size" value={formatSize(entry.transferSizeResolved)} />
        <HeaderRow label="Content Size" value={formatSize(entry.contentSize)} />
      </div>
      <div>
        <div style={sectionHeaderStyle}>Request Headers</div>
        {req.headers.map((h, i) => (
          <HeaderRow key={i} label={h.name} value={h.value} />
        ))}
      </div>
      <div>
        <div style={sectionHeaderStyle}>Response Headers</div>
        {res.headers.map((h, i) => (
          <HeaderRow key={i} label={h.name} value={h.value} />
        ))}
      </div>
    </div>
  )
}

function TimingTab({ entry }: { entry: NormalizedEntry }) {
  const timings = entry.timings
  const phases = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'] as const
  const maxPhase = Math.max(...phases.map((p) => timings[p]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {phases.map((phase) => {
        const val = timings[phase as keyof NormalizedTimings]
        const pct = maxPhase > 0 ? (val / maxPhase) * 100 : 0
        return (
          <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 60, color: 'var(--text-secondary)', fontSize: 11 }}>
              {TIMING_LABELS[phase]}
            </div>
            <div style={{ flex: 1, height: 16, position: 'relative' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  minWidth: val > 0 ? 2 : 0,
                  background: TIMING_COLORS[phase as keyof typeof TIMING_COLORS],
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{ width: 70, textAlign: 'right', color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {formatMs(val)}
            </div>
          </div>
        )
      })}
      <div style={{
        borderTop: '1px solid var(--surface-3)',
        paddingTop: 8,
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: 600,
      }}>
        <span>Total</span>
        <span>{formatMs(entry.totalDuration)}</span>
      </div>
    </div>
  )
}

function ResponseTab({ entry }: { entry: NormalizedEntry }) {
  const content = entry.entry.response.content
  const text = content?.text
  const mimeType = content?.mimeType ?? ''

  if (!text) {
    return <div style={{ color: 'var(--text-muted)' }}>No response body captured</div>
  }

  // Try to format JSON
  if (mimeType.includes('json')) {
    try {
      const parsed = JSON.parse(text)
      return (
        <pre style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: 'var(--text-primary)',
          maxHeight: 400,
          overflow: 'auto',
        }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    } catch { /* fall through */ }
  }

  return (
    <pre style={{
      margin: 0,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      color: 'var(--text-primary)',
      maxHeight: 400,
      overflow: 'auto',
    }}>
      {text.length > 10000 ? text.slice(0, 10000) + '\n... (truncated)' : text}
    </pre>
  )
}

function CurlTab({ entry, onCopy }: { entry: NormalizedEntry; onCopy: (text: string, label: string) => void }) {
  const req = entry.entry.request
  const parts = [`curl '${req.url}'`]

  if (req.method !== 'GET') {
    parts.push(`  -X ${req.method}`)
  }

  for (const h of req.headers) {
    if (h.name.startsWith(':')) continue // skip HTTP/2 pseudo-headers
    parts.push(`  -H '${h.name}: ${h.value}'`)
  }

  if (req.postData?.text) {
    parts.push(`  --data-raw '${req.postData.text.replace(/'/g, "'\\''")}'`)
  }

  const curl = parts.join(' \\\n')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={() => onCopy(curl, 'cURL command')}
        style={{
          alignSelf: 'flex-start',
          background: 'var(--surface-2)',
          border: '1px solid var(--surface-3)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: 11,
        }}
      >
        Copy cURL
      </button>
      <pre style={{
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        color: 'var(--text-primary)',
      }}>
        {curl}
      </pre>
    </div>
  )
}

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      gap: 8,
      padding: '2px 0',
      borderBottom: '1px solid var(--surface-2)',
    }}>
      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  marginBottom: 4,
  letterSpacing: '0.02em',
}
