/**
 * ANSI color utilities with TTY detection.
 * Respects NO_COLOR env var and --no-color flag.
 */

let _forceColor: boolean | undefined

export function setColorEnabled(enabled: boolean): void {
  _forceColor = enabled
}

function isEnabled(): boolean {
  if (_forceColor !== undefined) return _forceColor
  return !!process.stdout.isTTY && !process.env.NO_COLOR
}

function wrap(code: number, text: string): string {
  return isEnabled() ? `\x1b[${code}m${text}\x1b[0m` : text
}

export const red = (t: string) => wrap(31, t)
export const yellow = (t: string) => wrap(33, t)
export const green = (t: string) => wrap(32, t)
export const blue = (t: string) => wrap(34, t)
export const cyan = (t: string) => wrap(36, t)
export const dim = (t: string) => wrap(2, t)
export const bold = (t: string) => wrap(1, t)

export function severityColor(severity: string): (t: string) => string {
  switch (severity) {
    case 'critical': return red
    case 'warning': return yellow
    case 'info': return blue
    default: return (t) => t
  }
}

export function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return isEnabled() ? '\u2716' : 'X'
    case 'warning': return isEnabled() ? '\u25B2' : '!'
    case 'info': return isEnabled() ? '\u25CF' : 'i'
    default: return '-'
  }
}

export function healthScoreColor(score: number): (t: string) => string {
  if (score >= 90) return green
  if (score >= 50) return yellow
  return red
}

export function scoreBar(score: number): string {
  const filled = Math.round(score / 10)
  const empty = 10 - filled
  if (isEnabled()) {
    return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
  }
  return '#'.repeat(filled) + '-'.repeat(empty)
}
