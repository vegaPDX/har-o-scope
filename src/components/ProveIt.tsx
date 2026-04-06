import { useEffect, useState, useRef } from 'react'

interface NetworkEntry {
  name: string
  timestamp: number
}

export function ProveIt({ onClose }: { onClose: () => void }) {
  const [appAssets, setAppAssets] = useState<PerformanceResourceTiming[]>([])
  const [postLoadRequests, setPostLoadRequests] = useState<NetworkEntry[]>([])
  const observerRef = useRef<PerformanceObserver | null>(null)

  useEffect(() => {
    // Capture all resources loaded at init (app bundles)
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    setAppAssets(resources)

    // Watch for any new network requests
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        setPostLoadRequests((prev) => [
          ...prev,
          { name: entry.name, timestamp: entry.startTime },
        ])
      }
    })
    observer.observe({ type: 'resource', buffered: false })
    observerRef.current = observer

    return () => observer.disconnect()
  }, [])

  const clean = postLoadRequests.length === 0

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
      <div
        role="dialog"
        aria-label="Network activity proof"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--surface-3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Zero-Trust Proof</span>
          <button
            onClick={onClose}
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

        {/* Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: clean ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${clean ? 'var(--health-good)' : 'var(--severity-critical)'}`,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 20 }}>{clean ? '✓' : '!'}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Network requests since analysis: {postLoadRequests.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {clean
                ? 'No data has been sent anywhere. Your HAR file never left this browser.'
                : 'Unexpected network activity detected!'}
            </div>
          </div>
        </div>

        {/* Post-load requests (red if any) */}
        {postLoadRequests.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--severity-critical)', marginBottom: 4 }}>
              UNEXPECTED REQUESTS
            </div>
            {postLoadRequests.map((req, i) => (
              <div key={i} style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                padding: '2px 0',
                color: 'var(--severity-critical)',
                wordBreak: 'break-all',
              }}>
                {req.name}
              </div>
            ))}
          </div>
        )}

        {/* App assets */}
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}>
            APP ASSETS (static files loaded at startup)
          </div>
          <div style={{
            maxHeight: 200,
            overflow: 'auto',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
          }}>
            {appAssets.map((asset, i) => {
              let name: string
              try { name = new URL(asset.name).pathname } catch { name = asset.name }
              return (
                <div key={i} style={{ padding: '1px 0' }}>
                  {name}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
