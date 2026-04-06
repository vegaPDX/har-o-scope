import { useEffect } from 'react'
import type { TabKey } from '../constants'

export interface ShortcutHandlers {
  onNextRow?: () => void
  onPrevRow?: () => void
  onExpand?: () => void
  onClose?: () => void
  onFocusFilter?: () => void
  onExportMenu?: () => void
  onShowHelp?: () => void
  onSwitchTab?: (tab: TabKey) => void
}

const TAB_MAP: Record<string, TabKey> = {
  '1': 'summary',
  '2': 'requests',
  '3': 'waterfall',
  '4': 'findings',
  '5': 'rules',
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Escape still works in inputs
        if (e.key !== 'Escape') return
      }

      switch (e.key) {
        case 'j':
          e.preventDefault()
          handlers.onNextRow?.()
          break
        case 'k':
          e.preventDefault()
          handlers.onPrevRow?.()
          break
        case 'Enter':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            handlers.onExpand?.()
          }
          break
        case 'Escape':
          e.preventDefault()
          handlers.onClose?.()
          break
        case 'f':
          e.preventDefault()
          handlers.onFocusFilter?.()
          break
        case 'e':
          e.preventDefault()
          handlers.onExportMenu?.()
          break
        case '?':
          e.preventDefault()
          handlers.onShowHelp?.()
          break
        default:
          if (TAB_MAP[e.key] && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault()
            handlers.onSwitchTab?.(TAB_MAP[e.key])
          }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
