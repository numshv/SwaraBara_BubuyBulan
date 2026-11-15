/**
 * Dummy surface carbon monoxide (ppb), shaped like MERRA-2 surface CO, on the aerosol grid.
 * CO lives longer than smoke particles, so its plumes spread wider. Nothing here is real data.
 */
import { geoBounds } from 'd3-geo'
import { NX, NY, cellIndex, cellLat, cellLon, LAT0, LON0, DLAT, DLON } from './aerosol'
import type { FrameData } from './generate'
import { regionCollection } from './geo'
import { REGIONS, type SongId } from './regions'
import { MONTH_COUNT } from './time'

export const CO_BACKGROUND = 100
const CO_PEAK = 900
const CARRY_OVER = 0.35

export interface CoField {
  /** One NX × NY grid of ppb per month. */
  frames: Float32Array[]
  /** Highest CO per song and month. */
  peaks: Record<SongId, number[]>
}

function deposit(grid: Float32Array, lon: number, lat: number, sigma: number, amount: number) {
  const ci = Math.round((lon - LON0) / DLON)
  const cj = Math.round((lat - LAT0) / DLAT)
  const ri = Math.ceil((sigma * 3) / DLON)
  const rj = Math.ceil((sigma * 3) / DLAT)
  for (let j = Math.max(0, cj - rj); j <= Math.min(NY - 1, cj + rj); j++) {
    for (let i = Math.max(0, ci - ri); i <= Math.min(NX - 1, ci + ri); i++) {
      const dx = cellLon(i) - lon
      const dy = cellLat(j) - lat
      grid[cellIndex(i, j)] += amount * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    }
  }
}

export function generateCo(national: FrameData[], wind: [number, number][]): CoField {
  const raw: Float32Array[] = []
  for (let f = 0; f < MONTH_COUNT; f++) {
    const grid = new Float32Array(NX * NY)
    const [wx, wy] = wind[f]
    for (const d of national[f].dots) {
      const w = Math.sqrt(d.frp)
      for (let s = 0; s < 4; s++) {
        deposit(grid, d.longitude + wx * s * 1.1, d.latitude + wy * s * 1.1, 0.7 + s * 0.45, w * (1 - s * 0.18))
      }
    }
    if (f > 0) for (let k = 0; k < grid.length; k++) grid[k] += raw[f - 1][k] * CARRY_OVER
    raw.push(grid)
  }
  const maxRaw = raw.reduce((m, g) => Math.max(m, ...g), 1e-6)
  const frames = raw.map((g) => g.map((v) => CO_BACKGROUND + (v / maxRaw) * (CO_PEAK - CO_BACKGROUND)))

  const peakIn = (g: Float32Array, box?: [[number, number], [number, number]]) => {
    let best = 0
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        if (box) {
          const lon = cellLon(i)
          const lat = cellLat(j)
          if (lon < box[0][0] || lon > box[1][0] || lat < box[0][1] || lat > box[1][1]) continue
        }
        best = Math.max(best, g[cellIndex(i, j)])
      }
    }
    return Math.round(best)
  }
  const peaks = { indonesia: frames.map((g) => peakIn(g)) } as Record<SongId, number[]>
  for (const r of REGIONS) {
    const box = geoBounds(regionCollection(r.id)) as [[number, number], [number, number]]
    peaks[r.id] = frames.map((g) => peakIn(g, box))
  }
  return { frames, peaks }
}

let cache: CoField | null = null
export function getCo(national: FrameData[], wind: [number, number][]): CoField {
  cache ??= generateCo(national, wind)
  return cache
}

/** CO at a fractional playhead position, blending neighbouring months. */
export function coBlend(field: CoField, t: number, k: number): number {
  const last = field.frames.length - 1
  const i = Math.min(Math.max(Math.floor(t), 0), last)
  const j = Math.min(i + 1, last)
  const e = Math.min(1, Math.max(0, t - Math.floor(t)))
  return field.frames[i][k] * (1 - e) + field.frames[j][k] * e
}
