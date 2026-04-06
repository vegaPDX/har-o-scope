import type { ThemeMode } from '../hooks/useTheme'

const ICONS: Record<ThemeMode, string> = {
  system: '◐',
  light: '☀',
  dark: '☾',
}

const LABELS: Record<ThemeMode, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
}

export function ThemeToggle({ mode, onCycle }: { mode: ThemeMode; onCycle: () => void }) {
  return (
    <button
      onClick={onCycle}
      aria-label={LABELS[mode]}
      title={`Theme: ${mode}`}
      style={{
        background: 'transparent',
        border: '1px solid var(--surface-3)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '4px 8px',
        fontSize: 16,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 14 }}>{ICONS[mode]}</span>
    </button>
  )
}
