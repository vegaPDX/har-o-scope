import { useState, useCallback, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
  defaultSplit?: number // 0-1, default 0.5
  minLeft?: number // px
  minRight?: number // px
}

export function SplitPane({
  left,
  right,
  defaultSplit = 0.5,
  minLeft = 280,
  minRight = 300,
}: SplitPaneProps) {
  const [split, setSplit] = useState(defaultSplit)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const width = rect.width
      const minLeftRatio = minLeft / width
      const minRightRatio = minRight / width
      const ratio = Math.max(minLeftRatio, Math.min(1 - minRightRatio, x / width))
      setSplit(ratio)
    }

    function onMouseUp() {
      if (dragging.current) {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [minLeft, minRight])

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Left panel */}
      <div style={{
        width: `${split * 100}%`,
        minWidth: minLeft,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {left}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 5,
          flexShrink: 0,
          cursor: 'col-resize',
          background: 'var(--surface-3)',
          position: 'relative',
          zIndex: 10,
          transition: 'background 100ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent)'
        }}
        onMouseLeave={(e) => {
          if (!dragging.current) {
            e.currentTarget.style.background = 'var(--surface-3)'
          }
        }}
      />

      {/* Right panel */}
      <div style={{
        flex: 1,
        minWidth: minRight,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {right}
      </div>
    </div>
  )
}
