import type { IssueSeverity, ResourceType } from './lib/types'

export const TIMING_COLORS = {
  blocked: 'var(--timing-blocked)',
  dns: 'var(--timing-dns)',
  connect: 'var(--timing-connect)',
  ssl: 'var(--timing-ssl)',
  send: 'var(--timing-blocked)',
  wait: 'var(--timing-wait)',
  receive: 'var(--timing-receive)',
} as const

export const TIMING_LABELS: Record<string, string> = {
  blocked: 'Stalled',
  dns: 'DNS',
  connect: 'Connect',
  ssl: 'TLS',
  send: 'Send',
  wait: 'TTFB',
  receive: 'Download',
}

export const SEVERITY_STYLES: Record<IssueSeverity, { text: string; bg: string; label: string }> = {
  critical: { text: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)', label: 'Critical' },
  warning: { text: 'var(--severity-warning)', bg: 'var(--severity-warning-bg)', label: 'Warning' },
  info: { text: 'var(--severity-info)', bg: 'var(--severity-info-bg)', label: 'Info' },
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  document: 'Doc',
  script: 'JS',
  stylesheet: 'CSS',
  image: 'Img',
  font: 'Font',
  media: 'Media',
  xhr: 'XHR',
  fetch: 'Fetch',
  websocket: 'WS',
  other: 'Other',
}

export const TAB_KEYS = ['summary', 'requests', 'waterfall', 'findings', 'rules'] as const
export type TabKey = (typeof TAB_KEYS)[number]

export const TAB_LABELS: Record<TabKey, string> = {
  summary: 'Summary',
  requests: 'Requests',
  waterfall: 'Waterfall',
  findings: 'Findings',
  rules: 'Rules',
}

export const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
export const WARN_FILE_SIZE = 100 * 1024 * 1024 // 100MB
