import { useCallback, useState, useRef } from 'react'
import { MAX_FILE_SIZE, WARN_FILE_SIZE } from '../constants'

interface FileUploadProps {
  onFile: (content: string, name: string) => void
  onCompare?: (before: string, after: string, beforeName: string, afterName: string) => void
  disabled?: boolean
}

export function FileUpload({ onFile, onCompare, disabled }: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [firstFile, setFirstFile] = useState<{ content: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error(`File too large (${formatSize(file.size)}). Maximum is 200 MB.`))
        return
      }
      if (file.size > WARN_FILE_SIZE) {
        // Still process but user was warned by the 200MB check
      }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    try {
      const content = await readFile(file)
      if (compareMode && firstFile) {
        onCompare?.(firstFile.content, content, firstFile.name, file.name)
        setFirstFile(null)
        setCompareMode(false)
      } else if (compareMode) {
        setFirstFile({ content, name: file.name })
      } else {
        onFile(content, file.name)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
    }
  }, [readFile, onFile, onCompare, compareMode, firstFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile, disabled])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }, [disabled])

  const onDragLeave = useCallback(() => setDragging(false), [])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  if (compareMode && firstFile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 'var(--space-12)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          Before: {firstFile.name}
        </div>
        <DropZone
          dragging={dragging}
          disabled={disabled}
          label="Drop the 'after' HAR file"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
        />
        <button
          onClick={() => { setCompareMode(false); setFirstFile(null) }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Cancel comparison
        </button>
        <input ref={inputRef} type="file" accept=".har,.json" onChange={onInputChange} style={{ display: 'none' }} />
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      padding: 'var(--space-12)',
    }}>
      {compareMode ? (
        <>
          <DropZone
            dragging={dragging}
            disabled={disabled}
            label="Drop the 'before' HAR file"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current?.click()}
          />
          <button
            onClick={() => setCompareMode(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Cancel comparison
          </button>
        </>
      ) : (
        <>
          <DropZone
            dragging={dragging}
            disabled={disabled}
            label="Drop a HAR file. Get instant diagnosis."
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current?.click()}
          />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Your data never leaves this browser. Zero network calls.</span>
          </div>
          {onCompare && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setCompareMode(true)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--surface-3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  fontSize: 12,
                }}
              >
                Compare two files
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <div style={{ color: 'var(--severity-critical)', fontSize: 13 }}>{error}</div>
      )}
      <input ref={inputRef} type="file" accept=".har,.json" onChange={onInputChange} style={{ display: 'none' }} />
    </div>
  )
}

function DropZone({
  dragging,
  disabled,
  label,
  onDrop,
  onDragOver,
  onDragLeave,
  onClick,
}: {
  dragging: boolean
  disabled?: boolean
  label: string
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onClick: () => void
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={disabled ? undefined : onClick}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--surface-3)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '40px 48px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 150ms, background 150ms',
        background: dragging ? 'var(--severity-info-bg)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
        maxWidth: 480,
        width: '100%',
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1.5"
        style={{ marginBottom: 12 }}
      >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
      <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
        or click to browse (.har, .json)
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
