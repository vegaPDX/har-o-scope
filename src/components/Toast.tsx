import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

interface ToastMessage {
  id: number
  text: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextType {
  addToast: (text: string, type?: ToastMessage['type']) => void
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, text, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => onDismiss(toast.id), 200)
    return () => clearTimeout(timer)
  }, [exiting, onDismiss, toast.id])

  const borderColor =
    toast.type === 'error' ? 'var(--severity-critical)' :
    toast.type === 'success' ? 'var(--health-good)' :
    'var(--accent)'

  return (
    <div
      style={{
        background: 'var(--surface-2)',
        color: 'var(--text-primary)',
        padding: '8px 16px',
        borderRadius: 'var(--radius-md)',
        borderLeft: `3px solid ${borderColor}`,
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
        maxWidth: 360,
        animation: exiting ? 'fade-out 200ms var(--ease-exit) forwards' : 'slide-in-right 200ms var(--ease-enter)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {toast.text}
    </div>
  )
}
