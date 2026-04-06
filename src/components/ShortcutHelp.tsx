interface ShortcutHelpProps {
  onClose: () => void
}

const SHORTCUTS = [
  { keys: 'j / k', desc: 'Next / previous row' },
  { keys: 'Enter', desc: 'Expand detail panel' },
  { keys: 'Escape', desc: 'Close panel / overlay' },
  { keys: 'f', desc: 'Focus filter input' },
  { keys: 'e', desc: 'Open export menu' },
  { keys: '?', desc: 'Show this help' },
  { keys: '1-5', desc: 'Switch tabs' },
]

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
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
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--surface-3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          maxWidth: 360,
          width: '90%',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Keyboard Shortcuts</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <kbd
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--surface-3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 6px',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                }}
              >
                {s.keys}
              </kbd>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
