/**
 * Level-meter maths for the sound layers. Levels are 0–1, relative to each series' own range,
 * and move at the data's natural rhythm: events (fire dots, rain days) hit and decay,
 * continuous series glide between months.
 */
import { MONTH_COUNT } from '../data/time'

export interface MeterEvent {
  /** Position within its month, 0–1. */
  offset: number
  /** Hit strength. */
  w: number
}

/** Sum of exponentially decaying hits up to playhead t (months); tau is the decay time in months. */
export function envelope(events: MeterEvent[][], t: number, tau: number): number {
  const cur = Math.min(Math.floor(t), MONTH_COUNT - 1)
  const horizon = tau * 6
  let e = 0
  for (let f = Math.max(0, Math.floor(t - horizon)); f <= cur; f++) {
    for (const ev of events[f]) {
      const age = t - (f + ev.offset)
      if (age < 0) break // events are sorted by offset
      if (age > horizon) continue
      e += ev.w * Math.exp(-age / tau)
    }
  }
  return e
}

/** Envelope a busy month typically reaches, used to scale hits into 0–1. */
export function busyEnvelope(events: MeterEvent[][], tau: number): number {
  const perMonth = events.map((m) => m.reduce((s, ev) => s + ev.w, 0))
  return Math.max(1e-6, Math.max(...perMonth) * tau)
}

/** Soft-saturating map from envelope to level: a busy month sits near the top, a lone hit still shows. */
export function hitLevel(e: number, busy: number): number {
  return 1 - Math.exp((-3 * e) / busy)
}

export function range(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)]
}

/** Value at fractional playhead t, eased between neighbouring months. */
export function glide(values: number[], t: number): number {
  const i = Math.min(Math.max(Math.floor(t), 0), values.length - 1)
  const j = Math.min(i + 1, values.length - 1)
  const e = Math.min(1, Math.max(0, t - Math.floor(t)))
  return values[i] + (values[j] - values[i]) * e
}

export function normalise(v: number, [min, max]: [number, number]): number {
  return max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0
}
