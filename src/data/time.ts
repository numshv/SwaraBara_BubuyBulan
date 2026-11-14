export const START_YEAR = 2018
export const END_YEAR = 2025
export const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i)
export const MONTH_COUNT = YEARS.length * 12
/** Playback speed at 1×: one month of data per second. */
export const SECONDS_PER_MONTH = 1

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function clampFrame(frame: number): number {
  return Math.min(Math.max(Math.floor(frame), 0), MONTH_COUNT - 1)
}

export function frameYear(frame: number): number {
  return START_YEAR + Math.floor(clampFrame(frame) / 12)
}

export function frameMonth(frame: number): number {
  return clampFrame(frame) % 12
}

export function frameLabel(frame: number): string {
  return `${MONTH_NAMES[frameMonth(frame)]} ${frameYear(frame)}`
}

export function daysInMonth(frame: number): number {
  return new Date(frameYear(frame), frameMonth(frame) + 1, 0).getDate()
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function formatCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`
  return formatNumber(n)
}
