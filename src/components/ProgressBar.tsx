import type { AnalyzerProgress } from '../hooks/useAnalyzer'

export function ProgressBar({ progress }: { progress: AnalyzerProgress }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
      }}
      role="progressbar"
      aria-valuenow={progress.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={progress.phase}
    >
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 4,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {progress.phase}
      </div>
      <div
        style={{
          height: 4,
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress.percent}%`,
            background: 'var(--accent)',
            borderRadius: 'var(--radius-full)',
            transition: 'width 200ms var(--ease-move)',
          }}
        />
      </div>
    </div>
  )
}
