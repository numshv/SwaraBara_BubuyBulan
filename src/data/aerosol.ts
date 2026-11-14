/**
 * Dummy aerosol optical depth (AOD, 550 nm) shaped like MERRA-2 monthly means (M2TMNXAER TOTEXTTAU):
 * a 0.625° × 0.5° grid over Indonesia. Haze is deposited downwind of each month's fire dots,
 * so it follows the fire story; nothing here is real data.
 */
import { geoBounds, geoContains } from 'd3-geo'
import type { FrameData } from './generate'
import { mulberry32 } from './generate'
import { neighbours, provinceAt, regionCollection } from './geo'
import { REGIONS, type SongId } from './regions'
import { MONTH_COUNT, clampFrame, frameMonth } from './time'

export const LON0 = 94
export const LAT0 = -12
export const DLON = 0.625
export const DLAT = 0.5
export const NX = Math.round((142 - LON0) / DLON) + 1
export const NY = Math.round((8 - LAT0) / DLAT) + 1

/** Clean-air background, roughly sea salt plus regional pollution. */
const BACKGROUND = 0.12
/** Peak AOD the dummy field is scaled to (September 2019 over Riau / Central Kalimantan). */
const TARGET_PEAK = 3.1
/** Share of last month's smoke that lingers into this month's mean. */
const CARRY_OVER = 0.25

/** Low-level wind direction per calendar month in degrees per "step": SE monsoon pushes smoke NW in the dry season. */
const WIND: [number, number][] = [
  [0.9, -0.4], [0.8, -0.4], [0.5, -0.2], [0.1, 0.1], [-0.4, 0.4], [-0.8, 0.6],
  [-1, 0.7], [-1.1, 0.8], [-1.1, 0.8], [-0.9, 0.6], [-0.2, 0.2], [0.6, -0.3],
]

export interface AerosolPeak {
  aod: number
  lon: number
  lat: number
  place: string
}

export interface AerosolField {
  /** One NX × NY grid per month, row-major from the south-west corner. */
  frames: Float32Array[]
  /** Unit-ish wind vector [east, north] per month, used for plume shape and smoke drift. */
  wind: [number, number][]
  /** Highest AOD per song and month, with a place name for announcements. */
  peaks: Record<SongId, AerosolPeak[]>
}

export const cellIndex = (i: number, j: number) => j * NX + i
export const cellLon = (i: number) => LON0 + i * DLON
export const cellLat = (j: number) => LAT0 + j * DLAT

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

function placeName(lon: number, lat: number): string {
  const p = provinceAt(lon, lat)
  if (p) return p.properties.name
  const n = neighbours.find((f) => geoContains(f, [lon, lat]))
  return n ? n.properties.name : 'the open sea'
}

function peakIn(grid: Float32Array, box?: [[number, number], [number, number]]): AerosolPeak {
  let best = -1
  let bi = 0
  let bj = 0
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      if (box) {
        const lon = cellLon(i)
        const lat = cellLat(j)
        if (lon < box[0][0] || lon > box[1][0] || lat < box[0][1] || lat > box[1][1]) continue
      }
      const v = grid[cellIndex(i, j)]
      if (v > best) {
        best = v
        bi = i
        bj = j
      }
    }
  }
  return { aod: best, lon: cellLon(bi), lat: cellLat(bj), place: placeName(cellLon(bi), cellLat(bj)) }
}

export function generateAerosol(national: FrameData[], seed = 7): AerosolField {
  const rand = mulberry32(seed)
  const raw: Float32Array[] = []
  const wind: [number, number][] = []

  for (let f = 0; f < MONTH_COUNT; f++) {
    const grid = new Float32Array(NX * NY)
    const [wx, wy] = WIND[frameMonth(f)]
    wind.push([wx, wy])
    // Each dot leaves a plume: a few blobs stepping downwind, spreading as they go.
    for (const d of national[f].dots) {
      const w = Math.sqrt(d.frp) * (0.6 + d.intensity * 0.4)
      for (let s = 0; s < 4; s++) {
        deposit(grid, d.longitude + wx * s * 0.9, d.latitude + wy * s * 0.9, 0.45 + s * 0.35, w * (1 - s * 0.2))
      }
    }
    if (f > 0) for (let k = 0; k < grid.length; k++) grid[k] += raw[f - 1][k] * CARRY_OVER
    raw.push(grid)
  }

  const maxRaw = raw.reduce((m, g) => Math.max(m, ...g), 0)
  const scale = (TARGET_PEAK - BACKGROUND) / maxRaw
  // Gentle compression keeps thin haze visible without blowing out the peaks.
  const frames = raw.map((g) => {
    const out = new Float32Array(g.length)
    for (let k = 0; k < g.length; k++) out[k] = BACKGROUND + rand() * 0.04 + g[k] * scale
    return out
  })

  const peaks = { indonesia: frames.map((g) => peakIn(g)) } as Record<SongId, AerosolPeak[]>
  for (const r of REGIONS) {
    const box = geoBounds(regionCollection(r.id)) as [[number, number], [number, number]]
    peaks[r.id] = frames.map((g) => peakIn(g, box))
  }
  return { frames, wind, peaks }
}

let cache: AerosolField | null = null
export function getAerosol(national: FrameData[]): AerosolField {
  cache ??= generateAerosol(national)
  return cache
}

/** AOD at a fractional playhead position, blending neighbouring months. */
export function aodBlend(field: AerosolField, t: number, k: number): number {
  const f0 = clampFrame(t)
  const f1 = clampFrame(t + 1)
  const e = Math.min(1, Math.max(0, t - Math.floor(t)))
  return field.frames[f0][k] * (1 - e) + field.frames[f1][k] * e
}

export function windAt(field: AerosolField, t: number): [number, number] {
  const a = field.wind[clampFrame(t)]
  const b = field.wind[clampFrame(t + 1)]
  const e = Math.min(1, Math.max(0, t - Math.floor(t)))
  return [a[0] * (1 - e) + b[0] * e, a[1] * (1 - e) + b[1] * e]
}

export function describeHaze(peak: AerosolPeak): string {
  const level = peak.aod >= 2 ? 'Thick haze' : peak.aod >= 1 ? 'Haze' : peak.aod >= 0.5 ? 'Light haze' : null
  if (!level) return 'Mostly clear skies'
  return `${level} over ${peak.place}, AOD ${peak.aod.toFixed(1)}`
}
