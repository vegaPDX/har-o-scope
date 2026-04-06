interface HelpPanelProps {
  onClose: () => void
}

export function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
      onClick={onClose}
    >
      <dialog
        open
        aria-label="Help"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--surface-3)',
          borderRadius: 'var(--radius-lg)',
          padding: 0,
          maxWidth: 600,
          maxHeight: '80vh',
          width: '90%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--surface-2)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>How to use har-o-scope</span>
          <button
            onClick={onClose}
            aria-label="Close help"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ overflow: 'auto', padding: 16, fontSize: 13, lineHeight: 1.6 }}>
          <Section title="Capturing a HAR file">
            <ol style={{ paddingLeft: 20, margin: '4px 0' }}>
              <li>Open Chrome DevTools (F12)</li>
              <li>Go to the Network tab</li>
              <li>Check "Preserve log" to capture across page navigations</li>
              <li>Reproduce the issue</li>
              <li>Right-click the request list and select "Save all as HAR with content"</li>
            </ol>
          </Section>

          <Section title="Understanding the Health Score">
            <p style={{ margin: '4px 0' }}>
              The health score is a number from 0 to 100. It starts at 100 and deducts points
              for each issue found:
            </p>
            <ul style={{ paddingLeft: 20, margin: '4px 0' }}>
              <li><strong>Critical finding:</strong> -15 points</li>
              <li><strong>Warning finding:</strong> -5 points</li>
              <li><strong>Info finding:</strong> -1 point</li>
              <li><strong>Slow TTFB (median {'>'} 1s):</strong> -10 points</li>
              <li><strong>High request count ({'>'} 200):</strong> -5 points</li>
            </ul>
          </Section>

          <Section title="Root Cause Classification">
            <p style={{ margin: '4px 0' }}>
              Each finding contributes to a weighted root cause score across three dimensions:
            </p>
            <ul style={{ paddingLeft: 20, margin: '4px 0' }}>
              <li><strong>Server:</strong> Slow TTFB, 5xx errors, high wait times</li>
              <li><strong>Network:</strong> DNS issues, connection problems, high latency</li>
              <li><strong>Client:</strong> Large payloads, too many requests, cache misses</li>
            </ul>
          </Section>

          <Section title="Comparing HAR files">
            <p style={{ margin: '4px 0' }}>
              Use "Compare two files" to analyze performance before and after a change.
              har-o-scope groups requests by URL pattern and shows timing deltas,
              new/resolved findings, and score changes.
            </p>
          </Section>

          <Section title="Custom Rules">
            <p style={{ margin: '4px 0' }}>
              Use the Rules tab to create custom YAML rules. Rules define conditions that match
              against request entries, with configurable severity and escalation thresholds.
              See the YAML preview for the exact format.
            </p>
          </Section>

          <Section title="Privacy">
            <p style={{ margin: '4px 0' }}>
              har-o-scope runs entirely in your browser. No data is ever uploaded to any server.
              All analysis happens in a Web Worker on your machine. Exported reports use
              aggressive sanitization to strip cookies, auth headers, and PII.
            </p>
          </Section>
        </div>
      </dialog>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-primary)',
        margin: '0 0 4px',
      }}>
        {title}
      </h3>
      <div style={{ color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  )
}
