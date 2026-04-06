import { useEffect, useState } from 'react'

interface HealthScoreDonutProps {
  score: number
  size?: number
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'var(--health-good)'
  if (score >= 50) return 'var(--health-ok)'
  return 'var(--health-bad)'
}

export function HealthScoreDonut({ score, size = 160 }: HealthScoreDonutProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference
  const color = getScoreColor(score)

  // Animate the number counting up
  useEffect(() => {
    setAnimatedScore(0)
    const duration = 1000
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(Math.round(eased * score))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [score])

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-label={`Health score: ${score} out of 100`}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            ['--circumference' as string]: circumference,
            ['--dash-offset' as string]: dashOffset,
            animation: 'donut-draw 1000ms var(--ease-enter) forwards',
          }}
        />
      </svg>
      {/* Center text */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontWeight: 700,
            color,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
          }}
        >
          {animatedScore}
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 2,
          }}
        >
          Health Score
        </span>
      </div>
    </div>
  )
}
